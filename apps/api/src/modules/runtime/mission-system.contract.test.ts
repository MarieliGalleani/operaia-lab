/**
 * ADR-007 — testes de contrato do Mission System oficial (MissionQueue).
 * Fase 0: invariantes HTTP / Supervisor / delegação.
 * Fase 1: validações de enqueue (resolveEnqueueContract).
 * Fase 2.1: preservar CoordinatePhaseResult.initial no consolidate.
 */
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { Specialization } from "@operaia/employee-framework";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("../organization/mission-learning.js", () => ({
  loadOrganizationalLearningNotes: async () => [],
  loadOrganizationalLearningNotesFromPrisma: async () => [],
  recordMissionLearning: async () => {},
}));

import type { ContinuousRuntime } from "./continuous-runtime.js";
import { createRuntimeRoutes } from "./runtime.routes.js";
import {
  MissionEnqueueContractError,
  resolveEnqueueContract,
} from "./mission-queue.js";
import { CEO_EMPLOYEE_ID, MissionKind } from "./mission-states.js";
import { QueuedMissionExecutor } from "./queued-mission-executor.js";
import { createMissionExecutionStack } from "../operations/mission-execution.js";
import {
  mergeConsolidatePreservingInitial,
  type ConsolidatePhaseResult,
  type CoordinatePhaseResult,
} from "./mission-result-store.js";
import { CoordinationDispatcher } from "./supervisor/coordination-dispatcher.js";
import type { SupervisorLoggerPort } from "./supervisor/ports.js";

/** Contrato público HTTP Runtime POST /missions (espelho da rota — Fase 0). */
const runtimePostMissionBodySchema = z.object({
  workspaceId: z.string().min(1),
  objective: z.string().min(1),
  projectId: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
});

type CapturedEnqueue = {
  readonly workspaceId: string;
  readonly objective: string;
  readonly ownerEmployeeId?: string;
  readonly missionKind?: string;
  readonly parentMissionId?: string;
  readonly requiredSpecialization?: string;
  readonly priority?: string;
};

function noopLogger(): SupervisorLoggerPort {
  return { emit() {} };
}

