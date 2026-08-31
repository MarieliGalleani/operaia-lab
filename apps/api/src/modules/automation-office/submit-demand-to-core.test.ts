import { describe, expect, it, vi } from "vitest";
import type { AssistedMissionQueuePort } from "../operations/operational-mission-service.js";
import type { AlreadyDoneGate } from "../runtime/work-governance/index.js";
import { submitDemandToCore } from "./submit-demand-to-core.js";

function createQueue(): AssistedMissionQueuePort & {
  enqueued: Array<{ objective: string; origin?: string }>;
} {
  const enqueued: Array<{ objective: string; origin?: string }> = [];
  return {
    enqueued,
    async enqueue(input) {
      enqueued.push({ objective: input.objective, origin: input.origin });
      return { mission: { id: `m-${enqueued.length}` }, created: true };
    },
    async get() {
      return null;
    },
    async listChildren() {
      return [];
    },
  };
}

describe("submitDemandToCore — origin (P1.2B)", () => {
  it("sem gate: enfileira com origin=HUMAN_DEMAND", async () => {
    const queue = createQueue();

    const result = await submitDemandToCore(queue, undefined, {
      workspaceId: "operaia-lab",
      objective: "Revisar PR #1",
      correlationId: "demand-1",
    });

    expect(result.accepted).toBe(true);
    expect(queue.enqueued).toHaveLength(1);
    expect(queue.enqueued[0]?.origin).toBe("HUMAN_DEMAND");
  });

  it("com gate EXECUTE: enfileira com origin=HUMAN_DEMAND", async () => {
    const queue = createQueue();
    const gate = {
      admit: vi.fn().mockResolvedValue({ decision: "EXECUTE" }),
      bindExecute: vi.fn().mockResolvedValue(undefined),
    } as unknown as AlreadyDoneGate;

    const result = await submitDemandToCore(queue, gate, {
      workspaceId: "operaia-lab",
      objective: "Revisar PR #2",
      correlationId: "demand-2",
    });

    expect(result.accepted).toBe(true);
    expect(queue.enqueued).toHaveLength(1);
    expect(queue.enqueued[0]?.origin).toBe("HUMAN_DEMAND");
  });

  it("com gate SKIP + resultingMissionId: NAO enfileira (reaproveita missao existente)", async () => {
    const queue = createQueue();
    const gate = {
      admit: vi.fn().mockResolvedValue({
        decision: "SKIP",
        resultingMissionId: "mission-existente",
      }),
      bindExecute: vi.fn(),
    } as unknown as AlreadyDoneGate;

    const result = await submitDemandToCore(queue, gate, {
      workspaceId: "operaia-lab",
      objective: "Revisar PR #3",
      correlationId: "demand-3",
    });

    expect(result.missionId).toBe("mission-existente");
    expect(queue.enqueued).toHaveLength(0);
  });
});
