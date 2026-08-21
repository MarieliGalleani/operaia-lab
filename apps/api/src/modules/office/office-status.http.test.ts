import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuthRoutes } from "../auth/auth.routes.js";
import { AuthService } from "../auth/auth-service.js";
import { registerAuthGuard } from "../auth/auth-guard.js";
import { registerAuthenticatedApiHooks } from "../auth/authenticated-api.js";
import type { PasswordHasher } from "../auth/auth.types.js";
import { InMemoryAuthRepository } from "../auth/in-memory-auth-repository.test-helper.js";
import { errorHandler } from "../../shared/error-handler.js";
import { createOfficeStatusRoutes } from "./office-status.routes.js";

const LOGIN = "admin@operaia.com.br";
const PASSWORD = "test-only-password-never-use";
const apps: FastifyInstance[] = [];

vi.mock("./build-office-status.js", () => ({
  buildOfficeStatus: vi.fn(async () => ({
    generatedAt: new Date().toISOString(),
    windowHours: 24,
    status: {
      level: "OPERATING" as const,
      label: "OPERANDO",
      summary: "Todos os sistemas principais estão funcionando.",
      reasons: [] as string[],
      healthOk: true,
      readyOk: true,
      supervisor: {
        running: true,
        cycle: 1,
        lastSnapshotAt: new Date().toISOString(),
        uptimeMs: 1000,
      },
      workers: { alive: 9, expected: 9, busy: 0, available: 9 },
      queue: { queued: 0, running: 0, waiting: 0, failedHistorical: 0 },
      uptimeMs: 1000,
    },
    activity: {
      idle: true,
      message: "Sem trabalho pendente.",
      missionsRunning: 0,
      missionsQueued: 0,
      missionsWaiting: 0,
      workersBusy: 0,
      workersAvailable: 9,
      runningObjectives: [] as { id: string; objective: string }[],
    },
    attention: {
      items: [] as {
        severity: "blocker" | "critical" | "warning" | "info";
        code: string;
        title: string;
        detail: string;
      }[],
      failed: {
        historicalTotal: 0,
        newInWindow: 0,
        note: "ok",
      },
    },
    governance: {
      gate: {
        windowHours: 24,
        execute: 0,
        skip: 0,
        reuse: 0,
        reopen: 0,
        recent: [] as {
          decision: string;
          reason: string;
          source: string;
          createdAt: string;
        }[],
      },
      policy: {
        deferInWindow: 0,
        ignoreInWindow: 0,
        convertCandidateInWindow: 0,
        note: "ok",
      },
    },
    completed: {
      items: [] as {
        id: string;
        title: string;
        finishedAt: string | null;
        kind: string;
      }[],
      emptyMessage: "Nenhuma entrega concluída nas últimas 24h.",
    },
    humanAction: {
      needed: false,
      message: "Você não precisa fazer nada agora.",
      proposals: [] as {
        id: string;
        title: string;
        status: string;
        createdAt: string;
      }[],
    },
    sources: {
      health: "ok" as const,
      ready: "ok" as const,
      runtime: "ok" as const,
      gate: "ok" as const,
      signals: "ok" as const,
      missions: "ok" as const,
      governance: "ok" as const,
    },
    degradations: [] as string[],
  })),
}));

const testHasher: PasswordHasher = {
  hash: async (password) => `test-hash:${password}`,
  verify: async (hash, password) => hash === `test-hash:${password}`,
};

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function buildApp() {
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
  app.register(cookie);
  registerAuthGuard(app, authService);
  app.register(createAuthRoutes(authService, false), { prefix: "/api/auth" });
  app.register(async (protectedApi) => {
    registerAuthenticatedApiHooks(protectedApi);
    protectedApi.register(createOfficeStatusRoutes({} as never), {
      prefix: "/api/v1",
    });
  });
  apps.push(app);
  return app;
}

async function login(app: FastifyInstance) {
  return app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { login: LOGIN, password: PASSWORD },
  });
}

function readSessionCookie(response: Awaited<ReturnType<typeof login>>) {
  const value = response.headers["set-cookie"];
  const raw = Array.isArray(value) ? value[0] : value;
  expect(raw).toBeTruthy();
  return String(raw).split(";")[0]!;
}

describe("GET /api/v1/office/status", () => {
  it("exige autenticação (401)", async () => {
    const app = buildApp();
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/office/status",
    });
    expect(response.statusCode).toBe(401);
  });

  it("retorna agregador autenticado (200)", async () => {
    const app = buildApp();
    await app.ready();
    const cookieHeader = readSessionCookie(await login(app));
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/office/status",
      headers: { cookie: cookieHeader },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      status: { level: string };
      activity: { message: string };
      humanAction: { needed: boolean };
    };
    expect(body.status.level).toBe("OPERATING");
    expect(body.activity.message).toBe("Sem trabalho pendente.");
    expect(body.humanAction.needed).toBe(false);
  });
});
