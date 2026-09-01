import { describe, expect, it, vi } from "vitest";
import { createHttpGateways } from "@/data/adapters/http-gateways";
import { createMockGateways } from "@/data/adapters/mock-gateways";
import type { HttpClient } from "@/data/adapters/http-client";
import { CompositeOfficeService } from "@/data/composite-office-service";
import type { OfficeGateways } from "@/data/gateways/office-gateways";

describe("Gateways mock — cada sistema do backend", () => {
  const gateways = createMockGateways();

  it("Employee Registry lista a Equipe Digital contratada", async () => {
    const profiles = await gateways.registry.listProfiles();
    expect(profiles.map((p) => p.id)).toEqual([
      "operaia-ceo",
      "cto-mag",
      "luna",
      "nexus",
      "atlas",
      "aurora",
      "themis",
      "mercurio",
      "orion",
    ]);
  });

  it("Workspace Runtime lista workspaces e tarefas por workspace", async () => {
    expect((await gateways.workspaces.listWorkspaces())).toHaveLength(3);
    const nexoTasks = await gateways.workspaces.listTasks("nexo");
    expect(nexoTasks.every((t) => t.workspaceId === "nexo")).toBe(true);
  });

  it("Sessions abre uma sessão RUNNING e a recupera", async () => {
    const created = await gateways.sessions.startSession("nexo", "Finalizar");
    expect(created.status).toBe("RUNNING");
    const state = await gateways.sessions.getSession("nexo", created.id);
    expect(state.id).toBe(created.id);
    expect(state.objective).toBe("Finalizar");
  });

  it("Orchestration Events lista eventos do ciclo de vida", async () => {
    const events = await gateways.events.listEvents("nexo");
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.workspaceId === "nexo")).toBe(true);
  });

  it("Employee Runtime responde como o CEO (formato executivo)", async () => {
    const reply = await gateways.runtime.ask("operaia-ceo", "nexo", "status?");
    expect(reply.employeeId).toBe("operaia-ceo");
    expect(reply.answer.projects.length).toBeGreaterThan(0);
  });
});

describe("CompositeOfficeService — desacoplado dos gateways", () => {
  it("funciona com gateways falsos (prova a substituibilidade)", async () => {
    const fake: OfficeGateways = {
      registry: {
        listProfiles: async () => [
          {
            id: "operaia-ceo",
            name: "Opera",
            role: "CEO",
            specialization: "MANAGEMENT",
            mission: "m",
            capabilities: [],
            permissions: [],
            limits: [],
          },
        ],
        getProfile: async () => undefined,
      },
      runtime: {
        getStatuses: async () => [
          {
            employeeId: "operaia-ceo",
            status: "WORKING",
            statusLabel: "Trabalhando",
            lastActivity: "agora",
          },
        ],
        ask: async (employeeId) => ({
          employeeId,
          content: "ok",
          answer: { summary: "s", projects: ["NEXO"], risks: [], nextActions: [] },
        }),
        getWorkflow: async () => undefined,
      },
      workspaces: {
        listWorkspaces: async () => [
          {
            id: "nexo",
            name: "NEXO",
            objective: "obj",
            status: "ACTIVE",
            progress: 50,
            teamIds: ["operaia-ceo"],
            decisions: [],
            projectObjective: null,
            projectContext: null,
            projectConstraints: null,
          },
        ],
        getWorkspace: async () => undefined,
        listTasks: async () => [],
      },
      sessions: {
        startSession: async () => {
          throw new Error("não usado");
        },
        getSession: async () => {
          throw new Error("não usado");
        },
        listSessions: async () => [],
      },
      events: { listEvents: async () => [] },
    };

    const service = new CompositeOfficeService(fake);

    const employees = await service.getEmployees();
    expect(employees).toHaveLength(1);
    expect(employees[0]?.statusLabel).toBe("Trabalhando");

    const summary = await service.getSummary();
    expect(summary.activeProjects).toBe(1);
    expect(summary.workingEmployees).toBe(1);

    const reply = await service.askCeo("como vai?");
    expect(reply.authorName).toBe("CEO — Opera");
  });
});

describe("Adapters HTTP — mapeiam os endpoints reais", () => {
  it("Sessions.startSession faz POST /workspaces/:id/sessions e mapeia a resposta", async () => {
    const post = vi.fn(async () => ({
      sessionId: "session-1",
      status: "RUNNING",
      currentCycle: 1,
    }));
    const client: HttpClient = { get: vi.fn(), post } as unknown as HttpClient;

    const gateways = createHttpGateways(client);
    const session = await gateways.sessions.startSession("nexo", "Finalizar");

    expect(post).toHaveBeenCalledWith("/workspaces/nexo/sessions", {
      objective: "Finalizar",
    });
    expect(session.id).toBe("session-1");
    expect(session.workspaceId).toBe("nexo");
  });

  it("Workspace/Runtime usam os caminhos esperados da API", async () => {
    const get = vi.fn(async () => []);
    const post = vi.fn(async () => ({}));
    const client: HttpClient = { get, post } as unknown as HttpClient;

    const gateways = createHttpGateways(client);
    await gateways.workspaces.listWorkspaces();
    await gateways.runtime.ask("operaia-ceo", "nexo", "oi");

    expect(get).toHaveBeenCalledWith("/workspaces");
    expect(post).toHaveBeenCalledWith("/employees/operaia-ceo/ask", {
      workspaceId: "nexo",
      question: "oi",
    });
  });

  it("Events.listEvents usa GET /missions flat quando o workspace nao tem eventos", async () => {
    const get = vi.fn(async (path: string) => {
      if (path.startsWith("/missions?")) {
        return {
          missions: [
            {
              id: "m-1",
              workspaceId: "operaia-lab",
              objective:
                "[MISSION_INTENT] TECH_IMPLEMENTATION\n\nAnalisar producao.",
              missionKind: "COORDINATE",
              status: "COMPLETED",
              ownerEmployeeId: "operaia-ceo",
              createdAt: "2026-08-15T17:54:54.172Z",
              finishedAt: "2026-08-15T17:54:58.000Z",
            },
            {
              id: "m-2",
              workspaceId: "operaia-lab",
              objective: "Implementar autenticacao",
              missionKind: "CONSOLIDATE",
              status: "COMPLETED",
              ownerEmployeeId: "operaia-ceo",
              createdAt: "2026-08-15T17:54:58.513Z",
            },
          ],
        };
      }
      return [];
    });
    const client: HttpClient = { get, post: vi.fn() } as unknown as HttpClient;
    const gateways = createHttpGateways(client);

    const events = await gateways.events.listEvents();

    expect(get).toHaveBeenCalledWith("/missions?format=flat&take=20");
    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe("m-1");
    expect(events[0]?.kind).toBe("PLAN");
    expect(events[0]?.actorId).toBe("operaia-ceo");
    expect(events[0]?.message).toContain("concluída");
    expect(events[0]?.message).toContain("Analisar producao.");
  });
});
