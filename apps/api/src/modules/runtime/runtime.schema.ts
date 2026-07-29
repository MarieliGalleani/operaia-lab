import { z } from "zod";

export const workerViewSchema = z.object({
  employeeId: z.string(),
  name: z.string(),
  specialization: z.string(),
  status: z.string(),
  currentMissionId: z.string().nullable(),
  heartbeatAt: z.string().nullable(),
  uptimeMs: z.number(),
  missionsCompleted: z.number(),
  missionsFailed: z.number(),
  retries: z.number(),
  lastExecutionAt: z.string().nullable(),
  avgDurationMs: z.number().nullable(),
});

/** Resposta de GET /workers — `workers` readonly como `WorkerPublicView[]`. */
export const workersListResponseSchema = z.object({
  workers: z.array(workerViewSchema).readonly(),
  alive: z.number(),
});
