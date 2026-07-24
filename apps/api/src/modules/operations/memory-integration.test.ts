import { randomUUID } from "node:crypto";
import { Specialization } from "@operaia/employee-framework";
import { InMemoryMemoryStore } from "@operaia/workspace-runtime";
import { describe, expect, it } from "vitest";
import { createLabRuntime } from "./lab-runtime.js";

const NEXO_AUTH_OBJECTIVE = "Quero adicionar autenticação ao NEXO.";

const PRIOR_AUTH_MEMORY =
  "Workspace: nexo\nObjetivo: autenticação NEXO\nResumo: Decisão prévia — usar sessão + JWT no NEXO.";

describe("Digital Team Online — Fase 2.1 Memory Integration", () => {
  it("missão sem memória: briefing sem memoryContext", async () => {
    const lab = createLabRuntime({ deterministic: true });
    const run = await lab.operations.service.run({
      workspaceId: "nexo",
      objective: NEXO_AUTH_OBJECTIVE,
      employeeId: "operaia-ceo",
    });

    expect(run.mission.initial.briefing.additional?.memoryContext).toBeUndefined();
    expect(
      run.mission.outcomes.find((o) => o.matched)?.result?.briefing.additional
        ?.memoryContext,
    ).toBeUndefined();
  });

  it("missão com memória existente: CEO consulta antes de delegar", async () => {
    const memory = new InMemoryMemoryStore();
    await memory.store({
      id: randomUUID(),
      content: PRIOR_AUTH_MEMORY,
      metadata: { workspaceId: "nexo", kind: "operational-run-summary" },
    });

    const lab = createLabRuntime({ deterministic: true, memoryStore: memory });
    const run = await lab.operations.service.run({
      workspaceId: "nexo",
      objective: NEXO_AUTH_OBJECTIVE,
      employeeId: "operaia-ceo",
    });

    const ceoMemory = run.mission.initial.briefing.additional?.memoryContext as
      | readonly string[]
      | undefined;
    expect(ceoMemory).toBeDefined();
    expect(ceoMemory!.some((note) => note.includes("sessão + JWT"))).toBe(true);
    expect(run.mission.initial.briefing.history.some((h) => h.includes("JWT"))).toBe(
      true,
    );
    expect(run.mission.initial.output.decision.delegations.length).toBeGreaterThan(0);
  });

  it("memória entregue ao especialista (Mag)", async () => {
    const memory = new InMemoryMemoryStore();
    await memory.store({
      id: randomUUID(),
      content: PRIOR_AUTH_MEMORY,
      metadata: { workspaceId: "nexo", kind: "operational-run-summary" },
    });

    const lab = createLabRuntime({ deterministic: true, memoryStore: memory });
    const run = await lab.operations.service.run({
      workspaceId: "nexo",
      objective: NEXO_AUTH_OBJECTIVE,
      employeeId: "operaia-ceo",
    });

    const mag = run.mission.outcomes.find(
      (o) => o.matched && o.employeeId === "cto-mag",
    );
    expect(mag?.result).toBeDefined();
    const magMemory = mag!.result!.briefing.additional?.memoryContext as
      | readonly string[]
      | undefined;
    expect(magMemory).toBeDefined();
    expect(magMemory!.some((note) => note.includes("NEXO"))).toBe(true);
  });

  it("memória persistida após consolidação e recuperável na missão seguinte", async () => {
    const memory = new InMemoryMemoryStore();
    const lab = createLabRuntime({ deterministic: true, memoryStore: memory });

    const first = await lab.operations.service.run({
      workspaceId: "nexo",
      objective: NEXO_AUTH_OBJECTIVE,
      employeeId: "operaia-ceo",
    });

    const stored = await memory.search({
      text: NEXO_AUTH_OBJECTIVE,
      topK: 5,
      filter: { workspaceId: "nexo" },
    });
    expect(stored.length).toBeGreaterThan(0);
    expect(stored.some((s) => s.record.metadata?.missionId === first.id)).toBe(
      true,
    );
    expect(stored[0]?.record.content).toContain(NEXO_AUTH_OBJECTIVE);

    const second = await lab.operations.service.run({
      workspaceId: "nexo",
      objective: NEXO_AUTH_OBJECTIVE,
      employeeId: "operaia-ceo",
    });

    const ceoMemory = second.mission.initial.briefing.additional?.memoryContext as
      | readonly string[]
      | undefined;
    expect(ceoMemory).toBeDefined();
    expect(
      ceoMemory!.some(
        (note) =>
          note.includes(first.id) === false &&
          (note.includes(NEXO_AUTH_OBJECTIVE) || note.includes("Resumo:")),
      ),
    ).toBe(true);
  });

  it("regressão NEXO: CEO → Mag → consolidação → OperationalRun", async () => {
    const lab = createLabRuntime({ deterministic: true });
    const { reply, workflow, missionId } = await lab.team.ask({
      employeeId: "operaia-ceo",
      workspaceId: "nexo",
      question: NEXO_AUTH_OBJECTIVE,
    });

    const run = lab.operations.store.get(missionId)!;
    expect(run.status).toBe("completed");
    expect(run.mission.initial.output.decision.delegations[0]?.specialization).toBe(
      Specialization.SOFTWARE_ENGINEERING,
    );
    expect(run.mission.outcomes.some((o) => o.employeeId === "cto-mag")).toBe(true);
    expect(run.mission.final.employeeId).toBe("operaia-ceo");
    expect(reply.employeeId).toBe("operaia-ceo");
    expect(workflow.steps.find((s) => s.stage === "DONE")?.actorId).toBe(
      "operaia-ceo",
    );
    expect(reply.content.length).toBeGreaterThan(0);

    const persisted = await lab.memory.search({
      text: NEXO_AUTH_OBJECTIVE,
      filter: { workspaceId: "nexo" },
    });
    expect(persisted.some((s) => s.record.metadata?.missionId === missionId)).toBe(
      true,
    );
  });
});
