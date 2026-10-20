import { describe, expect, it } from "vitest";
import { canExecuteDemand } from "./demand.service.js";

describe("canExecuteDemand — fluxo da Nova demanda (1º andar)", () => {
  it("demanda planejada executa quando a usuaria confirma em Controlado", () => {
    expect(canExecuteDemand({ status: "PLANNED", approved: false, autonomy: "CONTROLLED", risk: "LOW" }).ok).toBe(true);
    expect(canExecuteDemand({ status: "PLANNED", approved: false, autonomy: "AUTONOMOUS", risk: "MEDIUM" }).ok).toBe(true);
  });

  it("modo Planejar nao executa", () => {
    const v = canExecuteDemand({ status: "PLANNED", approved: false, autonomy: "READ_PLAN", risk: "LOW" });
    expect(v.ok).toBe(false);
  });

  it("risco alto ou aprovacao pendente seguem bloqueados", () => {
    expect(canExecuteDemand({ status: "PLANNED", approved: false, autonomy: "CONTROLLED", risk: "HIGH" }).ok).toBe(false);
    expect(canExecuteDemand({ status: "AWAITING_APPROVAL", approved: false, autonomy: "CONTROLLED", risk: "LOW" }).ok).toBe(false);
    expect(canExecuteDemand({ status: "AWAITING_APPROVAL", approved: true, autonomy: "CONTROLLED", risk: "LOW" }).ok).toBe(true);
  });

  it("READY executa e estados finais nao", () => {
    expect(canExecuteDemand({ status: "READY", approved: false, autonomy: "AUTONOMOUS", risk: "LOW" }).ok).toBe(true);
    expect(canExecuteDemand({ status: "EXECUTING", approved: false, autonomy: "CONTROLLED", risk: "LOW" }).ok).toBe(false);
  });
});

import { needsApprovalRequest } from "./demand.service.js";
import { interpretDemandText } from "./demand-interpreter.js";

describe("risco alto sem beco sem saída", () => {
  it("demanda HIGH já nasce aguardando aprovação", () => {
    const r = interpretDemandText({ text: "Migrar o banco de dados do podiario", workspaceId: "podiario", demandId: "d-h" });
    expect(r.brief.risk).toBe("HIGH");
    expect(r.targetStatus).toBe("AWAITING_APPROVAL");
    expect(r.approvalNeeded).toBe(true);
  });
  it("demanda antiga HIGH/CRITICAL em PLANNED abre pedido de aprovação", () => {
    expect(needsApprovalRequest("PLANNED", "HIGH")).toBe(true);
    expect(needsApprovalRequest("PLANNED", "CRITICAL")).toBe(true);
    expect(needsApprovalRequest("PLANNED", "LOW")).toBe(false);
    expect(needsApprovalRequest("AWAITING_APPROVAL", "HIGH")).toBe(false);
  });
});
