import { Specialization } from "@operaia/employee-framework";
import { describe, expect, it } from "vitest";
import { createLabRuntime } from "./lab-runtime.js";

const AUTH_OBJECTIVE = "Quero implementar autenticação.";

describe("Digital Team — Fase final de operação", () => {
  it("missão de autenticação: CEO → Mag → consolidação + métricas", async () => {
    const lab = createLabRuntime({ deterministic: true });
    const run = await lab.operations.service.run({
      workspaceId: "nexo",
      objective: AUTH_OBJECTIVE,
      employeeId: "operaia-ceo",
    });

    expect(run.mission.initial.employeeId).toBe("operaia-ceo");
    expect(run.mission.initial.output.decision.delegations[0]?.specialization).toBe(
      Specialization.SOFTWARE_ENGINEERING,
    );
    expect(run.mission.outcomes.some((o) => o.employeeId === "cto-mag")).toBe(true);

    const magReport = run.mission.outcomes.find((o) => o.employeeId === "cto-mag")
      ?.result?.output.report;
    expect(magReport?.analysis.length).toBeGreaterThan(0);
    expect(magReport?.summary.length).toBeGreaterThan(0);
    expect(magReport?.plan.length).toBeGreaterThan(0);
    expect(magReport?.nextActions.length).toBeGreaterThan(0);

    expect(run.mission.final.employeeId).toBe("operaia-ceo");
    expect(run.reply.employeeId).toBe("operaia-ceo");
    expect(run.usableResult.length).toBeGreaterThan(0);
    expect(run.status).toBe("completed");

    expect(run.timing.ceoMs).toBeGreaterThanOrEqual(0);
    expect(run.timing.specialistMs).toBeGreaterThanOrEqual(0);
    expect(run.timing.consolidationMs).toBeGreaterThanOrEqual(0);
    expect(run.timing.totalMs).toBeGreaterThanOrEqual(0);

    expect(run.llmEvents.filter((e) => e.type === "call_succeeded")).toHaveLength(3);
  });

  it("missão consultiva: CEO responde imediato sem Mag (menos LLM)", async () => {
    const lab = createLabRuntime({ deterministic: true });
    const run = await lab.operations.service.run({
      workspaceId: "nexo",
      objective: "Como estão meus projetos?",
      employeeId: "operaia-ceo",
    });

    expect(run.mission.outcomes).toHaveLength(0);
    expect(run.mission.final).toBe(run.mission.initial);
    expect(run.timing.specialistMs).toBe(0);
    expect(run.timing.consolidationMs).toBe(0);
    expect(run.llmEvents.filter((e) => e.type === "call_succeeded")).toHaveLength(0);
    expect(run.usableResult.length).toBeGreaterThan(0);
  });
});
