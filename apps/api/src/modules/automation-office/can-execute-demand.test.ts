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
