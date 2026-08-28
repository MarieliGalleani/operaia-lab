import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthRoutes } from "../auth/auth.routes.js";
import { AuthService } from "../auth/auth-service.js";
import { registerAuthGuard } from "../auth/auth-guard.js";
import { registerAuthenticatedApiHooks } from "../auth/authenticated-api.js";
import type { PasswordHasher } from "../auth/auth.types.js";
import { InMemoryAuthRepository } from "../auth/in-memory-auth-repository.test-helper.js";
import { errorHandler } from "../../shared/error-handler.js";
import { createAutomationOfficeRoutes } from "./automation-office.routes.js";

const LOGIN = "admin@operaia.com.br";
const PASSWORD = "test-only-password-never-use";
const apps: FastifyInstance[] = [];

const prismaMock = vi.hoisted(() => ({
  officeDemand: {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  officeApprovalRequest: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  officeDecisionTrace: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
  },
  officeAutomation: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
  },
  mission: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  // ... keep officeDemand with updateMany

  workspaceSourceBinding: {
    findMany: vi.fn(),
  },
}));

vi.mock("@operaia/database", () => ({
  prisma: prismaMock,
  MissionStatus: {
    CREATED: "CREATED",
    QUEUED: "QUEUED",
    RUNNING: "RUNNING",
    WAITING: "WAITING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
    CANCELLED: "CANCELLED",
  },
}));

vi.mock("../office/build-office-status.js", () => ({
  buildOfficeStatus: vi.fn(async () => ({
    generatedAt: new Date().toISOString(),
    degradations: [],
    status: {
      level: "OPERATING" as const,
      label: "OPERANDO",
      summary: "OK",
      healthOk: true,
      readyOk: true,
      workers: { alive: 0, expected: 0, busy: 0, available: 0 },
    },
    activity: { idle: true },
    attention: { items: [] },
    humanAction: { proposals: [] },
    completed: { items: [] },
  })),
}));

const enqueueMock = vi.fn(async () => ({
  mission: { id: "mission-test-1" },
  created: true,
}));

const deps = {
  runtime: {} as never,
  operations: { service: {} } as never,
  workGovernanceGate: {
    admit: vi.fn(async () => ({
      decision: "EXECUTE",
      reason: "ok",
      resultingMissionId: null,
      workIdentity: "wi",
    })),
    bindExecute: vi.fn(async () => undefined),
  },
  queue: {
    enqueue: enqueueMock,
    get: vi.fn(),
    listChildren: vi.fn(),
  },
};

