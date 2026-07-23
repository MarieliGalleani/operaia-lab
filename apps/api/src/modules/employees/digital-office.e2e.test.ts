/**
 * Etapa 7 — Validacao ponta a ponta da Digital Office.
 *
 * Cadeia validada (sem Gemini, sem Employee Framework alterado):
 *   Workspace → Opera → Delegacao → Mag → Consolidacao → Resposta + Workflow + LLM events
 */
import {
  createLLMStack,
  RecordingLLMObserver,
} from "@operaia/ai-core";
import { Specialization } from "@operaia/employee-framework";
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
import { MissionOrchestrator } from "./mission-orchestrator.js";
import { createDigitalOffice } from "./office-composition.js";
import { presentMissionResult } from "./mission-presenter.js";
import { buildTestWorkspaceCatalog } from "./test-workspace-catalog.js";
import { WorkflowStore } from "./workflow-store.js";

function buildE2EOffice() {
  const observer = new RecordingLLMObserver();
  const llm = createLLMStack({
    provider: "deterministic",
    observer,
    enableConsoleObservability: false,
  });
  const office = createDigitalOffice({ llm });
  const workspaces = new InMemoryWorkspaceSource(buildTestWorkspaceCatalog());
  const workflows = new WorkflowStore();
  const application = new EmployeesApplication({ office, workspaces, workflows });
  const orchestrator = new MissionOrchestrator(office);

  return { observer, office, workspaces, workflows, application, orchestrator };
}

