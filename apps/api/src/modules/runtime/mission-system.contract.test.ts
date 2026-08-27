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
import { InMemoryCoordinationLatchStore } from "./supervisor/infrastructure/in-memory-coordination-latch-store.js";
import type { SupervisorLoggerPort } from "./supervisor/ports.js";
import { errorHandler } from "../../shared/error-handler.js";

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

      await new CoordinationDispatcher(queue as never, noopLogger(), new InMemoryCoordinationLatchStore()).dispatch({
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

describe("F7.1 — GET /api/v1/missions/:id (entrega persistida)", () => {
  function storedCeo(): {
    employeeId: string;
    output: {
      decision: {
        analyzed: string;
        decision: string;
        reasoning: string;
        recommendations: string[];
        risks: string[];
        nextActions: string[];
        delegations: unknown[];
      };
      report: {
        summary: string;
        analysis: string;
        plan: string[];
        recommendations: string[];
        risks: string[];
        nextActions: string[];
      };
      quality: { passed: boolean; issues: unknown[] };
    };
  } {
    return {
      employeeId: CEO_EMPLOYEE_ID,
      output: {
        decision: {
          analyzed: "analise",
          decision: "delegar",
          reasoning: "motivo",
          recommendations: [],
          risks: [],
          nextActions: ["seguir"],
          delegations: [],
        },
        report: {
          summary: "Resumo consolidado F7.1",
          analysis: "a",
          plan: [],
          recommendations: [],
          risks: [],
          nextActions: ["seguir"],
        },
        quality: { passed: true, issues: [] },
      },
    };
  }

  function storedSpecialist(): ReturnType<typeof storedCeo> {
    return {
      employeeId: "cto-mag",
      output: {
        decision: {
          analyzed: "auth",
          decision: "implementar",
          reasoning: "ok",
          recommendations: [],
          risks: [],
          nextActions: [],
          delegations: [],
        },
        report: {
          summary: "Auth analisada",
          analysis: "",
          plan: [],
          recommendations: [],
          risks: [],
          nextActions: [],
        },
        quality: { passed: true, issues: [] },
      },
    };
  }

  async function buildApp(queue: {
    get: (id: string) => Promise<unknown>;
    listChildren: (id: string) => Promise<unknown[]>;
    list?: () => Promise<unknown[]>;
    listTree?: () => Promise<unknown[]>;
    enqueue?: (input: unknown) => Promise<unknown>;
  }) {
    const runtime = {
      queue: {
        async list() {
          return [];
        },
        async listTree() {
          return [];
        },
        async enqueue() {
          throw new Error("F7.1 GET nao deve enfileirar");
        },
        ...queue,
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
    app.setErrorHandler(errorHandler);
    await app.register(createRuntimeRoutes(runtime), { prefix: "/api/v1" });
    return app;
  }

  it("A) missao inexistente → 404", async () => {
    const app = await buildApp({
      async get() {
        return null;
      },
      async listChildren() {
        return [];
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/missions/missing-id",
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({
      code: "NOT_FOUND",
    });
    await app.close();
  });

  it("B) COMPLETED com resultJson → 200 e usableResult", async () => {
    const ceo = storedCeo();
    const rootId = "root-completed-f71";
    const app = await buildApp({
      async get(id: string) {
        if (id !== rootId) {
          return null;
        }
        return {
          id: rootId,
          status: "COMPLETED",
          workspaceId: "operaia-lab",
          objective: "Fechar autenticacao",
          missionKind: MissionKind.COORDINATE,
          ownerEmployeeId: CEO_EMPLOYEE_ID,
          requiredSpecialization: null,
          parentMissionId: null,
          resultJson: {
            phase: "consolidated",
            initial: ceo,
            usableResult: "Entrega consolidada F7.1",
            final: ceo,
          },
          startedAt: new Date("2026-08-14T16:00:00.000Z"),
          finishedAt: new Date("2026-08-14T16:05:00.000Z"),
          events: [],
        };
      },
      async listChildren() {
        return [];
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/missions/${rootId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      id: string;
      status: string;
      usableResult: string | null;
      reply: { content: string } | null;
    };
    expect(body.id).toBe(rootId);
    expect(body.status).toBe("COMPLETED");
    expect(body.usableResult).toBe("Entrega consolidada F7.1");
    expect(body.reply).not.toBeNull();
    await app.close();
  });

  it("C) filho EXECUTE + delivery_created observavel", async () => {
    const ceo = storedCeo();
    const specialist = storedSpecialist();
    const rootId = "root-with-child";
    const childId = "exec-child-1";
    const app = await buildApp({
      async get(id: string) {
        if (id !== rootId) {
          return null;
        }
        return {
          id: rootId,
          status: "COMPLETED",
          workspaceId: "operaia-lab",
          objective: "Analisar repositorio",
          missionKind: MissionKind.COORDINATE,
          ownerEmployeeId: CEO_EMPLOYEE_ID,
          requiredSpecialization: null,
          parentMissionId: null,
          resultJson: {
            phase: "consolidated",
            initial: ceo,
            usableResult: "Analise consolidada",
            final: ceo,
          },
          startedAt: new Date("2026-08-14T16:00:00.000Z"),
          finishedAt: new Date("2026-08-14T16:05:00.000Z"),
          events: [
            {
              id: "evt-root-1",
              missionId: rootId,
              type: "claimed",
              message: "Claim por operaia-ceo",
              createdAt: new Date("2026-08-14T16:00:01.000Z"),
            },
          ],
        };
      },
      async listChildren(parentId: string) {
        expect(parentId).toBe(rootId);
        return [
          {
            id: childId,
            status: "COMPLETED",
            workspaceId: "operaia-lab",
            objective: "Analisar estrutura",
            missionKind: MissionKind.EXECUTE,
            ownerEmployeeId: "cto-mag",
            requiredSpecialization: Specialization.SOFTWARE_ENGINEERING,
            parentMissionId: rootId,
            resultJson: {
              phase: "executed",
              employeeResult: specialist,
              delivery: {
                type: "technical_analysis",
                status: "DELIVERED",
                summary: "Analise ok",
                findings: ["repo ok"],
                evidence: [{ source: "readRepository", data: {} }],
                recommendations: [],
                missionId: childId,
                employeeId: "cto-mag",
                objective: "Analisar estrutura",
                deliveredAt: "2026-08-14T16:04:00.000Z",
              },
            },
            startedAt: new Date("2026-08-14T16:01:00.000Z"),
            finishedAt: new Date("2026-08-14T16:04:00.000Z"),
            events: [
              {
                id: "evt-delivery-1",
                missionId: childId,
                type: "delivery_created",
                message: "Delivery technical_analysis DELIVERED",
                createdAt: new Date("2026-08-14T16:03:59.000Z"),
                payload: { deliveryType: "technical_analysis", success: true },
              },
            ],
          },
        ];
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/missions/${rootId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      children: { id: string; missionKind: string }[];
      events: { type: string; missionId: string; message?: string; payload?: unknown }[];
      specialists: { matched: boolean; employeeId?: string }[];
      usableResult: string | null;
    };
    expect(body.children).toHaveLength(1);
    expect(body.children[0]?.id).toBe(childId);
    expect(body.children[0]?.missionKind).toBe(MissionKind.EXECUTE);
    const deliveryEvents = body.events.filter(
      (e) => e.type === "delivery_created",
    );
    expect(deliveryEvents).toHaveLength(1);
    expect(deliveryEvents[0]?.missionId).toBe(childId);
    expect(body.specialists.some((s) => s.matched && s.employeeId === "cto-mag")).toBe(
      true,
    );
    expect(body.usableResult).toBe("Analise consolidada");
    await app.close();
  });

  it("C1) delivery no resultJson sem delivery_created persistido (sintetiza)", async () => {
    const ceo = storedCeo();
    const specialist = storedSpecialist();
    const rootId = "root-with-delivery-no-event";
    const childId = "exec-child-no-event";
    const app = await buildApp({
      async get(id: string) {
        if (id !== rootId) {
          return null;
        }
        return {
          id: rootId,
          status: "COMPLETED",
          workspaceId: "operaia-lab",
          objective: "Analisar repositorio",
          missionKind: MissionKind.COORDINATE,
          ownerEmployeeId: CEO_EMPLOYEE_ID,
          requiredSpecialization: null,
          parentMissionId: null,
          resultJson: {
            phase: "consolidated",
            initial: ceo,
            usableResult: "Analise consolidada",
            final: ceo,
          },
          startedAt: new Date("2026-08-14T16:00:00.000Z"),
          finishedAt: new Date("2026-08-14T16:05:00.000Z"),
          events: [
            {
              id: "evt-root-1",
              missionId: rootId,
              type: "claimed",
              message: "Claim por operaia-ceo",
              createdAt: new Date("2026-08-14T16:00:01.000Z"),
            },
          ],
        };
      },
      async listChildren(parentId: string) {
        expect(parentId).toBe(rootId);
        return [
          {
            id: childId,
            status: "COMPLETED",
            workspaceId: "operaia-lab",
            objective: "Analisar estrutura",
            missionKind: MissionKind.EXECUTE,
            ownerEmployeeId: "cto-mag",
            requiredSpecialization: Specialization.SOFTWARE_ENGINEERING,
            parentMissionId: rootId,
            resultJson: {
              phase: "executed",
              employeeResult: specialist,
              delivery: {
                type: "technical_analysis",
                status: "DELIVERED",
                summary: "Analise ok",
                findings: ["repo ok"],
                evidence: [{ source: "readRepository", data: {} }],
                recommendations: [],
                missionId: childId,
                employeeId: "cto-mag",
                objective: "Analisar estrutura",
                deliveredAt: "2026-08-14T16:04:00.000Z",
              },
            },
            startedAt: new Date("2026-08-14T16:01:00.000Z"),
            finishedAt: new Date("2026-08-14T16:04:00.000Z"),
            events: [],
          },
        ];
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/missions/${rootId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      events: { type: string; missionId: string; message?: string }[];
    };
    const deliveryEvents = body.events.filter(
      (e) => e.type === "delivery_created",
    );
    expect(deliveryEvents).toHaveLength(1);
    expect(deliveryEvents[0]?.missionId).toBe(childId);
    expect(deliveryEvents[0]?.message).toContain("DELIVERED");
    await app.close();
  });

  it("C2) delivery_created duplicado persistido (resposta normalizada deduplica)", async () => {
    const ceo = storedCeo();
    const specialist = storedSpecialist();
    const rootId = "root-with-delivery-dup-event";
    const childId = "exec-child-dup-event";
    const app = await buildApp({
      async get(id: string) {
        if (id !== rootId) {
          return null;
        }
        return {
          id: rootId,
          status: "COMPLETED",
          workspaceId: "operaia-lab",
          objective: "Analisar repositorio",
          missionKind: MissionKind.COORDINATE,
          ownerEmployeeId: CEO_EMPLOYEE_ID,
          requiredSpecialization: null,
          parentMissionId: null,
          resultJson: {
            phase: "consolidated",
            initial: ceo,
            usableResult: "Analise consolidada",
            final: ceo,
          },
          startedAt: new Date("2026-08-14T16:00:00.000Z"),
          finishedAt: new Date("2026-08-14T16:05:00.000Z"),
          events: [],
        };
      },
      async listChildren(parentId: string) {
        expect(parentId).toBe(rootId);
        return [
          {
            id: childId,
            status: "COMPLETED",
            workspaceId: "operaia-lab",
            objective: "Analisar estrutura",
            missionKind: MissionKind.EXECUTE,
            ownerEmployeeId: "cto-mag",
            requiredSpecialization: Specialization.SOFTWARE_ENGINEERING,
            parentMissionId: rootId,
            resultJson: {
              phase: "executed",
              employeeResult: specialist,
              delivery: {
                type: "technical_analysis",
                status: "DELIVERED",
                summary: "Analise ok",
                findings: ["repo ok"],
                evidence: [{ source: "readRepository", data: {} }],
                recommendations: [],
                missionId: childId,
                employeeId: "cto-mag",
                objective: "Analisar estrutura",
                deliveredAt: "2026-08-14T16:04:00.000Z",
              },
            },
            startedAt: new Date("2026-08-14T16:01:00.000Z"),
            finishedAt: new Date("2026-08-14T16:04:00.000Z"),
            events: [
              {
                id: "evt-delivery-1",
                missionId: childId,
                type: "delivery_created",
                message: "Delivery technical_analysis DELIVERED",
                createdAt: new Date("2026-08-14T16:03:59.000Z"),
                payload: { deliveryType: "technical_analysis", success: true },
              },
              {
                id: "evt-delivery-2",
                missionId: childId,
                type: "delivery_created",
                message: "Delivery technical_analysis DELIVERED",
                createdAt: new Date("2026-08-14T16:04:00.000Z"),
                payload: { deliveryType: "technical_analysis", success: true },
              },
            ],
          },
        ];
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/missions/${rootId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      events: { type: string; missionId: string; message?: string }[];
    };
    const deliveryEvents = body.events.filter(
      (e) => e.type === "delivery_created",
    );
    expect(deliveryEvents).toHaveLength(1);
    expect(deliveryEvents[0]?.missionId).toBe(childId);
    expect(deliveryEvents[0]?.message).toContain("DELIVERED");
    await app.close();
  });

  it("C3) delivery FAILED no resultJson sem delivery_created persistido (observavel)", async () => {
    const ceo = storedCeo();
    const specialist = storedSpecialist();
    const rootId = "root-with-failed-delivery";
    const childId = "exec-child-failed";
    const app = await buildApp({
      async get(id: string) {
        if (id !== rootId) {
          return null;
        }
        return {
          id: rootId,
          status: "COMPLETED",
          workspaceId: "operaia-lab",
          objective: "Analisar repositorio",
          missionKind: MissionKind.COORDINATE,
          ownerEmployeeId: CEO_EMPLOYEE_ID,
          requiredSpecialization: null,
          parentMissionId: null,
          resultJson: {
            phase: "consolidated",
            initial: ceo,
            usableResult: "Analise consolidada",
            final: ceo,
          },
          startedAt: new Date("2026-08-14T16:00:00.000Z"),
          finishedAt: new Date("2026-08-14T16:05:00.000Z"),
          events: [],
        };
      },
      async listChildren(parentId: string) {
        expect(parentId).toBe(rootId);
        return [
          {
            id: childId,
            status: "COMPLETED",
            workspaceId: "operaia-lab",
            objective: "Analisar estrutura",
            missionKind: MissionKind.EXECUTE,
            ownerEmployeeId: "cto-mag",
            requiredSpecialization: Specialization.SOFTWARE_ENGINEERING,
            parentMissionId: rootId,
            resultJson: {
              phase: "executed",
              employeeResult: specialist,
              delivery: {
                type: "technical_analysis",
                status: "FAILED",
                summary: "Falha na entrega",
                findings: [],
                evidence: [],
                recommendations: [],
                missionId: childId,
                employeeId: "cto-mag",
                objective: "Analisar estrutura",
                deliveredAt: "2026-08-14T16:04:00.000Z",
              },
            },
            startedAt: new Date("2026-08-14T16:01:00.000Z"),
            finishedAt: new Date("2026-08-14T16:04:00.000Z"),
            events: [],
          },
        ];
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/missions/${rootId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      events: { type: string; missionId: string; message?: string }[];
    };
    const deliveryEvents = body.events.filter(
      (e) => e.type === "delivery_created",
    );
    expect(deliveryEvents).toHaveLength(1);
    expect(deliveryEvents[0]?.missionId).toBe(childId);
    expect(deliveryEvents[0]?.message).toContain("FAILED");
    await app.close();
  });

  it("C4) multiplos filhos (2x DELIVERED, 1x FAILED) entregam deliveries distintas e deterministicas", async () => {
    const ceo = storedCeo();
    const rootId = "root-multi-children-delivery";
    const app = await buildApp({
      async get(id: string) {
        if (id !== rootId) {
          return null;
        }
        return {
          id: rootId,
          status: "COMPLETED",
          workspaceId: "operaia-lab",
          objective: "Analisar repositorio",
          missionKind: MissionKind.COORDINATE,
          ownerEmployeeId: CEO_EMPLOYEE_ID,
          requiredSpecialization: null,
          parentMissionId: null,
          resultJson: {
            phase: "consolidated",
            initial: ceo,
            usableResult: "Analise consolidada",
            final: ceo,
          },
          startedAt: new Date("2026-08-14T16:00:00.000Z"),
          finishedAt: new Date("2026-08-14T16:05:00.000Z"),
          events: [],
        };
      },
      async listChildren(parentId: string) {
        expect(parentId).toBe(rootId);
        return [
          {
            id: "exec-child-A",
            status: "COMPLETED",
            workspaceId: "operaia-lab",
            objective: "child A",
            missionKind: MissionKind.EXECUTE,
            ownerEmployeeId: "cto-mag",
            requiredSpecialization: Specialization.SOFTWARE_ENGINEERING,
            parentMissionId: rootId,
            resultJson: {
              phase: "executed",
              employeeResult: storedSpecialist(),
              delivery: {
                type: "technical_analysis",
                status: "DELIVERED",
                summary: "OK A",
                findings: [],
                evidence: [],
                recommendations: [],
                missionId: "exec-child-A",
                employeeId: "cto-mag",
                objective: "child A",
                deliveredAt: "2026-08-14T16:04:00.000Z",
              },
            },
            startedAt: new Date("2026-08-14T16:01:00.000Z"),
            finishedAt: new Date("2026-08-14T16:04:00.000Z"),
            events: [],
          },
          {
            id: "exec-child-B",
            status: "COMPLETED",
            workspaceId: "operaia-lab",
            objective: "child B",
            missionKind: MissionKind.EXECUTE,
            ownerEmployeeId: "cto-mag",
            requiredSpecialization: Specialization.SOFTWARE_ENGINEERING,
            parentMissionId: rootId,
            resultJson: {
              phase: "executed",
              employeeResult: storedSpecialist(),
              delivery: {
                type: "technical_analysis",
                status: "DELIVERED",
                summary: "OK B",
                findings: [],
                evidence: [],
                recommendations: [],
                missionId: "exec-child-B",
                employeeId: "cto-mag",
                objective: "child B",
                deliveredAt: "2026-08-14T16:04:10.000Z",
              },
            },
            startedAt: new Date("2026-08-14T16:01:10.000Z"),
            finishedAt: new Date("2026-08-14T16:04:10.000Z"),
            events: [],
          },
          {
            id: "exec-child-C",
            status: "COMPLETED",
            workspaceId: "operaia-lab",
            objective: "child C",
            missionKind: MissionKind.EXECUTE,
            ownerEmployeeId: "cto-mag",
            requiredSpecialization: Specialization.SOFTWARE_ENGINEERING,
            parentMissionId: rootId,
            resultJson: {
              phase: "executed",
              employeeResult: storedSpecialist(),
              delivery: {
                type: "technical_analysis",
                status: "FAILED",
                summary: "Falha C",
                findings: [],
                evidence: [],
                recommendations: [],
                missionId: "exec-child-C",
                employeeId: "cto-mag",
                objective: "child C",
                deliveredAt: "2026-08-14T16:04:20.000Z",
              },
            },
            startedAt: new Date("2026-08-14T16:01:20.000Z"),
            finishedAt: new Date("2026-08-14T16:04:20.000Z"),
            events: [],
          },
        ];
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/missions/${rootId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      events: { type: string; missionId: string; message?: string }[];
    };

    const deliveryEvents = body.events.filter(
      (e) => e.type === "delivery_created",
    );
    expect(deliveryEvents).toHaveLength(3);

    const byMissionId = new Map(
      deliveryEvents.map((e) => [e.missionId, e.message ?? ""]),
    );
    expect(byMissionId.get("exec-child-A")).toContain("DELIVERED");
    expect(byMissionId.get("exec-child-B")).toContain("DELIVERED");
    expect(byMissionId.get("exec-child-C")).toContain("FAILED");
    await app.close();
  });

  it("D) resposta nao depende de OperationalRunStore", async () => {
    const ceo = storedCeo();
    const rootId = "root-no-ram-store";
    let getCalls = 0;
    const app = await buildApp({
      async get(id: string) {
        getCalls += 1;
        if (id !== rootId) {
          return null;
        }
        return {
          id: rootId,
          status: "COMPLETED",
          workspaceId: "operaia-lab",
          objective: "Persistencia e a fonte",
          missionKind: MissionKind.COORDINATE,
          ownerEmployeeId: CEO_EMPLOYEE_ID,
          requiredSpecialization: null,
          parentMissionId: null,
          resultJson: {
            phase: "consolidated",
            initial: ceo,
            usableResult: "So do PostgreSQL/resultJson",
            final: ceo,
          },
          startedAt: new Date("2026-08-14T16:00:00.000Z"),
          finishedAt: new Date("2026-08-14T16:05:00.000Z"),
          events: [],
        };
      },
      async listChildren() {
        return [
          {
            id: "exec-child-for-restart",
            status: "COMPLETED",
            workspaceId: "operaia-lab",
            objective: "Analisar estrutura",
            missionKind: MissionKind.EXECUTE,
            ownerEmployeeId: "cto-mag",
            requiredSpecialization: Specialization.SOFTWARE_ENGINEERING,
            parentMissionId: rootId,
            resultJson: {
              phase: "executed",
              employeeResult: storedSpecialist(),
              delivery: {
                type: "technical_analysis",
                status: "DELIVERED",
                summary: "Persistido, sem RAM",
                findings: [],
                evidence: [],
                recommendations: [],
                missionId: "exec-child-for-restart",
                employeeId: "cto-mag",
                objective: "Analisar estrutura",
                deliveredAt: "2026-08-14T16:04:00.000Z",
              },
            },
            startedAt: new Date("2026-08-14T16:01:00.000Z"),
            finishedAt: new Date("2026-08-14T16:04:00.000Z"),
            events: [],
          },
        ];
      },
    });

    const first = await app.inject({
      method: "GET",
      url: `/api/v1/missions/${rootId}`,
    });
    const second = await app.inject({
      method: "GET",
      url: `/api/v1/missions/${rootId}`,
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.json()).toMatchObject({
      usableResult: "So do PostgreSQL/resultJson",
    });
    expect(second.json()).toMatchObject({
      usableResult: "So do PostgreSQL/resultJson",
    });
    const firstBody = first.json() as {
      events: { type: string; missionId: string; message?: string }[];
    };
    const deliveryEvents = firstBody.events.filter(
      (e) => e.type === "delivery_created",
    );
    expect(deliveryEvents).toHaveLength(1);
    expect(deliveryEvents[0]?.message).toContain("DELIVERED");
    // Cada GET consulta a fila persistente (mock = get), sem cache/store RAM.
    expect(getCalls).toBe(2);
    await app.close();
  });
});
