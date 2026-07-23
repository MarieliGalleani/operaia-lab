/**
 * Rotas HTTP de smoke da Equipe Digital (Fastify inject).
 * Usa WorkspaceSource em memoria — nao depende de Prisma nesta suite.
 */
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { beforeAll, describe, expect, it } from "vitest";
import { createWorkspaceRoutes } from "../workspaces/workspaces.routes.js";
import { EmployeesApplication } from "./employees.application.js";
import { createEmployeeRoutes } from "./employees.routes.js";
import { InMemoryWorkspaceSource } from "./in-memory-workspace-source.js";
import { buildTestWorkspaceCatalog } from "./test-workspace-catalog.js";

describe("Etapa 4 — HTTP com snapshot de Workspace", () => {
  const application = new EmployeesApplication({
    workspaces: new InMemoryWorkspaceSource(buildTestWorkspaceCatalog()),
  });
  const app = Fastify().withTypeProvider<ZodTypeProvider>();

  beforeAll(async () => {
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(createEmployeeRoutes(application), {
      prefix: "/api/v1/employees",
    });
    await app.register(createWorkspaceRoutes(application), {
      prefix: "/api/v1/workspaces",
    });
    await app.ready();
  });

  it("GET /employees lista Opera e Mag", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/employees",
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { id: string }[];
    expect(body.map((p) => p.id)).toEqual(["operaia-ceo", "cto-mag"]);
  });

  it("POST /ask usa tarefas do snapshot e devolve workflow real", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/employees/operaia-ceo/ask",
      payload: { workspaceId: "nexo", question: "Status da NEXO?" },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      employeeId: string;
      content: string;
      answer: { summary: string };
    };
    expect(body.employeeId).toBe("operaia-ceo");
    expect(body.content.length).toBeGreaterThan(0);

    const tasks = await app.inject({
      method: "GET",
      url: "/api/v1/workspaces/nexo/tasks",
    });
    expect(tasks.statusCode).toBe(200);
    const taskBody = tasks.json() as { title: string }[];
    expect(taskBody.some((t) => t.title === "Implementar autenticacao")).toBe(
      true,
    );

    const workflow = await app.inject({
      method: "GET",
      url: "/api/v1/workspaces/nexo/workflow",
    });
    expect(workflow.statusCode).toBe(200);
    const wf = workflow.json() as {
      steps: { stage: string; actorId: string }[];
    };
    expect(
      wf.steps.some((s) => s.stage === "EXECUTING" && s.actorId === "cto-mag"),
    ).toBe(true);
  });

  it("GET /workspaces lista projetos do source", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/workspaces",
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { name: string }[];
    expect(body.map((w) => w.name)).toEqual(["NEXO", "MenuFlow", "Plataforma"]);
  });
});
