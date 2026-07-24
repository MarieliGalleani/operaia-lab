import { Specialization } from "@operaia/employee-framework";
import { describe, expect, it } from "vitest";
import { createLabRuntime } from "./lab-runtime.js";

const NEXO_AUTH_OBJECTIVE = "Quero adicionar autenticação ao NEXO.";

describe("Digital Team Online — canais unificados", () => {
  it("Fase 1.1: ask e Operations usam o mesmo serviço/store", async () => {
    const lab = createLabRuntime({ deterministic: true });

    expect(lab.team.missionService).toBe(lab.operations.service);

    const viaAsk = await lab.team.ask({
      employeeId: "operaia-ceo",
      workspaceId: "nexo",
      question: NEXO_AUTH_OBJECTIVE,
    });

    expect(viaAsk.missionId).toBeTruthy();
    expect(lab.operations.store.get(viaAsk.missionId)?.id).toBe(viaAsk.missionId);
    expect(lab.operations.service.get(viaAsk.missionId)?.objective).toBe(
      NEXO_AUTH_OBJECTIVE,
    );
  });

  it("Fase 1.2: registro operacional completo (missionId, status, historico)", async () => {
    const lab = createLabRuntime({ deterministic: true });
    const { missionId } = await lab.team.ask({
      employeeId: "operaia-ceo",
      workspaceId: "nexo",
      question: NEXO_AUTH_OBJECTIVE,
    });

    const run = lab.operations.store.get(missionId);
    expect(run).toBeDefined();
    expect(run!.status).toBe("completed");
    expect(run!.id).toBe(missionId);
    expect(run!.mission.initial).toBeDefined();
    expect(run!.mission.outcomes.length).toBeGreaterThan(0);
    expect(run!.mission.final).toBeDefined();
    expect(run!.reply.content.length).toBeGreaterThan(0);
    expect(run!.usableResult).toBe(run!.reply.content);
  });

  it("Fase 1.3: CEO consolida apos Mag (resposta unica)", async () => {
    const lab = createLabRuntime({ deterministic: true });
    const { reply, workflow, missionId } = await lab.team.ask({
      employeeId: "operaia-ceo",
      workspaceId: "nexo",
      question: NEXO_AUTH_OBJECTIVE,
    });

    const run = lab.operations.store.get(missionId)!;
    expect(run.mission.outcomes.some((o) => o.matched && o.employeeId === "cto-mag")).toBe(
      true,
    );
    expect(run.mission.final.employeeId).toBe("operaia-ceo");
    expect(run.mission.final.output.decision.delegations).toHaveLength(0);
    expect(reply.employeeId).toBe("operaia-ceo");
    expect(workflow.steps.find((s) => s.stage === "DONE")?.actorId).toBe(
      "operaia-ceo",
    );
  });

  it("Fase 1.4: igualdade de fluxo entre Sala da CEO e Operations", async () => {
    const lab = createLabRuntime({ deterministic: true });

    const viaCeo = await lab.team.ask({
      employeeId: "operaia-ceo",
      workspaceId: "nexo",
      question: NEXO_AUTH_OBJECTIVE,
    });

    const viaOps = await lab.operations.service.run({
      workspaceId: "nexo",
      objective: NEXO_AUTH_OBJECTIVE,
      employeeId: "operaia-ceo",
    });

    const ceoRun = lab.operations.store.get(viaCeo.missionId)!;

    expect(ceoRun.mission.initial.output.decision.delegations[0]?.specialization).toBe(
      Specialization.SOFTWARE_ENGINEERING,
    );
    expect(viaOps.mission.initial.output.decision.delegations[0]?.specialization).toBe(
      Specialization.SOFTWARE_ENGINEERING,
    );

    const ceoSpec = ceoRun.mission.outcomes.find((o) => o.matched)?.employeeId;
    const opsSpec = viaOps.mission.outcomes.find((o) => o.matched)?.employeeId;
    expect(ceoSpec).toBe("cto-mag");
    expect(opsSpec).toBe("cto-mag");

    expect(ceoRun.mission.final.employeeId).toBe("operaia-ceo");
    expect(viaOps.mission.final.employeeId).toBe("operaia-ceo");

    expect(viaCeo.reply.content).toBe(ceoRun.usableResult);
    expect(viaOps.reply.content).toBe(viaOps.usableResult);

    // Deterministic: mesmo objetivo → mesmo conteudo consolidado
    expect(viaCeo.reply.content).toBe(viaOps.reply.content);
    expect(viaCeo.reply.answer.summary).toBe(viaOps.reply.answer.summary);
  });
});