describe("Etapa 7 — E2E Digital Office (missao NEXO)", () => {
  it("atravessa Workspace → Opera → Mag → Opera com registro LLM completo", async () => {
    const { observer, workspaces, orchestrator, workflows } = buildE2EOffice();

    // 1. Entrada de missao pelo Workspace
    const snapshot = await workspaces.toSnapshot("nexo");
    expect(snapshot).toBeDefined();
    expect(snapshot?.name).toBe("NEXO");
    expect(snapshot?.tasks.some((t) => t.title.includes("autenticacao"))).toBe(
      true,
    );

    // 2–6. MissionOrchestrator: CEO → Delegacao → Mag → Consolidacao
    const mission = await orchestrator.run("operaia-ceo", {
      workspace: snapshot!,
      objective: "Finalizar desenvolvimento da NEXO",
    });

    // 3. Decisao do CEO (ciclo inicial)
    expect(mission.initial.employeeId).toBe("operaia-ceo");
    expect(mission.initial.briefing.project).toBe("NEXO");
    expect(mission.initial.output.decision.delegations[0]?.specialization).toBe(
      Specialization.SOFTWARE_ENGINEERING,
    );
    expect(mission.initial.output.quality.passed).toBe(true);

    // 4–5. Delegacao + execucao do especialista
    expect(mission.outcomes).toHaveLength(1);
    expect(mission.outcomes[0]?.matched).toBe(true);
    expect(mission.outcomes[0]?.employeeId).toBe("cto-mag");
    expect(mission.outcomes[0]?.result?.output.report.plan.length).toBeGreaterThan(
      0,
    );
    expect(mission.outcomes[0]?.result?.output.quality.passed).toBe(true);

    // 6. Retorno e consolidacao (porta-voz Opera)
    expect(mission.final.employeeId).toBe("operaia-ceo");
    expect(mission.final.output.decision.delegations).toHaveLength(0);
    expect(mission.final.briefing.additional["delegationOutcomes"]).toBeDefined();
    expect(mission.final.output.report.summary).toContain("Consolidei");
    expect(mission.final.output.report.summary).not.toBe(
      mission.outcomes[0]?.result?.output.report.summary,
    );

    // Apresentacao + workflow de auditoria
    const presented = presentMissionResult(mission, "nexo", "NEXO");
    workflows.save(presented.workflow);
    expect(presented.reply.employeeId).toBe("operaia-ceo");
    expect(presented.workflow.steps.map((s) => s.stage)).toEqual([
      "THINKING",
      "ANALYZING",
      "DELEGATING",
      "EXECUTING",
      "REVIEWING",
      "DONE",
    ]);
    expect(
      presented.workflow.steps.find((s) => s.stage === "EXECUTING")?.actorId,
    ).toBe("cto-mag");
    expect(
      presented.workflow.steps.find((s) => s.stage === "DONE")?.actorId,
    ).toBe("operaia-ceo");

    // 7. Registro completo da execucao LLM (3 completes: CEO, Mag, CEO)
    const events = observer.snapshot();
    const started = events.filter((e) => e.type === "call_started");
    const succeeded = events.filter((e) => e.type === "call_succeeded");
    expect(started).toHaveLength(3);
    expect(succeeded).toHaveLength(3);
    expect(events.every((e) => e.type !== "call_failed")).toBe(true);
    // Stack usa Deterministic — desacoplado de Gemini/SDK
    expect(
      succeeded.every(
        (e) => e.type === "call_succeeded" && e.provider.includes("deterministic"),
      ),
    ).toBe(true);
  });

  it("EmployeesApplication.ask expoe a mesma cadeia ao escritorio", async () => {
    const { application, observer } = buildE2EOffice();

    const { reply, workflow } = await application.ask({
      employeeId: "operaia-ceo",
      workspaceId: "nexo",
      question: "Como esta a NEXO?",
    });

    expect(reply.employeeId).toBe("operaia-ceo");
    expect(reply.content).toContain("Resumo");
    expect(reply.answer.summary).toContain("Consolidei");
    expect(workflow.steps.find((s) => s.stage === "DELEGATING")?.detail).toContain(
      Specialization.SOFTWARE_ENGINEERING,
    );
    expect(observer.snapshot().filter((e) => e.type === "call_succeeded")).toHaveLength(
      3,
    );
  });

  it("missao sem pendencias tecnicas: Opera responde sem Mag", async () => {
    const { workspaces, orchestrator, observer } = buildE2EOffice();
    const snapshot = await workspaces.toSnapshot("plataforma");
    expect(snapshot).toBeDefined();

    const mission = await orchestrator.run("operaia-ceo", {
      workspace: {
        ...snapshot!,
        tasks: snapshot!.tasks.map((task) => ({
          ...task,
          status: "DONE" as const,
        })),
      },
      objective: "Fechar a Plataforma",
    });

    expect(mission.outcomes).toHaveLength(0);
    expect(mission.final).toBe(mission.initial);
    expect(mission.final.employeeId).toBe("operaia-ceo");
    // Um unico ciclo LLM (sem Mag nem consolidacao)
    expect(observer.snapshot().filter((e) => e.type === "call_succeeded")).toHaveLength(
      1,
    );
  });
});

describe("Etapa 7 — E2E HTTP (escritorio → API)", () => {
  const { application, observer } = buildE2EOffice();
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

  it("POST /ask percorre a cadeia e GET /workflow audita a missao", async () => {
    observer.clear();

    const ask = await app.inject({
      method: "POST",
      url: "/api/v1/employees/operaia-ceo/ask",
      payload: {
        workspaceId: "nexo",
        question: "Avance a missao da NEXO",
      },
    });
    expect(ask.statusCode).toBe(200);
    const body = ask.json() as {
      employeeId: string;
      answer: { summary: string };
    };
    expect(body.employeeId).toBe("operaia-ceo");
    expect(body.answer.summary).toContain("Consolidei");

    const tasks = await app.inject({
      method: "GET",
      url: "/api/v1/workspaces/nexo/tasks",
    });
    expect(tasks.statusCode).toBe(200);

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
    expect(
      wf.steps.some((s) => s.stage === "DONE" && s.actorId === "operaia-ceo"),
    ).toBe(true);

    expect(observer.snapshot().filter((e) => e.type === "call_succeeded")).toHaveLength(
      3,
    );
  });
});
