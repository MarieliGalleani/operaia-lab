import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ArgonPasswordHasher } from "./argon-password-hasher.js";
import { createAuthRoutes } from "./auth.routes.js";
import { AuthService } from "./auth-service.js";
import {
  registerAuthGuard,
  SESSION_COOKIE_NAME,
} from "./auth-guard.js";
import { InMemoryAuthRepository } from "./in-memory-auth-repository.test-helper.js";

const LOGIN = "admin@operaia.com.br";
const PASSWORD = "test-only-password-never-use";
const hasher = new ArgonPasswordHasher();
let passwordHash = "";
const apps: FastifyInstance[] = [];

beforeAll(async () => {
  passwordHash = await hasher.hash(PASSWORD);
});

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function buildAuthApp(input?: {
  active?: boolean;
  now?: () => Date;
  sessionTtlMs?: number;
}) {
  const repository = new InMemoryAuthRepository();
  repository.addUser({
    login: LOGIN,
    passwordHash,
    active: input?.active ?? true,
  });
  const service = new AuthService(repository, hasher, {
    now: input?.now,
    sessionTtlMs: input?.sessionTtlMs,
  });
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.register(cookie);
  app.register(rateLimit, { global: false });
  registerAuthGuard(app, service);
  app.register(createAuthRoutes(service, true), { prefix: "/api/auth" });
  apps.push(app);
  return { app, repository };
}

async function login(app: FastifyInstance, password = PASSWORD) {
  return app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { login: LOGIN, password },
  });
}

function readSessionCookie(response: Awaited<ReturnType<typeof login>>) {
  const value = response.headers["set-cookie"];
  const header = Array.isArray(value) ? value[0] : value;
  expect(header).toBeTypeOf("string");
  const pair = header!.split(";")[0]!;
  return { header: header!, pair, token: pair.split("=")[1]! };
}

describe("fundacao de identidade single-admin", () => {
  it("faz login, persiste apenas hash e identifica o admin em /me", async () => {
    const { app, repository } = buildAuthApp();
    expect(passwordHash).toMatch(/^\$argon2id\$/);
    expect(passwordHash).not.toContain(PASSWORD);
    const response = await login(app);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: { id: expect.any(String), login: LOGIN, role: "ADMIN" },
    });

    const sessionCookie = readSessionCookie(response);
    expect(sessionCookie.header).toContain("HttpOnly");
    expect(sessionCookie.header).toContain("Secure");
    expect(sessionCookie.header).toContain("SameSite=Strict");
    expect(sessionCookie.header).toContain("Path=/");
    expect(sessionCookie.header).toContain("Expires=");
    expect(response.body).not.toContain(sessionCookie.token);
    expect(repository.listSessionTokenHashes()).toEqual([
      expect.stringMatching(/^[a-f0-9]{64}$/),
    ]);
    expect(repository.listSessionTokenHashes()).not.toContain(sessionCookie.token);

    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: sessionCookie.pair },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toEqual(response.json());
    expect(me.body).not.toContain("passwordHash");
  });

  it("retorna erro generico para login ou senha invalidos", async () => {
    const { app } = buildAuthApp();
    const unknown = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { login: "unknown@operaia.com.br", password: "invalid" },
    });
    const wrongPassword = await login(app, "invalid");
    expect(unknown.statusCode).toBe(401);
    expect(wrongPassword.statusCode).toBe(401);
    expect(unknown.json()).toEqual(wrongPassword.json());
    expect(unknown.json()).toEqual({
      code: "INVALID_CREDENTIALS",
      message: "Credenciais invalidas.",
    });
  });

  it("impede login de usuario inativo", async () => {
    const { app } = buildAuthApp({ active: false });
    expect((await login(app)).statusCode).toBe(401);
  });

  it("invalida sessao existente quando o usuario e desativado", async () => {
    const { app, repository } = buildAuthApp();
    const sessionCookie = readSessionCookie(await login(app));
    repository.setUserActive(LOGIN, false);
    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: sessionCookie.pair },
    });
    expect(me.statusCode).toBe(401);
  });

  it("rejeita acesso sem sessao ou com sessao invalida", async () => {
    const { app } = buildAuthApp();
    const missing = await app.inject({ method: "GET", url: "/api/auth/me" });
    const invalid = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: `${SESSION_COOKIE_NAME}=invalid` },
    });
    expect(missing.statusCode).toBe(401);
    expect(invalid.statusCode).toBe(401);
  });

  it("rejeita sessao expirada", async () => {
    let now = new Date("2026-08-18T04:00:00.000Z");
    const { app } = buildAuthApp({
      now: () => now,
      sessionTtlMs: 1_000,
    });
    const sessionCookie = readSessionCookie(await login(app));
    now = new Date("2026-08-18T04:00:01.001Z");
    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: sessionCookie.pair },
    });
    expect(me.statusCode).toBe(401);
  });

  it("logout autenticado revoga a sessao e limpa o cookie", async () => {
    const { app } = buildAuthApp();
    const sessionCookie = readSessionCookie(await login(app));
    const logout = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { cookie: sessionCookie.pair },
    });
    expect(logout.statusCode).toBe(204);
    expect(String(logout.headers["set-cookie"])).toContain(
      `${SESSION_COOKIE_NAME}=;`,
    );
    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: sessionCookie.pair },
    });
    expect(me.statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/logout",
          headers: { cookie: sessionCookie.pair },
        })
      ).statusCode,
    ).toBe(401);
  });

  it("limita tentativas repetidas de login", async () => {
    const { app } = buildAuthApp();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await login(app, "invalid")).statusCode).toBe(401);
    }
    expect((await login(app, "invalid")).statusCode).toBe(429);
  });
});
