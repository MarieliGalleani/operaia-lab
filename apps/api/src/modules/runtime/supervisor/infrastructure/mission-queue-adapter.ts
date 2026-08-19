import type { Mission } from "@operaia/database";
import type { MissionQueue } from "../../mission-queue.js";
import type { MissionQueuePort, MissionView } from "../ports.js";

/**
 * Adapta MissionQueue concreta ao MissionQueuePort do Supervisor.
 * Isola o Supervisor da classe Prisma-backed.
 */
export class MissionQueueAdapter implements MissionQueuePort {
  constructor(private readonly queue: MissionQueue) {}

  depths() {
    return this.queue.depths();
  }

  async list(filters?: {
    readonly status?: string;
    readonly workspaceId?: string;
    readonly take?: number;
  }): Promise<readonly MissionView[]> {
    const rows = await this.queue.list({
      status: filters?.status as never,
      workspaceId: filters?.workspaceId,
      take: filters?.take,
    });
    return rows.map(toMissionView);
  }

  recoverStaleRunning(staleAfterMs: number) {
    return this.queue.recoverStaleRunning(staleAfterMs);
  }

  listAbandonedRunningIds(livenessMs: number) {
    return this.queue.listAbandonedRunningIds(livenessMs);
  }

  recoverWaitingParents() {
    return this.queue.recoverWaitingParents();
  }

  recoverBlockedDag() {
    return this.queue.recoverBlockedDag();
  }

  recoverFailedRetryable() {
    return this.queue.recoverFailedRetryable();
  }

  async enqueue(input: {
    readonly workspaceId: string;
    readonly projectId?: string | null;
    readonly objective: string;
    readonly ownerEmployeeId: string;
    readonly priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    readonly dedupe?: boolean;
  }) {
    const result = await this.queue.enqueue({
      workspaceId: input.workspaceId,
      projectId: input.projectId ?? undefined,
      objective: input.objective,
      ownerEmployeeId: input.ownerEmployeeId,
      priority: input.priority,
      dedupe: input.dedupe,
    });
    return { created: result.created, id: result.mission.id };
  }

  async findByObjectiveHash(
    workspaceId: string,
    objectiveHash: string,
    options?: { readonly createdAtGte?: Date },
  ) {
    return this.queue.findByObjectiveHash(workspaceId, objectiveHash, options);
  }
}

function toMissionView(mission: Mission): MissionView {
  return {
    id: mission.id,
    workspaceId: mission.workspaceId,
    status: mission.status,
    readiness: mission.readiness,
    attempt: mission.attempt,
    maxAttempts: mission.maxAttempts,
    updatedAt: mission.updatedAt,
    startedAt: mission.startedAt,
    lastError: mission.lastError,
    missionKind: mission.missionKind,
    ownerEmployeeId: mission.ownerEmployeeId,
    objective: mission.objective,
  };
}
