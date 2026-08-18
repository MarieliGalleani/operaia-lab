import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { afterEach, describe, expect, it } from "vitest";
import { createAuthRoutes } from "../modules/auth/auth.routes.js";
import { AuthService } from "../modules/auth/auth-service.js";
import {
  registerAuthGuard,
  SESSION_COOKIE_NAME,
} from "../modules/auth/auth-guard.js";
import { registerAuthenticatedApiHooks } from "../modules/auth/authenticated-api.js";
import type { PasswordHasher } from "../modules/auth/auth.types.js";
import { InMemoryAuthRepository } from "../modules/auth/in-memory-auth-repository.test-helper.js";
import { WEBHOOK_RATE_LIMIT, registerHttpSecurity } from "./http-security.js";
import { errorHandler } from "./error-handler.js";

const LOGIN = "admin@operaia.com.br";
const PASSWORD = "test-only-password-never-use";
const OFFICIAL_WORKSPACES = [
  "operaia-lab",
  "nexo",
  "infra",
  "deploy",
  "flowgrid",
  "hexalife",
  "odontoclinic",
  "estocai",
] as const;
const apps: FastifyInstance[] = [];

const testHasher: PasswordHasher = {
  hash: async (password) => `test-hash:${password}`,
  verify: async (hash, password) => hash === `test-hash:${password}`,
};

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function buildTestApp(
  environment: "development" | "test" | "production" = "production",
) {
  const repository = new InMemoryAuthRepository();
  repository.addUser({
    login: LOGIN,
    passwordHash: `test-hash:${PASSWORD}`,
    active: true,
  });
  const authService = new AuthService(repository, testHasher);
  const app = Fastify({ logger: false, trustProxy: "127.0.0.1" });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);
  registerHttpSecurity(app, environment);
  app.register(cookie);
  registerAuthGuard(app, authService);

  app.register(async (publicApi) => {
    publicApi.get("/health", async () => ({ status: "ok" }));
    publicApi.post(
      "/api/v1/webhooks/github",
      { config: { rateLimit: WEBHOOK_RATE_LIMIT } },
      async () => ({ accepted: true }),
    );
  });
  app.register(createAuthRoutes(authService, environment === "production"), {
    prefix: "/api/auth",
  });
  app.register(async (protectedApi) => {
    registerAuthenticatedApiHooks(protectedApi);
    for (const path of [
      "/api/v1/infra/vps",
      "/api/v1/runtime",
      "/api/v1/workers",
      "/api/v1/production-readiness",
    ]) {
      protectedApi.get(path, async () => ({ protected: true }));
    }
    protectedApi.post("/api/v1/missions", async (request) => ({
      workspaceId: readWorkspaceId(request.body),
    }));
    protectedApi.get("/api/v1/missions", async () => ({ missions: [] }));
    protectedApi.get(
      "/api/v1/workspaces/:workspaceId",
      async (request) => request.params,
    );
  });
  apps.push(app);
  return app;
}

async function login(app: FastifyInstance): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { login: LOGIN, password: PASSWORD },
  });
  expect(response.statusCode).toBe(200);
  const setCookie = response.headers["set-cookie"];
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return header!.split(";")[0]!;
}

function readWorkspaceId(input: unknown): string | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  const value = (input as Record<string, unknown>).workspaceId;
  return typeof value === "string" ? value : undefined;
}

describe("API hardening e protecao central", () => {
  it.each([
    "/api/v1/infra/vps",
    "/api/v1/runtime",
    "/api/v1/workers",
    "/api/v1/production-readiness",
  ])("protege endpoint sensivel sem sessao: %s", async (url) => {
    const app = buildTestApp();
    expect((await app.inject({ method: "GET", url })).statusCode).toBe(401);
  });

  it("aceita sessao valida e rejeita sessao invalida", async () => {
    const app = buildTestApp();
    const sessionCookie = await login(app);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/runtime",
          headers: { cookie: sessionCookie },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/runtime",
          headers: { cookie: `${SESSION_COOKIE_NAME}=invalid` },
        })
      ).statusCode,
    ).toBe(401);
  });

  it("nao aceita bypass por header, IP ou workspaceId", async () => {
    const app = buildTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/missions",
      remoteAddress: "127.0.0.1",
      headers: {
        "x-user": LOGIN,
        "x-admin": "true",
        "content-type": "application/json",
      },
      payload: { workspaceId: "operaia-lab" },
    });
    expect(response.statusCode).toBe(401);
  });

  it("aceita os oito workspaces oficiais no servidor", async () => {
    const app = buildTestApp();
    const sessionCookie = await login(app);
    for (const workspaceId of OFFICIAL_WORKSPACES) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/missions",
        headers: { cookie: sessionCookie },
        payload: { workspaceId },
      });
      expect(response.statusCode).toBe(200);
    }
  });

  it.each(["menuflow", "plataforma", "desconhecido"])(
    "rejeita workspace nao oficial no body e na URL: %s",
    async (workspaceId) => {
      const app = buildTestApp();
      const sessionCookie = await login(app);
      const bodyResponse = await app.inject({
        method: "POST",
        url: "/api/v1/missions",
        headers: { cookie: sessionCookie },
        payload: { workspaceId },
      });
      const pathResponse = await app.inject({
        method: "GET",
        url: `/api/v1/workspaces/${workspaceId}`,
        headers: { cookie: sessionCookie },
      });
      const queryResponse = await app.inject({
        method: "GET",
        url: `/api/v1/missions?workspaceId=${workspaceId}`,
        headers: { cookie: sessionCookie },
      });
      expect(bodyResponse.statusCode).toBe(403);
      expect(pathResponse.statusCode).toBe(403);
      expect(queryResponse.statusCode).toBe(403);
    },
  );

  it("permite origem oficial com credenciais e rejeita origem arbitraria", async () => {
    const app = buildTestApp();
    const allowed = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://lab.operaia.com.br" },
    });
    const denied = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://attacker.example" },
    });
    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "https://lab.operaia.com.br",
    );
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("permite localhost somente fora de producao", async () => {
    const development = buildTestApp("development");
    const production = buildTestApp("production");
    const origin = "http://localhost:5173";
    const devResponse = await development.inject({
      method: "GET",
      url: "/health",
      headers: { origin },
    });
    const prodResponse = await production.inject({
      method: "GET",
      url: "/health",
      headers: { origin },
    });
    expect(devResponse.headers["access-control-allow-origin"]).toBe(origin);
    expect(prodResponse.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("aplica headers Helmet e rate limit global", async () => {
    const app = buildTestApp();
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.headers["referrer-policy"]).toBeDefined();
    for (let request = 1; request < 600; request += 1) {
      expect(
        (await app.inject({ method: "GET", url: "/health" })).statusCode,
      ).toBe(200);
    }
    expect(
      (await app.inject({ method: "GET", url: "/health" })).statusCode,
    ).toBe(429);
  });

  it("mantem webhook fora da sessao humana com limite dedicado", async () => {
    const app = buildTestApp();
    for (let request = 0; request < 300; request += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/webhooks/github",
      });
      expect(response.statusCode).toBe(200);
    }
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/webhooks/github",
        })
      ).statusCode,
    ).toBe(429);
  });
});
