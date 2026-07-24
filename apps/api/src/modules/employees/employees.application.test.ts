import type { LLMProvider } from "@operaia/ai-core";
import { DeterministicLLMProvider } from "@operaia/ai-core";
import { Specialization } from "@operaia/employee-framework";
import { describe, expect, it } from "vitest";
import { EmployeesApplication } from "./employees.application.js";
import { InMemoryWorkspaceSource } from "./in-memory-workspace-source.js";
import { createDigitalOffice } from "./office-composition.js";
import { buildTestWorkspaceCatalog } from "./test-workspace-catalog.js";
import { WorkflowStore } from "./workflow-store.js";

function appWith(llm: LLMProvider = new DeterministicLLMProvider()) {
  return new EmployeesApplication({
    office: createDigitalOffice({ llm }),
    workflows: new WorkflowStore(),
    workspaces: new InMemoryWorkspaceSource(buildTestWorkspaceCatalog()),
  });
}

describe("Etapa 4 — Snapshot real via WorkspaceSource", () => {
  it("lista workspaces a partir do source (nao catalogo hardcoded)", async () => {
    const app = appWith();
    const workspaces = await app.listWorkspaces();
    expect(workspaces.map((w) => w.name)).toEqual([
      "NEXO",
      "MenuFlow",
      "Plataforma",
    ]);
    expect(workspaces[0]?.progress).toBe(33);
  });

  it("ask alimenta o briefing com tarefas reais do workspace", async () => {
    const app = appWith();
    const { reply, workflow, missionId } = await app.ask({
      employeeId: "operaia-ceo",
      workspaceId: "nexo",
      question: "Quero implementar autenticação.",
    });

    expect(missionId).toBeTruthy();
    expect(app.missionService.get(missionId)?.id).toBe(missionId);
    expect(reply.employeeId).toBe("operaia-ceo");
    expect(reply.content).toContain("Resumo");
    expect(reply.answer.summary.length).toBeGreaterThan(0);

    const tasks = await app.listTasks("nexo");
    expect(tasks.some((t) => t.title === "Implementar autenticacao")).toBe(true);

    expect(workflow.steps.find((s) => s.stage === "EXECUTING")?.actorId).toBe(
      "cto-mag",
    );
    expect(workflow.steps.find((s) => s.stage === "DONE")?.actorId).toBe(
      "operaia-ceo",
    );
  });

  it("ask com pendencias registra delegacao SOFTWARE_ENGINEERING", async () => {
    const app = appWith();
    await app.ask({
      employeeId: "operaia-ceo",
      workspaceId: "nexo",
      question: "Avance a NEXO",
    });

    const workflow = app.getWorkflow("nexo");
    const delegating = workflow?.steps.find((s) => s.stage === "DELEGATING");
    expect(delegating?.detail).toContain(Specialization.SOFTWARE_ENGINEERING);
  });

  it("ask consultivo: CEO responde sem Mag", async () => {
    const app = appWith();
    const { reply, workflow } = await app.ask({
      employeeId: "operaia-ceo",
      workspaceId: "nexo",
      question: "Como esta a NEXO?",
    });

    expect(reply.employeeId).toBe("operaia-ceo");
    expect(workflow.steps.some((s) => s.actorId === "cto-mag")).toBe(false);
    expect(workflow.steps.find((s) => s.stage === "DONE")?.actorId).toBe(
      "operaia-ceo",
    );
  });

  it("falha com workspace inexistente", async () => {
    const app = appWith();
    await expect(
      app.ask({
        employeeId: "operaia-ceo",
        workspaceId: "inexistente",
        question: "oi",
      }),
    ).rejects.toThrow(/Workspace/);
  });

  it("lista toda a Equipe Digital no registry", () => {
    const app = appWith();
    const profiles = app.listProfiles();
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
    expect(profiles.every((p) => p.executable === true)).toBe(true);
  });
});
