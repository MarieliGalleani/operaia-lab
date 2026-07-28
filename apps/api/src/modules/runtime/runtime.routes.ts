import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { MissionStatus } from "@operaia/database";
import { z } from "zod";
import type { ContinuousRuntime } from "./continuous-runtime.js";
import { CEO_EMPLOYEE_ID } from "./mission-states.js";

const workerViewSchema = z.object({
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

/**
 * Observabilidade operacional (JSON only — sem novas telas).
 */
export function createRuntimeRoutes(
  runtime: ContinuousRuntime,
): FastifyPluginAsyncZod {
  return async (app) => {
    app.get(
      "/workers",
      {
        schema: {
          tags: ["runtime"],
          response: {
            200: z.object({
              workers: z.array(workerViewSchema),
              alive: z.number(),
            }),
          },
        },
      },
      async () => {
        const workers = runtime.workers.list();
        return { workers, alive: runtime.workers.aliveCount() };
      },
    );

    app.get(
      "/missions",
      {
        schema: {
          tags: ["runtime"],
          querystring: z.object({
            status: z.nativeEnum(MissionStatus).optional(),
            workspaceId: z.string().optional(),
            take: z.coerce.number().int().positive().max(200).default(50),
            format: z.enum(["tree", "flat"]).default("tree"),
          }),
        },
      },
      async (request) => {
        if (request.query.format === "flat") {
          const missions = await runtime.queue.list({
            status: request.query.status,
            workspaceId: request.query.workspaceId,
            take: request.query.take,
          });
          return { missions };
        }
        const tree = await runtime.queue.listTree({
          workspaceId: request.query.workspaceId,
          take: request.query.take,
        });
        return { tree };
      },
    );

    app.get(
      "/runtime",
      {
        schema: {
          tags: ["runtime"],
        },
      },
      async () => {
        const snap = await runtime.snapshot();
        return {
          ...snap,
          portfolio: runtime.scheduler.getLastSnapshot(),
        };
      },
    );

    app.get(
      "/organization/health",
      {
        schema: {
          tags: ["runtime"],
        },
      },
      async () => {
        const portfolio = runtime.scheduler.getLastSnapshot();
        if (!portfolio) {
          return { status: "warming_up", health: null, capacity: null };
        }
        return {
          status: "ok",
          capturedAt: portfolio.capturedAt,
          health: portfolio.health,
          capacity: portfolio.capacity,
          goals: portfolio.goals,
          activeProjects: portfolio.activeProjects,
        };
      },
    );

    app.get(
      "/organization/learnings",
      {
        schema: {
          tags: ["runtime"],
          querystring: z.object({
            workspaceId: z.string().optional(),
            take: z.coerce.number().int().positive().max(100).default(20),
          }),
        },
      },
      async (request) => {
        const { prisma } = await import("@operaia/database");
        const learnings = await prisma.missionLearning.findMany({
          where: request.query.workspaceId
            ? { workspaceId: request.query.workspaceId }
            : undefined,
          orderBy: { createdAt: "desc" },
          take: request.query.take,
        });
        return { learnings };
      },
    );

    app.get(
      "/production-readiness",
      {
        schema: {
          tags: ["runtime"],
        },
      },
      async () => {
        const snap = await runtime.snapshot();
        const readiness = runtime.getLastReadiness();
        return {
          readiness,
          continuous: {
            enabled: snap.enabled,
            started: snap.started,
            uptimeMs: snap.uptimeMs,
            workersAlive: snap.workersAlive,
            workersExpected: snap.workers.length,
          },
          queue: snap.queue,
          scheduler: snap.scheduler,
          portfolio: snap.portfolio
            ? {
                capturedAt: snap.portfolio.capturedAt,
                activeProjects: snap.portfolio.activeProjects.length,
                capacity: snap.portfolio.capacity,
                attention: snap.portfolio.health.attentionRequired,
              }
            : null,
          insights: snap.insights,
          improvementObservers: snap.improvementObservers,
          learningCount: snap.learningCount,
          pendingApprovals: snap.pendingApprovals,
          structuralApplyAllowed: snap.structuralApplyAllowed,
          governance: {
            note: "Alteracoes estruturais exigem aprovacao humana. Apply automatico desabilitado.",
          },
        };
      },
    );

    app.get(
      "/organization/insights",
      {
        schema: {
          tags: ["runtime"],
        },
      },
      async () => ({
        insights: runtime.getLastInsights(),
        observers: runtime.improvement.getObservers(),
      }),
    );

    app.get(
      "/governance/proposals",
      {
        schema: {
          tags: ["runtime"],
          querystring: z.object({
            status: z
              .enum([
                "DRAFT",
                "PROPOSED",
                "WAITING_APPROVAL",
                "APPROVED",
                "REJECTED",
                "IMPLEMENTING",
                "COMPLETED",
              ])
              .optional(),
            take: z.coerce.number().int().positive().max(100).default(50),
          }),
        },
      },
      async (request) => {
        const proposals = await runtime.governance.list({
          status: request.query.status,
          take: request.query.take,
        });
        return { proposals };
      },
    );

    app.post(
      "/governance/proposals",
      {
        schema: {
          tags: ["runtime"],
          body: z.object({
            projectId: z.string().optional(),
            title: z.string().min(1),
            description: z.string().min(1),
            justification: z.string().min(1),
            expectedImpact: z.string().min(1),
            affectedComponents: z.array(z.string()).min(1),
            risks: z.array(z.string()).optional(),
            implementationPlan: z.string().min(1),
            rollbackPlan: z.string().min(1),
            diffRef: z.string().optional(),
            evidence: z.unknown().optional(),
          }),
        },
      },
      async (request) => {
        const proposal = await runtime.governance.createProposal(request.body);
        return { proposal };
      },
    );

    app.post(
      "/governance/proposals/:id/approve",
      {
        schema: {
          tags: ["runtime"],
          params: z.object({ id: z.string().min(1) }),
          body: z.object({ approvedBy: z.string().min(1) }),
        },
      },
      async (request) => {
        const proposal = await runtime.governance.approve(
          request.params.id,
          request.body.approvedBy,
        );
        return { proposal };
      },
    );

    app.post(
      "/governance/proposals/:id/reject",
      {
        schema: {
          tags: ["runtime"],
          params: z.object({ id: z.string().min(1) }),
          body: z.object({
            rejectedBy: z.string().min(1),
            reason: z.string().min(1),
          }),
        },
      },
      async (request) => {
        const proposal = await runtime.governance.reject(
          request.params.id,
          request.body.rejectedBy,
          request.body.reason,
        );
        return { proposal };
      },
    );

    app.get(
      "/health",
      {
        schema: {
          tags: ["runtime"],
          response: {
            200: z.object({
              status: z.enum(["ok", "degraded", "down"]),
              api: z.literal("up"),
              continuousRuntime: z.boolean(),
              workersAlive: z.number(),
              workersExpected: z.number(),
              queue: z.object({
                queued: z.number(),
                running: z.number(),
                waiting: z.number(),
                failed: z.number(),
              }),
              scheduler: z.object({
                running: z.boolean(),
                lastTickAt: z.string().nullable(),
              }),
            }),
          },
        },
      },
      async () => {
        const snap = await runtime.snapshot();
        const expected = snap.workers.length;
        const alive = snap.workersAlive;
        let status: "ok" | "degraded" | "down" = "ok";
        if (!snap.started && snap.enabled) {
          status = "down";
        } else if (alive < expected || !snap.scheduler.running) {
          status = "degraded";
        }
        return {
          status,
          api: "up" as const,
          continuousRuntime: snap.started,
          workersAlive: alive,
          workersExpected: expected,
          queue: snap.queue,
          scheduler: {
            running: snap.scheduler.running,
            lastTickAt: snap.scheduler.lastTickAt,
          },
        };
      },
    );

    app.post(
      "/missions",
      {
        schema: {
          tags: ["runtime"],
          body: z.object({
            workspaceId: z.string().min(1),
            objective: z.string().min(1),
            projectId: z.string().optional(),
            priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
          }),
        },
      },
      async (request) => {
        const { mission, created } = await runtime.queue.enqueue({
          workspaceId: request.body.workspaceId,
          projectId: request.body.projectId,
          objective: request.body.objective,
          priority: request.body.priority,
          ownerEmployeeId: CEO_EMPLOYEE_ID,
          dedupe: true,
        });
        return { mission, created };
      },
    );
  };
}
