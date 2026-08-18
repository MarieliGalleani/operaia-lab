import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { afterEach, describe, expect, it } from "vitest";
import { createAuthRoutes } from "../auth/auth.routes.js";
import { AuthService } from "../auth/auth-service.js";
import { registerAuthGuard } from "../auth/auth-guard.js";
import { registerAuthenticatedApiHooks } from "../auth/authenticated-api.js";
import type { PasswordHasher } from "../auth/auth.types.js";
import { InMemoryAuthRepository } from "../auth/in-memory-auth-repository.test-helper.js";
import { HEALTH_RATE_LIMIT, registerHttpSecurity } from "../../shared/http-security.js";
import { errorHandler } from "../../shared/error-handler.js";
import {
  PUBLIC_STATUS_OK,
  PUBLIC_STATUS_UNAVAILABLE,
  resolvePublicStatus,
} from "./public-status.js";
import { createPublicStatusRoutes } from "./public-status.routes.js";

const LOGIN = "admin@operaia.com.br";
const PASSWORD = "test-only-password-never-use";
const SENSITIVE_STATUS_KEYS = [
  "workers",
  "workersAlive",
  "workspaceId",
  "workspaces",
  "queue",
  "missions",
  "projects",
  "database",
  "cpu",
  "ram",
  "load",
  "memory",
  "readiness",
  "secret",
  "password",
  "token",
  "infra",
  "version",
] as const;
const apps: FastifyInstance[] = [];

const testHasher: PasswordHasher = {
  hash: async (password) => `test-hash:${password}`,
  verify: async (hash, password) => hash === `test-hash:${password}`,
};

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function buildStatusApp(probe?: () => void) {
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
  registerHttpSecurity(app, "production");
  app.register(cookie);
  registerAuthGuard(app, authService);
  app.register(createPublicStatusRoutes(probe));
  app.register(createAuthRoutes(authService, true), { prefix: "/api/auth" });
  app.register(async (protectedApi) => {
    registerAuthenticatedApiHooks(protectedApi);
    protectedApi.get("/api/v1/production-readiness", async () => ({
      workersAlive: 9,
      queue: { failed: 1 },
    }));
    protectedApi.get("/api/v1/runtime", async () => ({ protected: true }));
  });
  apps.push(app);
  return app;
}

function assertSanitized(body: Record<string, unknown>): void {
  expect(Object.keys(body).sort()).toEqual(["service", "status"]);
  for (const key of SENSITIVE_STATUS_KEYS) {
    expect(body).not.toHaveProperty(key);
    expect(JSON.stringify(body)).not.toContain(key);
  }
}

describe("status publico sanitizado", () => {
  it("resolve disponibilidade sem dados operacionais", () => {
    expect(resolvePublicStatus()).toEqual({
      httpStatus: 200,
      body: PUBLIC_STATUS_OK,
    });
    expect(resolvePublicStatus(() => undefined)).toEqual({
      httpStatus: 200,
      body: PUBLIC_STATUS_OK,
    });
    expect(
      resolvePublicStatus(() => {
        throw new Error("falha interna com stack e DATABASE_URL");
      }),
    ).toEqual({
      httpStatus: 503,
      body: PUBLIC_STATUS_UNAVAILABLE,
    });
  });

  it("GET /api/status e publico e sanitizado sem cookie", async () => {
    const app = buildStatusApp();
    const response = await app.inject({ method: "GET", url: "/api/status" });
    expect(response.statusCode).toBe(200);
    const body = response.json() as Record<string, unknown>;
    expect(body).toEqual(PUBLIC_STATUS_OK);
    assertSanitized(body);
  });

  it("nao espelha production-readiness nem dados de infraestrutura", async () => {
    const app = buildStatusApp();
    const status = await app.inject({ method: "GET", url: "/api/status" });
    const body = status.json() as Record<string, unknown>;
    expect(body).not.toHaveProperty("readiness");
    expect(body).not.toHaveProperty("workers");
    expect(body).not.toHaveProperty("queue");
    expect(body).not.toHaveProperty("database");
    expect(JSON.stringify(body)).not.toMatch(/secret|password|token/i);
  });

  it("production-readiness e runtime continuam exigindo sessao", async () => {
    const app = buildStatusApp();
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/production-readiness",
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (await app.inject({ method: "GET", url: "/api/v1/runtime" })).statusCode,
    ).toBe(401);
  });

  it("falha interna retorna 503 sem revelar a causa", async () => {
    const app = buildStatusApp(() => {
      throw new Error("Prisma P1001 DATABASE_URL=secret");
    });
    const response = await app.inject({ method: "GET", url: "/api/status" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual(PUBLIC_STATUS_UNAVAILABLE);
    expect(response.body).not.toContain("Prisma");
    expect(response.body).not.toContain("DATABASE_URL");
    expect(response.body).not.toContain("secret");
  });

  it("aplica o rate limit de health/status", async () => {
    const app = buildStatusApp();
    for (let request = 0; request < HEALTH_RATE_LIMIT.max; request += 1) {
      expect(
        (await app.inject({ method: "GET", url: "/api/status" })).statusCode,
      ).toBe(200);
    }
    expect(
      (await app.inject({ method: "GET", url: "/api/status" })).statusCode,
    ).toBe(429);
  });
});
