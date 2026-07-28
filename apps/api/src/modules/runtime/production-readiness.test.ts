import { describe, expect, it } from "vitest";
import {
  createDefaultImprovementEngine,
  createRuntimeObserver,
} from "../improvement/improvement-engine.js";
import { GovernanceService } from "../governance/governance-service.js";

describe("Improvement Engine modular", () => {
  it("registra os 6 observers padrao", () => {
    const engine = createDefaultImprovementEngine();
    expect(engine.getObservers()).toEqual([
      "RuntimeObserver",
      "ProjectObserver",
      "PortfolioObserver",
      "InfrastructureObserver",
      "KnowledgeObserver",
      "QualityObserver",
    ]);
  });

  it("RuntimeObserver gera insight de fila congestionada", async () => {
    const observer = createRuntimeObserver();
    const insights = await observer.observe({
      portfolio: {
        activeProjects: [],
        capacity: {
          workersAvailable: 0,
          workersBusy: 9,
          missionsQueued: 25,
          missionsRunning: 2,
          missionsWaiting: 1,
          saturatedSpecializations: [],
          remainingCapacity: 0,
        },
        health: {
          delayedProjects: [],
          stalledProjects: [],
          attentionRequired: [],
          bottleneckSpecializations: [],
          recurrentFailures: [],
        },
        goals: [],
      },
      queueDepths: { queued: 25, running: 2, waiting: 1, failed: 0 },
      learningCount: 1,
      pendingApprovals: 0,
      evolutionProjectId: "evo-1",
    });
    expect(insights.some((i) => i.code === "RUNTIME_QUEUE_CONGESTION")).toBe(
      true,
    );
  });
});

describe("Governanca", () => {
  it("nunca permite apply estrutural automatico", async () => {
    const gov = new GovernanceService();
    expect(await gov.canApplyStructuralChange()).toBe(false);
  });
});