describe("ADR-007 Fase 0 — contrato Mission System (MissionQueue)", () => {
  describe("HTTP externo nunca cria EXECUTE/CONSOLIDATE", () => {
    it("schema publico nao expoe missionKind", () => {
      const shape = runtimePostMissionBodySchema.shape;
      expect(Object.keys(shape).sort()).toEqual(
        ["objective", "priority", "projectId", "workspaceId"].sort(),
      );
      expect(shape).not.toHaveProperty("missionKind");
      expect(shape).not.toHaveProperty("ownerEmployeeId");
      expect(shape).not.toHaveProperty("parentMissionId");
      expect(shape).not.toHaveProperty("requiredSpecialization");
    });

    it("POST /missions enfileira so COORDINATE implicito com owner Opera", async () => {
      const captured: CapturedEnqueue[] = [];
      const runtime = {
        queue: {
          async enqueue(input: CapturedEnqueue) {
            captured.push(input);
            return {
              mission: {
                id: "m1",
                missionKind: MissionKind.COORDINATE,
                ownerEmployeeId: input.ownerEmployeeId,
              },
              created: true,
            };
          },
          async list() {
            return [];
          },
          async listTree() {
            return [];
          },
        },
        workers: {
          list: () => [],
          aliveCount: () => 0,
        },
        async snapshot() {
          return {
            started: false,
            queue: { queued: 0, running: 0, waiting: 0, failed: 0 },
            scheduler: { lastTickAt: null },
            supervisor: { running: false, lastSnapshotAt: null },
          };
        },
        supervisor: { isRunning: false },
      } as unknown as ContinuousRuntime;

      const app = Fastify();
      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);
      await app.register(createRuntimeRoutes(runtime), { prefix: "/api/v1" });

      const ok = await app.inject({
        method: "POST",
        url: "/api/v1/missions",
        payload: {
          workspaceId: "nexo",
          objective: "objetivo de usuario",
          missionKind: MissionKind.EXECUTE,
          ownerEmployeeId: "cto-mag",
          parentMissionId: "fake-parent",
        },
      });

      expect(ok.statusCode).toBe(200);
      expect(captured).toHaveLength(1);
      expect(captured[0]!.ownerEmployeeId).toBe(CEO_EMPLOYEE_ID);
      expect(captured[0]!.missionKind).toBeUndefined();
      expect(captured[0]!.parentMissionId).toBeUndefined();
      expect(captured[0]!.requiredSpecialization).toBeUndefined();
      expect(captured[0]!.ownerEmployeeId).not.toBe("cto-mag");

      await app.close();
    });

    it("payload com missionKind EXECUTE/CONSOLIDATE e rejeitado se schema for strict no contrato", () => {
      const strict = runtimePostMissionBodySchema.strict();
      const execute = strict.safeParse({
        workspaceId: "nexo",
        objective: "x",
        missionKind: MissionKind.EXECUTE,
      });
      const consolidate = strict.safeParse({
        workspaceId: "nexo",
        objective: "x",
        missionKind: MissionKind.CONSOLIDATE,
      });
      expect(execute.success).toBe(false);
      expect(consolidate.success).toBe(false);
    });
  });

  describe("COORDINATE sempre Opera", () => {
    it("constante CEO e kinds oficiais do contrato", () => {
      expect(CEO_EMPLOYEE_ID).toBe("operaia-ceo");
      expect(MissionKind.COORDINATE).toBe("COORDINATE");
      expect(MissionKind.EXECUTE).toBe("EXECUTE");
      expect(MissionKind.CONSOLIDATE).toBe("CONSOLIDATE");
    });

    it("Supervisor CoordinationDispatcher so enfileira com owner Opera", async () => {
      const enqueued: CapturedEnqueue[] = [];
      const queue = {
        async enqueue(input: CapturedEnqueue) {
          enqueued.push(input);
          return { created: true, id: `id-${enqueued.length}` };
        },
      };
      const workspaces = {
        scannedAt: new Date().toISOString(),
        activeCount: 1,
        readyCount: 1,
        attentionCount: 1,
        workspaces: [
          {
            workspaceId: "nexo",
            name: "NEXO",
            status: "ACTIVE",
            projectId: "nexo",
            pendingTasks: 1,
            teamSize: 1,
            hasActiveMission: false,
            hasBlockedMission: false,
            hasWaitingMission: false,
            hasReadyMission: false,
            hasBacklog: true,
            hasChanges: true,
            needsAttention: true,
            attentionReasons: ["backlog" as const],
            openMissions: 0,
            ready: true,
            issues: [] as string[],
          },
        ],
      };

      await new CoordinationDispatcher(queue as never, noopLogger()).dispatch({
        workspaces,
        missions: {
          scannedAt: new Date().toISOString(),
          items: [],
          resumableCount: 0,
          coordinationNeeded: 0,
          byStatus: {},
        },
        queue: {
          scannedAt: new Date().toISOString(),
          pending: 0,
          running: 0,
          failed: 0,
          waiting: 0,
          retry: 0,
          stuck: 0,
          depth: 0,
          congested: false,
          workersAvailable: 0,
          workersBusy: 0,
          depths: { queued: 0, running: 0, waiting: 0, failed: 0 },
        },
        recovery: {
          recoveredAt: new Date().toISOString(),
          actions: [],
          infraRecovered: 0,
          coordinationsRequested: 0,
        },
        healthOk: true,
      });

      expect(enqueued.length).toBeGreaterThan(0);
      for (const item of enqueued) {
        expect(item.ownerEmployeeId).toBe(CEO_EMPLOYEE_ID);
        expect(item.missionKind).toBeUndefined();
      }
    });
  });

  describe("EXECUTE somente pos-delegacao", () => {
    it("sem delegacao da Opera nao enfileira EXECUTE", async () => {
      const enqueued: CapturedEnqueue[] = [];
      const queue = {
        async enqueue(input: CapturedEnqueue) {
          enqueued.push(input);
          return {
            mission: { id: `child-${enqueued.length}`, ...input },
            created: true,
          };
        },
        async markWaiting() {},
        async complete() {},
        async linkDependency() {},
      };

      const office = {
        registry: {
          require: () => ({
            create: () => ({}),
          }),
        },
        runner: {
          async run() {
            return {
              employeeId: CEO_EMPLOYEE_ID,
              output: {
                decision: {
                  decision: "responder",
                  reasoning: "sem necessidade tecnica",
                  delegations: [],
                },
                report: { summary: "sem delegacao", risks: [] },
              },
            };
          },
        },
        matcher: { match: () => null },
        llm: {},
      };

      const workspaces = {
        async toSnapshot() {
          return {
            workspaceId: "nexo",
            name: "NEXO",
            status: "ACTIVE" as const,
            projectId: "nexo",
            tasks: [],
            teamIds: [],
          };
        },
      };

      const memory = {
        async search() {
          return [];
        },
        async store() {},
      };

      const execution = createMissionExecutionStack();
      const logger = {
        info() {},
        warn() {},
        error() {},
      };

      const executor = new QueuedMissionExecutor(
        office as never,
        workspaces as never,
        queue as never,
        execution,
        memory as never,
        logger,
      );

      await executor.execute(
        {
          id: "root-1",
          workspaceId: "nexo",
          projectId: "nexo",
          objective: "objetivo",
          missionKind: MissionKind.COORDINATE,
          priority: "MEDIUM",
          status: "RUNNING",
          readiness: "READY",
          ownerEmployeeId: CEO_EMPLOYEE_ID,
          parentMissionId: null,
          requiredSpecialization: null,
          attempt: 1,
          maxAttempts: 3,
          resultJson: null,
          startedAt: new Date(),
          updatedAt: new Date(),
          createdAt: new Date(),
          finishedAt: null,
          scheduledAt: null,
          lastError: null,
        } as never,
        CEO_EMPLOYEE_ID,
      );

      const executes = enqueued.filter(
        (e) => e.missionKind === MissionKind.EXECUTE,
      );
      expect(executes).toHaveLength(0);
    });

    it("com delegacao da Opera enfileira EXECUTE com parentMissionId", async () => {
      const enqueued: CapturedEnqueue[] = [];
      const queue = {
        async enqueue(input: CapturedEnqueue) {
          enqueued.push(input);
          return {
            mission: {
              id: `child-${enqueued.length}`,
              missionKind: input.missionKind,
              parentMissionId: input.parentMissionId,
            },
            created: true,
          };
        },
        async markWaiting() {},
        async complete() {},
        async linkDependency() {},
      };

      const office = {
        registry: {
          require: () => ({
            create: () => ({}),
          }),
        },
        runner: {
          async run() {
            return {
              employeeId: CEO_EMPLOYEE_ID,
              output: {
                decision: {
                  decision: "delegar",
                  reasoning: "precisa engenharia",
                  delegations: [
                    {
                      specialization: Specialization.SOFTWARE_ENGINEERING,
                      task: "implementar auth",
                      reason: "tecnico",
                    },
                  ],
                },
                report: { summary: "delegar", risks: [] },
              },
            };
          },
        },
        matcher: {
          match: () => ({ profile: { id: "cto-mag" } }),
        },
        llm: {},
      };

      const workspaces = {
        async toSnapshot() {
          return {
            workspaceId: "nexo",
            name: "NEXO",
            status: "ACTIVE" as const,
            projectId: "nexo",
            tasks: [],
            teamIds: [],
          };
        },
      };

      const memory = {
        async search() {
          return [];
        },
        async store() {},
      };

      const execution = createMissionExecutionStack();
      const logger = {
        info() {},
        warn() {},
        error() {},
      };

      const executor = new QueuedMissionExecutor(
        office as never,
        workspaces as never,
        queue as never,
        execution,
        memory as never,
        logger,
      );

      const rootId = "root-coord";
      await executor.execute(
        {
          id: rootId,
          workspaceId: "nexo",
          projectId: "nexo",
          objective: "objetivo",
          missionKind: MissionKind.COORDINATE,
          priority: "MEDIUM",
          status: "RUNNING",
          readiness: "READY",
          ownerEmployeeId: CEO_EMPLOYEE_ID,
          parentMissionId: null,
          requiredSpecialization: null,
          attempt: 1,
          maxAttempts: 3,
          resultJson: null,
          startedAt: new Date(),
          updatedAt: new Date(),
          createdAt: new Date(),
          finishedAt: null,
          scheduledAt: null,
          lastError: null,
        } as never,
        CEO_EMPLOYEE_ID,
      );

      const executes = enqueued.filter(
        (e) => e.missionKind === MissionKind.EXECUTE,
      );
      expect(executes.length).toBeGreaterThan(0);
      for (const child of executes) {
        expect(child.parentMissionId).toBe(rootId);
        expect(child.requiredSpecialization).toBe(
          Specialization.SOFTWARE_ENGINEERING,
        );
      }
    });
  });

  describe("Fase 2.1 — preservar initial no resultJson consolidado", () => {
    it("Caso 1: COORDINATE sem delegacao grava initial + final e COMPLETE via complete()", async () => {
      let completed: { id: string; result: ConsolidatePhaseResult } | null =
        null;
      const queue = {
        async enqueue() {
          throw new Error("nao deve enfileirar EXECUTE");
        },
        async markWaiting() {
          throw new Error("nao deve WAITING sem delegacao");
        },
        async complete(id: string, result: ConsolidatePhaseResult) {
          completed = { id, result };
        },
        async linkDependency() {},
      };

      const office = {
        registry: {
          require: () => ({ create: () => ({}) }),
        },
        runner: {
          async run() {
            return {
              employeeId: CEO_EMPLOYEE_ID,
              output: {
                decision: {
                  analyzed: "consulta",
                  decision: "responder",
                  reasoning: "sem especialista",
                  recommendations: [],
                  risks: [],
                  nextActions: ["acompanhar"],
                  delegations: [],
                },
                report: {
                  summary: "status ok",
                  analysis: "ok",
                  plan: [],
                  recommendations: [],
                  risks: [],
                  nextActions: ["acompanhar"],
                },
                quality: { passed: true, issues: [] },
              },
            };
          },
        },
        matcher: { match: () => null },
        llm: {},
      };

      const executor = new QueuedMissionExecutor(
        office as never,
        {
          async toSnapshot() {
            return {
              workspaceId: "nexo",
              name: "NEXO",
              status: "ACTIVE" as const,
              projectId: "nexo",
              tasks: [],
              teamIds: [],
            };
          },
        } as never,
        queue as never,
        createMissionExecutionStack(),
        {
          async search() {
            return [];
          },
          async store() {},
        } as never,
        { info() {}, warn() {}, error() {} },
      );

      await executor.execute(
        {
          id: "root-direct",
          workspaceId: "nexo",
          projectId: "nexo",
          objective: "status?",
          missionKind: MissionKind.COORDINATE,
          priority: "MEDIUM",
          status: "RUNNING",
          readiness: "READY",
          ownerEmployeeId: CEO_EMPLOYEE_ID,
          parentMissionId: null,
          requiredSpecialization: null,
          attempt: 1,
          maxAttempts: 3,
          resultJson: null,
          startedAt: new Date(),
          updatedAt: new Date(),
          createdAt: new Date(),
          finishedAt: null,
          scheduledAt: null,
          lastError: null,
        } as never,
        CEO_EMPLOYEE_ID,
      );

      expect(completed).not.toBeNull();
      expect(completed!.id).toBe("root-direct");
      expect(completed!.result.phase).toBe("consolidated");
      expect(completed!.result.initial?.output.decision.decision).toBe(
        "responder",
      );
      expect(completed!.result.final.output.decision.decision).toBe("responder");
      expect(completed!.result.initial).toEqual(completed!.result.final);
    });

    it("Caso 2: apos CONSOLIDATE, merge preserva initial com delegations", () => {
      const coordinated: CoordinatePhaseResult = {
        phase: "coordinated",
        initial: {
          employeeId: CEO_EMPLOYEE_ID,
          output: {
            decision: {
              analyzed: "precisa auth",
              decision: "delegar",
              reasoning: "engenharia",
              recommendations: [],
              risks: [],
              nextActions: [],
              delegations: [
                {
                  specialization: Specialization.SOFTWARE_ENGINEERING,
                  reason: "tecnico",
                  task: "implementar auth",
                },
              ],
            },
            report: {
              summary: "delegar",
              analysis: "",
              plan: [],
              recommendations: [],
              risks: [],
              nextActions: [],
            },
            quality: { passed: true, issues: [] },
          },
        },
      };

      const consolidatedOnly: ConsolidatePhaseResult = {
        phase: "consolidated",
        usableResult: "auth priorizada",
        final: {
          employeeId: CEO_EMPLOYEE_ID,
          output: {
            decision: {
              analyzed: "consolidado",
              decision: "seguir",
              reasoning: "mag entregou",
              recommendations: [],
              risks: [],
              nextActions: ["revisar"],
              delegations: [],
            },
            report: {
              summary: "auth priorizada",
              analysis: "",
              plan: [],
              recommendations: [],
              risks: [],
              nextActions: ["revisar"],
            },
            quality: { passed: true, issues: [] },
          },
        },
      };

      const merged = mergeConsolidatePreservingInitial(
        coordinated,
        consolidatedOnly,
      );

      expect(merged.initial?.output.decision.delegations).toHaveLength(1);
      expect(merged.initial?.output.decision.delegations[0]?.task).toBe(
        "implementar auth",
      );
      expect(merged.final.output.decision.decision).toBe("seguir");
      expect(merged.usableResult).toBe("auth priorizada");
    });

    it("Caso 3: EXECUTEs pos-delegacao continuam com parentMissionId (regressao)", async () => {
      const enqueued: CapturedEnqueue[] = [];
      const queue = {
        async enqueue(input: CapturedEnqueue) {
          enqueued.push(input);
          return {
            mission: {
              id: `child-${enqueued.length}`,
              missionKind: input.missionKind,
              parentMissionId: input.parentMissionId,
            },
            created: true,
          };
        },
        async markWaiting() {},
        async complete() {},
        async linkDependency() {},
      };

      const executor = new QueuedMissionExecutor(
        {
          registry: { require: () => ({ create: () => ({}) }) },
          runner: {
            async run() {
              return {
                employeeId: CEO_EMPLOYEE_ID,
                output: {
                  decision: {
                    decision: "delegar",
                    reasoning: "precisa engenharia",
                    delegations: [
                      {
                        specialization: Specialization.SOFTWARE_ENGINEERING,
                        task: "implementar auth",
                        reason: "tecnico",
                      },
                    ],
                  },
                  report: { summary: "delegar", risks: [] },
                },
              };
            },
          },
          matcher: { match: () => ({ profile: { id: "cto-mag" } }) },
          llm: {},
        } as never,
        {
          async toSnapshot() {
            return {
              workspaceId: "nexo",
              name: "NEXO",
              status: "ACTIVE" as const,
              projectId: "nexo",
              tasks: [],
              teamIds: [],
            };
          },
        } as never,
        queue as never,
        createMissionExecutionStack(),
        {
          async search() {
            return [];
          },
          async store() {},
        } as never,
        { info() {}, warn() {}, error() {} },
      );

      const rootId = "root-coord-21";
      await executor.execute(
        {
          id: rootId,
          workspaceId: "nexo",
          projectId: "nexo",
          objective: "objetivo",
          missionKind: MissionKind.COORDINATE,
          priority: "MEDIUM",
          status: "RUNNING",
          readiness: "READY",
          ownerEmployeeId: CEO_EMPLOYEE_ID,
          parentMissionId: null,
          requiredSpecialization: null,
          attempt: 1,
          maxAttempts: 3,
          resultJson: null,
          startedAt: new Date(),
          updatedAt: new Date(),
          createdAt: new Date(),
          finishedAt: null,
          scheduledAt: null,
          lastError: null,
        } as never,
        CEO_EMPLOYEE_ID,
      );

      const executes = enqueued.filter(
        (e) => e.missionKind === MissionKind.EXECUTE,
      );
      expect(executes.length).toBeGreaterThan(0);
      expect(executes[0]?.parentMissionId).toBe(rootId);
    });
  });

  describe("Fase 1 — resolveEnqueueContract (MissionQueue)", () => {
    it("COORDINATE raiz sempre resolve owner = Opera mesmo se input pedir specialist", () => {
      const resolved = resolveEnqueueContract({
        workspaceId: "nexo",
        objective: "objetivo",
        ownerEmployeeId: "cto-mag",
      });
      expect(resolved.missionKind).toBe(MissionKind.COORDINATE);
      expect(resolved.ownerEmployeeId).toBe(CEO_EMPLOYEE_ID);
    });

    it("COORDINATE com parentMissionId e rejeitado", () => {
      expect(() =>
        resolveEnqueueContract({
          workspaceId: "nexo",
          objective: "x",
          missionKind: MissionKind.COORDINATE,
          parentMissionId: "pai",
        }),
      ).toThrow(MissionEnqueueContractError);
    });

    it("EXECUTE sem parentMissionId e rejeitado (entrada externa)", () => {
      expect(() =>
        resolveEnqueueContract({
          workspaceId: "nexo",
          objective: "x",
          missionKind: MissionKind.EXECUTE,
          requiredSpecialization: Specialization.SOFTWARE_ENGINEERING,
        }),
      ).toThrow(/parentMissionId/);
    });

    it("EXECUTE sem requiredSpecialization e rejeitado", () => {
      expect(() =>
        resolveEnqueueContract({
          workspaceId: "nexo",
          objective: "x",
          missionKind: MissionKind.EXECUTE,
          parentMissionId: "root",
        }),
      ).toThrow(/requiredSpecialization/);
    });

    it("EXECUTE pos-delegacao e aceito com parent + specialization", () => {
      const resolved = resolveEnqueueContract({
        workspaceId: "nexo",
        objective: "task",
        missionKind: MissionKind.EXECUTE,
        parentMissionId: "root-coord",
        requiredSpecialization: Specialization.SOFTWARE_ENGINEERING,
        ownerEmployeeId: "cto-mag",
      });
      expect(resolved.missionKind).toBe(MissionKind.EXECUTE);
      expect(resolved.ownerEmployeeId).toBe("cto-mag");
    });

    it("CONSOLIDATE sem parentMissionId e rejeitado", () => {
      expect(() =>
        resolveEnqueueContract({
          workspaceId: "nexo",
          objective: "[CONSOLIDATE] x",
          missionKind: MissionKind.CONSOLIDATE,
        }),
      ).toThrow(/parentMissionId/);
    });

    it("CONSOLIDATE do ciclo da fila resolve owner = Opera", () => {
      const resolved = resolveEnqueueContract({
        workspaceId: "nexo",
        objective: "[CONSOLIDATE] x",
        missionKind: MissionKind.CONSOLIDATE,
        parentMissionId: "root-coord",
        ownerEmployeeId: "cto-mag",
      });
      expect(resolved.missionKind).toBe(MissionKind.CONSOLIDATE);
      expect(resolved.ownerEmployeeId).toBe(CEO_EMPLOYEE_ID);
    });
  });
});
