/**
 * MQ-3 — liveness de worker via WorkerHeartbeat (nao Mission.updatedAt).
 *
 * Grace window: N batimentos perdidos × WORKER_HEARTBEAT_INTERVAL_MS.
 * N=3 tolera atraso de upsert/DB sem atrasar demais a deteccao de crash.
 */
export const WORKER_LIVENESS_MISSED_HEARTBEATS = 3;

export function resolveWorkerLivenessMs(heartbeatIntervalMs: number): number {
  return heartbeatIntervalMs * WORKER_LIVENESS_MISSED_HEARTBEATS;
}

export interface WorkerHeartbeatLivenessView {
  readonly currentMissionId: string | null;
  readonly lastSeenAt: Date;
}

/**
 * Mission RUNNING abandonada se:
 * - livenessMs <= 0 (force, provas/boot observavel), ou
 * - sem heartbeat do owner, ou
 * - currentMissionId != missionId (owner vivo noutra missao), ou
 * - lastSeenAt fora da grace window.
 */
export function isRunningMissionAbandoned(input: {
  readonly missionId: string;
  readonly heartbeat: WorkerHeartbeatLivenessView | null | undefined;
  readonly nowMs: number;
  readonly livenessMs: number;
}): boolean {
  if (input.livenessMs <= 0) {
    return true;
  }
  const heartbeat = input.heartbeat;
  if (!heartbeat) {
    return true;
  }
  if (heartbeat.currentMissionId !== input.missionId) {
    return true;
  }
  const cutoffMs = input.nowMs - input.livenessMs;
  return heartbeat.lastSeenAt.getTime() < cutoffMs;
}