const testHasher: PasswordHasher = {
  hash: async (password) => `test-hash:${password}`,
  verify: async (hash, password) => hash === `test-hash:${password}`,
};

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.clearAllMocks();
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
    protectedApi.register(createAutomationOfficeRoutes(deps as never), {
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

function sessionCookie(response: Awaited<ReturnType<typeof login>>) {
  const value = response.headers["set-cookie"];
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw).split(";")[0]!;
}

describe("Automation Office HTTP", () => {
  beforeEach(() => {
    prismaMock.officeApprovalRequest.count.mockResolvedValue(0);
    prismaMock.officeApprovalRequest.findMany.mockResolvedValue([]);
    prismaMock.officeDecisionTrace.findMany.mockResolvedValue([]);
    prismaMock.officeDecisionTrace.count.mockResolvedValue(0);
    prismaMock.mission.findMany.mockResolvedValue([]);
    prismaMock.officeAutomation.findMany.mockResolvedValue([]);
    prismaMock.officeAutomation.count.mockResolvedValue(0);
    prismaMock.mission.count.mockResolvedValue(0);
  });

  it("GET /office/command exige autenticação", async () => {
    const app = buildApp();
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/office/command",
    });
    expect(response.statusCode).toBe(401);
  });

  it("GET /office/command retorna agregação api", async () => {
    const app = buildApp();
    await app.ready();
    const cookieHeader = sessionCookie(await login(app));
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/office/command",
      headers: { cookie: cookieHeader },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { source: string; backendDependency: boolean };
    expect(body.source).toBe("api");
    expect(body.backendDependency).toBe(false);
  });

  it("POST /office/demands interpreta demanda", async () => {
    prismaMock.officeDemand.create.mockResolvedValue({
      id: "demand-1",
      workspaceId: "operaia-lab",
      status: "INTERPRETING",
    });
    prismaMock.officeDemand.update.mockResolvedValue({
      id: "demand-1",
      workspaceId: "operaia-lab",
      status: "PLANNED",
    });
    prismaMock.officeDecisionTrace.create.mockResolvedValue({ id: "trace-1" });

    const app = buildApp();
    await app.ready();
    const cookieHeader = sessionCookie(await login(app));
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/office/demands",
      headers: { cookie: cookieHeader },
      payload: {
        text: "Organizar entregas do sprint",
        workspaceId: "operaia-lab",
      },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { brief: { demandId: string } };
    expect(body.brief.demandId).toBe("demand-1");
    expect(prismaMock.officeDecisionTrace.create).toHaveBeenCalled();
  });

  it("POST /office/demands/:id/execute delega ao Core via queue", async () => {
    prismaMock.officeDemand.findUnique.mockResolvedValue({
      id: "demand-1",
      workspaceId: "operaia-lab",
      status: "READY",
      objective: "Executar tarefa",
      context: "ctx",
      risk: "LOW",
      approvals: [],
    });
    prismaMock.officeDemand.update.mockResolvedValue({});
    prismaMock.officeDecisionTrace.create.mockResolvedValue({ id: "trace-2" });

    const app = buildApp();
    await app.ready();
    const cookieHeader = sessionCookie(await login(app));
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/office/demands/demand-1/execute",
      headers: { cookie: cookieHeader },
      payload: { autonomy: "CONTROLLED" },
    });
    expect(response.statusCode).toBe(200);
    expect(enqueueMock).toHaveBeenCalled();
    const body = response.json() as { missionId: string; redirectTo: string };
    expect(body.missionId).toBe("mission-test-1");
    expect(body.redirectTo).toContain("/app/missions/");
  });

  it("bloqueia workspace não oficial (403)", async () => {
    const app = buildApp();
    await app.ready();
    const cookieHeader = sessionCookie(await login(app));
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/office/demands",
      headers: { cookie: cookieHeader },
      payload: {
        text: "Teste",
        workspaceId: "workspace-inexistente",
      },
    });
    expect(response.statusCode).toBe(403);
  });

  it("approval approve atualiza status", async () => {
    prismaMock.officeApprovalRequest.findUnique.mockResolvedValue({
      id: "ap-1",
      workspaceId: "operaia-lab",
      demandId: "demand-1",
      status: "PENDING",
      action: "Aprovar",
      reason: "r",
      impact: "i",
      risk: "LOW",
    });
    prismaMock.officeApprovalRequest.update.mockResolvedValue({
      id: "ap-1",
      status: "APPROVED",
    });
    prismaMock.officeDemand.update.mockResolvedValue({});
    prismaMock.officeDecisionTrace.create.mockResolvedValue({ id: "t" });

    const app = buildApp();
    await app.ready();
    const cookieHeader = sessionCookie(await login(app));
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/office/approvals/ap-1/approve",
      headers: { cookie: cookieHeader },
      payload: {},
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { status: string };
    expect(body.status).toBe("APPROVED");
  });

  it("GET /office/executions projeta missões sem tabela Execution", async () => {
    prismaMock.mission.findMany.mockResolvedValue([
      {
        id: "m-1",
        workspaceId: "operaia-lab",
        objective: "Obj",
        status: "RUNNING",
        startedAt: new Date(),
        finishedAt: null,
      },
    ]);

    const app = buildApp();
    await app.ready();
    const cookieHeader = sessionCookie(await login(app));
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/office/executions",
      headers: { cookie: cookieHeader },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as Array<{ status: string }>;
    expect(body[0]?.status).toBe("RUNNING");
  });

  it("workspace context não expõe secrets", async () => {
    prismaMock.mission.count.mockResolvedValue(1);
    prismaMock.officeAutomation.count.mockResolvedValue(0);
    prismaMock.officeDecisionTrace.count.mockResolvedValue(0);
    prismaMock.officeApprovalRequest.count.mockResolvedValue(0);
    prismaMock.workspaceSourceBinding.findMany.mockResolvedValue([
      {
        id: "b-1",
        sourceType: "github",
        externalRef: "owner/repo",
        secretRef: "vault:github-token",
      },
    ]);

    const app = buildApp();
    await app.ready();
    const cookieHeader = sessionCookie(await login(app));
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/office/workspaces/operaia-lab/context",
      headers: { cookie: cookieHeader },
    });
    expect(response.statusCode).toBe(200);
    const raw = response.body;
    expect(raw).not.toContain("vault:github-token");
    expect(raw).not.toContain("password");
    expect(raw).not.toContain("secret");
  });
});

describe("GET /office/command degraded", () => {
  it("retorna 503 quando health crítico falha", async () => {
    const { buildOfficeStatus } = await import("../office/build-office-status.js");
    vi.mocked(buildOfficeStatus).mockResolvedValueOnce({
      generatedAt: new Date().toISOString(),
      degradations: ["Ready/database indisponível."],
      status: {
        level: "PROBLEM",
        label: "PROBLEMA",
        summary: "Falha",
        healthOk: false,
        readyOk: false,
      },
      activity: { idle: false },
      attention: { items: [] },
      humanAction: { proposals: [] },
      completed: { items: [] },
    } as never);

    const app = buildApp();
    await app.ready();
    const cookieHeader = sessionCookie(await login(app));
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/office/command",
      headers: { cookie: cookieHeader },
    });
    expect(response.statusCode).toBe(503);
    const body = response.json() as { code: string; degradations: string[] };
    expect(body.code).toBe("OFFICE_UNAVAILABLE");
    expect(body.degradations.length).toBeGreaterThan(0);
  });
});
