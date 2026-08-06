/**
 * A.5.3 — cenarios de hardening operacional.
 */
import {
  DEFAULT_HEALTH_RULES,
  FailurePolicy,
  InMemoryAlertBus,
  NonCriticalOperation,
  OperationalAlertType,
  OperationalHealthService,
  OperationalMaintenance,
  evaluateHealthRules,
} from "@operaia/operational-health";
import {
  assert,
  failScenario,
  passScenario,
  type ValidationScenario,
} from "../scenario.js";

export const memoryQuotaThresholdsScenario: ValidationScenario = {
  id: "A.5.3.1",
  name: "Memory Quota Thresholds",
  description: "80% warning / 95% e 100% critical",
  async run() {
    const startedAt = Date.now();
    const observations: string[] = [];
    try {
      const at80 = evaluateHealthRules(
        { memoryActiveNotes: 1600, memoryQuota: 2000 },
        DEFAULT_HEALTH_RULES,
      );
      assert(
        at80.find((e) => e.rule === "memory.quota")?.severity === "warning",
        "80% deve ser warning",
      );
      observations.push("80% → warning");

      const at95 = evaluateHealthRules({
        memoryActiveNotes: 1900,
        memoryQuota: 2000,
      });
      assert(
        at95.find((e) => e.rule === "memory.quota")?.severity === "critical",
        "95% deve ser critical",
      );
      observations.push("95% → critical");

      const at100 = evaluateHealthRules({
        memoryActiveNotes: 2000,
        memoryQuota: 2000,
      });
      assert(
        at100.find((e) => e.rule === "memory.quota")?.severity === "critical",
        "100% deve ser critical",
      );
      observations.push("100% → critical");

      return passScenario(this, startedAt, observations);
    } catch (error) {
      return failScenario(this, startedAt, observations, error);
    }
  },
};

export const softFailPolicyScenario: ValidationScenario = {
  id: "A.5.3.2",
  name: "Soft Fail Policy",
  description: "Persistencia falha; missao permanece SUCCESS",
  async run() {
    const startedAt = Date.now();
    const observations: string[] = [];
    try {
      const policy = new FailurePolicy();
      let missionStatus: "SUCCESS" | "FAILED" = "SUCCESS";
      await policy.runNonCritical({
        operation: NonCriticalOperation.OPERATIONAL_MEMORY,
        run: async () => {
          throw new Error("Quota M1 excedida");
        },
        onFailure: () => {
          // nao altera missionStatus
        },
      });
      assert(missionStatus === "SUCCESS", "missao nao pode virar FAILED");
      assert(
        policy.decide(NonCriticalOperation.OPERATIONAL_MEMORY)
          .shouldFailMission === false,
        "NON_CRITICAL nao deve falhar missao",
      );
      observations.push("NON_CRITICAL soft-fail preserva SUCCESS");
      return passScenario(this, startedAt, observations);
    } catch (error) {
      return failScenario(this, startedAt, observations, error);
    }
  },
};

export const fifoEvictionPolicyScenario: ValidationScenario = {
  id: "A.5.3.3",
  name: "FIFO Eviction Policy",
  description: "Manutencao preventiva reduz notes acima do target",
  async run() {
    const startedAt = Date.now();
    const observations: string[] = [];
    try {
      let active = 100;
      const maintenance = new OperationalMaintenance({
        memoryTargetActiveMax: 80,
        memory: {
          async archiveExpired() {
            return 0;
          },
          async preventiveEviction(target) {
            if (active <= target) {
              return 0;
            }
            const n = active - target;
            active = target;
            return n;
          },
        },
      });
      const report = await maintenance.run("val-fifo");
      const eviction = report.results.find(
        (r) => r.name === "memory.preventive_eviction",
      );
      assert(eviction?.affected === 20, `evicted esperado 20, got ${eviction?.affected}`);
      assert(active === 80, "active deve ser 80 apos eviction");
      observations.push("FIFO preventive eviction 100→80");
      return passScenario(this, startedAt, observations);
    } catch (error) {
      return failScenario(this, startedAt, observations, error);
    }
  },
};

export const orphanWaitingMaintenanceScenario: ValidationScenario = {
  id: "A.5.3.4",
  name: "Orphan WAITING Maintenance",
  description: "Manutencao cancela WAITING orfaos",
  async run() {
    const startedAt = Date.now();
    const observations: string[] = [];
    try {
      let orphans = 13;
      const maintenance = new OperationalMaintenance({
        queue: {
          async cancelOrphanWaiting() {
            const n = orphans;
            orphans = 0;
            return n;
          },
          async purgeExpiredRetries() {
            return 0;
          },
        },
      });
      const first = await maintenance.run("a");
      const second = await maintenance.run("b");
      assert(
        first.results.find((r) => r.name === "queue.cancel_orphan_waiting")
          ?.affected === 13,
        "deve cancelar 13",
      );
      assert(
        second.results.find((r) => r.name === "queue.cancel_orphan_waiting")
          ?.affected === 0,
        "segunda execucao idempotente",
      );
      observations.push("WAITING orfaos cancelados + idempotente");
      return passScenario(this, startedAt, observations);
    } catch (error) {
      return failScenario(this, startedAt, observations, error);
    }
  },
};

export const supervisorAlertScenario: ValidationScenario = {
  id: "A.5.3.5",
  name: "Supervisor Alert",
  description: "Health Service gera alerta operacional",
  async run() {
    const startedAt = Date.now();
    const observations: string[] = [];
    try {
      const bus = new InMemoryAlertBus();
      const service = new OperationalHealthService({
        alertBus: bus,
        metrics: {
          collect: () => ({
            memoryActiveNotes: 1900,
            memoryQuota: 2000,
            queueWaiting: 25,
            queueDepth: 12,
            consecutiveFailed: 6,
            workersAlive: 9,
            workersExpected: 9,
            runtimeOk: true,
            schedulerRunning: true,
          }),
        },
      });
      const health = await service.getHealth();
      assert(health.alerts.length > 0, "deve gerar alertas");
      assert(
        bus.list().some((a) => a.type === OperationalAlertType.MEMORY_QUOTA_CRITICAL),
        "MEMORY_QUOTA_CRITICAL esperado",
      );
      assert(
        bus.list().some((a) => a.type === OperationalAlertType.QUEUE_CONGESTION),
        "QUEUE_CONGESTION esperado",
      );
      observations.push(`alertas=${bus.list().map((a) => a.type).join(",")}`);
      return passScenario(this, startedAt, observations);
    } catch (error) {
      return failScenario(this, startedAt, observations, error);
    }
  },
};

export const healthHealthyScenario: ValidationScenario = {
  id: "A.5.3.6",
  name: "Health HEALTHY",
  description: "OperationalHealthService status HEALTHY",
  async run() {
    const startedAt = Date.now();
    const observations: string[] = [];
    try {
      const service = new OperationalHealthService({
        metrics: {
          collect: () => ({
            memoryActiveNotes: 100,
            memoryQuota: 2000,
            queueWaiting: 0,
            queueDepth: 1,
            consecutiveFailed: 0,
            workersAlive: 9,
            workersExpected: 9,
            runtimeOk: true,
            schedulerRunning: true,
            actionsOk: true,
          }),
        },
      });
      const health = await service.getHealth();
      assert(health.status === "HEALTHY", `status=${health.status}`);
      observations.push("status=HEALTHY");
      return passScenario(this, startedAt, observations);
    } catch (error) {
      return failScenario(this, startedAt, observations, error);
    }
  },
};
