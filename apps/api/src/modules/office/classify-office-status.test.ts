import { describe, expect, it } from "vitest";
import {
  classifyOfficeStatus,
  type OfficeClassificationInput,
} from "./classify-office-status.js";

function base(
  overrides: Partial<OfficeClassificationInput> = {},
): OfficeClassificationInput {
  return {
    healthOk: true,
    readyOk: true,
    runtimeStarted: true,
    supervisorRunning: true,
    workersAlive: 9,
    workersExpected: 9,
    supervisorHealthOverall: "ok",
    failedNew24h: 0,
    pendingHumanApprovals: 0,
    recoveryRecent: false,
    queueCongested: false,
    signalDefer24h: 0,
    ...overrides,
  };
}

describe("classifyOfficeStatus", () => {
  it("retorna OPERANDO quando tudo está saudável", () => {
    const result = classifyOfficeStatus(base());
    expect(result.level).toBe("OPERATING");
    expect(result.label).toBe("OPERANDO");
    expect(result.reasons).toEqual([]);
  });

  it("retorna PROBLEMA em health failure", () => {
    const result = classifyOfficeStatus(base({ healthOk: false }));
    expect(result.level).toBe("PROBLEM");
    expect(result.reasons).toContain("health_failure");
  });

  it("retorna PROBLEMA sem workers vivos", () => {
    const result = classifyOfficeStatus(
      base({ workersAlive: 0, workersExpected: 9 }),
    );
    expect(result.level).toBe("PROBLEM");
    expect(result.reasons).toContain("workers_unavailable");
  });

  it("retorna ATENÇÃO com failed novos (não histórico)", () => {
    const result = classifyOfficeStatus(base({ failedNew24h: 3 }));
    expect(result.level).toBe("ATTENTION");
    expect(result.reasons).toContain("failed_new_24h");
  });

  it("retorna ATENÇÃO com recovery recente", () => {
    const result = classifyOfficeStatus(base({ recoveryRecent: true }));
    expect(result.level).toBe("ATTENTION");
    expect(result.reasons).toContain("recovery_recent");
  });

  it("retorna ATENÇÃO com ChangeProposal pendente", () => {
    const result = classifyOfficeStatus(
      base({ pendingHumanApprovals: 1 }),
    );
    expect(result.level).toBe("ATTENTION");
    expect(result.reasons).toContain("pending_human_approval");
  });

  it("não marca PROBLEMA só por fila vazia / idle", () => {
    const result = classifyOfficeStatus(base());
    expect(result.level).toBe("OPERATING");
  });
});
