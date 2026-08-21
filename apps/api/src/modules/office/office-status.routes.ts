import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ContinuousRuntime } from "../runtime/continuous-runtime.js";
import { buildOfficeStatus } from "./build-office-status.js";

const officeLevelSchema = z.enum(["OPERATING", "ATTENTION", "PROBLEM"]);

const officeStatusResponseSchema = z.object({
  generatedAt: z.string(),
  windowHours: z.number(),
  status: z.object({
    level: officeLevelSchema,
    label: z.string(),
    summary: z.string(),
    reasons: z.array(z.string()),
    healthOk: z.boolean(),
    readyOk: z.boolean(),
    supervisor: z.object({
      running: z.boolean(),
      cycle: z.number(),
      lastSnapshotAt: z.string().nullable(),
      uptimeMs: z.number(),
    }),
    workers: z.object({
      alive: z.number(),
      expected: z.number(),
      busy: z.number(),
      available: z.number(),
    }),
    queue: z.object({
      queued: z.number(),
      running: z.number(),
      waiting: z.number(),
      failedHistorical: z.number(),
    }),
    uptimeMs: z.number().nullable(),
  }),
  activity: z.object({
    idle: z.boolean(),
    message: z.string(),
    missionsRunning: z.number(),
    missionsQueued: z.number(),
    missionsWaiting: z.number(),
    workersBusy: z.number(),
    workersAvailable: z.number(),
    runningObjectives: z.array(
      z.object({
        id: z.string(),
        objective: z.string(),
      }),
    ),
  }),
  attention: z.object({
    items: z.array(
      z.object({
        severity: z.enum(["blocker", "critical", "warning", "info"]),
        code: z.string(),
        title: z.string(),
        detail: z.string(),
      }),
    ),
    failed: z.object({
      historicalTotal: z.number(),
      newInWindow: z.number(),
      note: z.string(),
    }),
  }),
  governance: z.object({
    gate: z.object({
      windowHours: z.number(),
      execute: z.number(),
      skip: z.number(),
      reuse: z.number(),
      reopen: z.number(),
      recent: z.array(
        z.object({
          decision: z.string(),
          reason: z.string(),
          source: z.string(),
          createdAt: z.string(),
        }),
      ),
    }),
    policy: z.object({
      deferInWindow: z.number(),
      ignoreInWindow: z.number(),
      convertCandidateInWindow: z.number(),
      note: z.string(),
    }),
  }),
  completed: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        finishedAt: z.string().nullable(),
        kind: z.string(),
      }),
    ),
    emptyMessage: z.string(),
  }),
  humanAction: z.object({
    needed: z.boolean(),
    message: z.string(),
    proposals: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        status: z.string(),
        createdAt: z.string(),
      }),
    ),
  }),
  sources: z.object({
    health: z.enum(["ok", "error"]),
    ready: z.enum(["ok", "error"]),
    runtime: z.enum(["ok", "error"]),
    gate: z.enum(["ok", "error"]),
    signals: z.enum(["ok", "error"]),
    missions: z.enum(["ok", "error"]),
    governance: z.enum(["ok", "error"]),
  }),
  degradations: z.array(z.string()),
});

/**
 * GET /office/status — agregador READ-ONLY do Status do Escritório.
 * Autenticado via registerAuthenticatedApiHooks. Sem LLM / side effects.
 */
export function createOfficeStatusRoutes(
  runtime: ContinuousRuntime,
): FastifyPluginAsyncZod {
  return async (app) => {
    app.get(
      "/office/status",
      {
        schema: {
          tags: ["office"],
          response: {
            200: officeStatusResponseSchema,
          },
        },
      },
      async () => {
        const body = await buildOfficeStatus(runtime);
        return body as z.infer<typeof officeStatusResponseSchema>;
      },
    );
  };
}
