/** Estados minimos da fila operacional. */
export const MissionQueueStatus = {
  CREATED: "CREATED",
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  WAITING: "WAITING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;

export type MissionQueueStatus =
  (typeof MissionQueueStatus)[keyof typeof MissionQueueStatus];

/** Tipos de missao na fila distribuida. */
export const MissionKind = {
  COORDINATE: "COORDINATE",
  EXECUTE: "EXECUTE",
  CONSOLIDATE: "CONSOLIDATE",
} as const;

export type MissionKind = (typeof MissionKind)[keyof typeof MissionKind];

/** Porta-voz de toda missao nova (Scheduler / HTTP). */
export const CEO_EMPLOYEE_ID = "operaia-ceo";
