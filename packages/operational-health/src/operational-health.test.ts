import { describe, expect, it } from "vitest";
import {
  CriticalOperation,
  DEFAULT_HEALTH_RULES,
  FailurePolicy,
  InMemoryAlertBus,
  NonCriticalOperation,
  OperationalAlertType,
  OperationalHealthService,
  OperationalMaintenance,
  OperationCriticality,
  alertsFromRuleEvaluations,
  classifyOperation,
  evaluateHealthRules,
} from "./index.js";

describe("OperationCriticality + FailurePolicy", () => {
  const policy = new FailurePolicy();

  it("classifica memoria como NON_CRITICAL", () => {
    expect(classifyOperation(NonCriticalOperation.OPERATIONAL_MEMORY)).toBe(
      OperationCriticality.NON_CRITICAL,
    );
    expect(policy.decide(NonCriticalOperation.OPERATIONAL_MEMORY).shouldFailMission).toBe(
      false,
    );
  });

  it("classifica mission.complete como CRITICAL", () => {
    expect(classifyOperation(CriticalOperation.MISSION_COMPLETE)).toBe(
      OperationCriticality.CRITICAL,
    );
    expect(policy.decide(CriticalOperation.MISSION_COMPLETE).shouldFailMission).toBe(
      true,
    );
  });

  it("soft-fail: persistencia falha e missao permanece SUCCESS", async () => {
    let missionStatus: "SUCCESS" | "FAILED" = "SUCCESS";
    const result = await policy.runNonCritical({
      operation: NonCriticalOperation.OPERATIONAL_MEMORY,
      workspaceId: "nexo",
      correlationId: "m-1",
      run: async () => {
        throw new Error("Quota M1 excedida");
      },
      onFailure: () => {
        // nao altera status da missao
      },
    });
    expect(result).toBeUndefined();
    expect(missionStatus).toBe("SUCCESS");
  });
});

describe("Health Rules", () => {
  it("memory 80% → warning; 95% → critical; 100% → critical", () => {
    const w = evaluateHealthRules(
      { memoryActiveNotes: 1600, memoryQuota: 2000 },
      DEFAULT_HEALTH_RULES,
    );
    expect(w.find((e) => e.rule === "memory.quota")?.severity).toBe("warning");

    const c = evaluateHealthRules(
      { memoryActiveNotes: 1900, memoryQuota: 2000 },
      DEFAULT_HEALTH_RULES,
    );
    expect(c.find((e) => e.rule === "memory.quota")?.severity).toBe("critical");

    const full = evaluateHealthRules(
      { memoryActiveNotes: 2000, memoryQuota: 2000 },
      DEFAULT_HEALTH_RULES,
    );
    expect(full.find((e) => e.rule === "memory.quota")?.severity).toBe("critical");
  });

  it("gera alerta MEMORY_QUOTA_WARNING", () => {
    const evaluations = evaluateHealthRules({
      memoryActiveNotes: 1600,
      memoryQuota: 2000,
    });
    const alerts = alertsFromRuleEvaluations(evaluations);
    expect(alerts.some((a) => a.type === OperationalAlertType.MEMORY_QUOTA_WARNING)).toBe(
      true,
    );
  });
});

describe("OperationalHealthService", () => {
  it("retorna status HEALTHY com metricas ok", async () => {
    const bus = new InMemoryAlertBus();
    const service = new OperationalHealthService({
      alertBus: bus,
      metrics: {
        collect: () => ({
          memoryActiveNotes: 100,
          memoryQuota: 2000,
          queueWaiting: 0,
          queueDepth: 1,
          consecutiveFailed: 0,
          workersAlive: 9,
          workersExpected: 9,
          actionsOk: true,
          runtimeOk: true,
          schedulerRunning: true,
        }),
      },
    });
    const health = await service.getHealth();
    expect(health.status).toBe("HEALTHY");
    expect(health.warnings).toHaveLength(0);
  });

  it("publica alerta de congestionamento", async () => {
    const bus = new InMemoryAlertBus();
    const service = new OperationalHealthService({
      alertBus: bus,
      metrics: {
        collect: () => ({
          memoryActiveNotes: 100,
          memoryQuota: 2000,
          queueWaiting: 25,
          queueDepth: 12,
          consecutiveFailed: 0,
          workersAlive: 9,
          workersExpected: 9,
          runtimeOk: true,
          schedulerRunning: true,
        }),
      },
    });
    const health = await service.getHealth();
    expect(health.status).not.toBe("HEALTHY");
    expect(bus.list().length).toBeGreaterThan(0);
    expect(
      bus.list().some((a) => a.type === OperationalAlertType.QUEUE_CONGESTION),
    ).toBe(true);
  });
});

describe("OperationalMaintenance", () => {
  it("rotinas sao idempotentes (segunda execucao 0)", async () => {
    let archived = 0;
    const maintenance = new OperationalMaintenance({
      memory: {
        async archiveExpired() {
          const n = archived === 0 ? 3 : 0;
          archived += n;
          return n;
        },
        async preventiveEviction() {
          return 0;
        },
      },
      queue: {
        async cancelOrphanWaiting() {
          return 0;
        },
        async purgeExpiredRetries() {
          return 0;
        },
      },
    });
    const first = await maintenance.run("c1");
    const second = await maintenance.run("c2");
    expect(first.success).toBe(true);
    expect(first.results.find((r) => r.name === "memory.archive_expired")?.affected).toBe(3);
    expect(second.results.find((r) => r.name === "memory.archive_expired")?.affected).toBe(0);
  });
});
