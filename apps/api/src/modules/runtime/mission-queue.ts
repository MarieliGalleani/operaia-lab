import { createHash } from "node:crypto";
import {
  MissionKind as PrismaMissionKind,
  MissionStatus,
  prisma,
  type Mission,
  type Prisma,
} from "@operaia/database";
import type { Priority } from "@operaia/shared";
import {
  CEO_EMPLOYEE_ID,
  MissionKind,
  MissionQueueStatus,
} from "./mission-states.js";
import {
  asJson,
  mergeConsolidatePreservingInitial,
} from "./mission-result-store.js";
import { isRunningMissionAbandoned } from "./worker-liveness.js";

export interface EnqueueMissionInput {
  readonly workspaceId: string;
  readonly projectId?: string;
  readonly objective: string;
  readonly priority?: Priority;
  readonly ownerEmployeeId?: string;
  readonly requiredSpecialization?: string;
  readonly parentMissionId?: string;
  readonly missionKind?: MissionKind;
  readonly scheduledAt?: Date;
  readonly maxAttempts?: number;
  readonly readiness?: "READY" | "BLOCKED";
  /** Se true, nao cria se ja existir ativa com mesmo hash (so COORDINATE raiz). */
  readonly dedupe?: boolean;
}

/** Erro de contrato ADR-007 (MissionQueue). */
export class MissionEnqueueContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissionEnqueueContractError";
  }
}

/**
 * MQ-2 — a execucao perdeu ownership (leaseVersion/status nao batem).
 * Deterministico: complete/fail/markWaiting devem rejeitar, nao engolir.
 */
export class StaleMissionOwnershipError extends Error {
  readonly missionId: string;
  readonly expectedLeaseVersion: number;

  constructor(missionId: string, expectedLeaseVersion: number) {
    super(
      `StaleMissionOwnership: mission=${missionId} leaseVersion=${expectedLeaseVersion}`,
    );
    this.name = "StaleMissionOwnershipError";
    this.missionId = missionId;
    this.expectedLeaseVersion = expectedLeaseVersion;
  }
}

export interface ResolvedEnqueueContract {
  readonly missionKind: MissionKind;
  readonly ownerEmployeeId: string;
}

/**
 * ADR-007 Fase 1 — resolve e valida contrato de enqueue.
 * COORDINATE raiz → owner Opera; EXECUTE só com pai+spec; CONSOLIDATE só com pai+Opera.
 */
export function resolveEnqueueContract(
  input: EnqueueMissionInput,
): ResolvedEnqueueContract {
  const missionKind = input.missionKind ?? MissionKind.COORDINATE;

  if (missionKind === MissionKind.COORDINATE) {
    if (input.parentMissionId) {
      throw new MissionEnqueueContractError(
        "COORDINATE raiz nao pode ter parentMissionId",
      );
    }
    return {
      missionKind,
      ownerEmployeeId: CEO_EMPLOYEE_ID,
    };
  }

  if (missionKind === MissionKind.EXECUTE) {
    if (!input.parentMissionId) {
      throw new MissionEnqueueContractError(
        "EXECUTE somente pos-delegacao: parentMissionId obrigatorio",
      );
    }
    if (!input.requiredSpecialization?.trim()) {
      throw new MissionEnqueueContractError(
        "EXECUTE requer requiredSpecialization",
      );
    }
    return {
      missionKind,
      ownerEmployeeId: input.ownerEmployeeId ?? "unmatched",
    };
  }

  if (missionKind === MissionKind.CONSOLIDATE) {
    if (!input.parentMissionId) {
      throw new MissionEnqueueContractError(
        "CONSOLIDATE somente pelo ciclo da MissionQueue: parentMissionId obrigatorio",
      );
    }
    return {
      missionKind,
      ownerEmployeeId: CEO_EMPLOYEE_ID,
    };
  }

  throw new MissionEnqueueContractError(
    `missionKind invalido para enqueue: ${String(missionKind)}`,
  );
}

export interface ClaimCriteria {
  readonly employeeId: string;
  readonly specialization: string;
}

export interface QueueDepths {
  readonly queued: number;
  readonly running: number;
  readonly waiting: number;
  readonly failed: number;
}

export interface MissionTreeNode {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string | null;
  readonly objective: string;
  readonly missionKind: string;
  readonly status: string;
  readonly ownerEmployeeId: string;
  readonly requiredSpecialization: string | null;
  readonly parentMissionId: string | null;
  readonly progress: number;
  readonly attempt: number;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly createdAt: string;
  readonly children: MissionTreeNode[];
}

const OPEN_STATUSES: MissionStatus[] = [
  MissionStatus.CREATED,
  MissionStatus.QUEUED,
  MissionStatus.RUNNING,
  MissionStatus.WAITING,
];

export function hashObjective(workspaceId: string, objective: string): string {
  return createHash("sha256")
    .update(`${workspaceId}\0${objective.trim()}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Fila persistente de missoes (Postgres + SKIP LOCKED).
 */
export class MissionQueue {
  async enqueue(
    input: EnqueueMissionInput,
  ): Promise<{ mission: Mission; created: boolean }> {
    const { missionKind, ownerEmployeeId } = resolveEnqueueContract(input);
    const objectiveHash = hashObjective(input.workspaceId, input.objective);
    const shouldDedupe =
      input.dedupe === true &&
      missionKind === MissionKind.COORDINATE &&
      !input.parentMissionId;

    if (shouldDedupe) {
      const existing = await prisma.mission.findFirst({
        where: {
          workspaceId: input.workspaceId,
          objectiveHash,
          missionKind: PrismaMissionKind.COORDINATE,
          status: { in: OPEN_STATUSES },
        },
        orderBy: { createdAt: "desc" },
      });
      if (existing) {
        return { mission: existing, created: false };
      }
    }

    const mission = await prisma.mission.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        objective: input.objective,
        objectiveHash,
        missionKind: missionKind as PrismaMissionKind,
        priority: input.priority ?? "MEDIUM",
        status: MissionStatus.QUEUED,
        readiness: input.readiness ?? "READY",
        ownerEmployeeId,
        requiredSpecialization: input.requiredSpecialization,
        parentMissionId: input.parentMissionId,
        maxAttempts: input.maxAttempts ?? 3,
        scheduledAt: input.scheduledAt ?? new Date(),
        progress: 0,
        attempt: 0,
      },
    });

    await this.appendEvent(mission.id, "enqueued", "Missao enfileirada", {
      ownerEmployeeId,
      workspaceId: input.workspaceId,
      missionKind,
      parentMissionId: input.parentMissionId,
      requiredSpecialization: input.requiredSpecialization,
    });

    return { mission, created: true };
  }

  /**
   * Localiza missao por objectiveHash (qualquer status), opcionalmente
   * desde createdAtGte — usado no recovery de latch PENDING orfao.
   */
  async findByObjectiveHash(
    workspaceId: string,
    objectiveHash: string,
    options?: { readonly createdAtGte?: Date },
  ): Promise<{ id: string; status: string } | null> {
    const row = await prisma.mission.findFirst({
      where: {
        workspaceId,
        objectiveHash,
        missionKind: PrismaMissionKind.COORDINATE,
        ...(options?.createdAtGte
          ? { createdAt: { gte: options.createdAtGte } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true },
    });
    return row;
  }

  /**
   * CEO: COORDINATE ou CONSOLIDATE.
   * Especialistas: EXECUTE por specialization.
   */
  async claim(criteria: ClaimCriteria): Promise<Mission | null> {
    const isCeo = criteria.employeeId === CEO_EMPLOYEE_ID;

    return prisma.$transaction(async (tx) => {
      const rows = isCeo
        ? await tx.$queryRaw<Mission[]>`
            SELECT * FROM missions
            WHERE status = 'QUEUED'::"MissionStatus"
              AND "ownerEmployeeId" = ${CEO_EMPLOYEE_ID}
              AND "missionKind" IN ('COORDINATE'::"MissionKind", 'CONSOLIDATE'::"MissionKind")
              AND ("scheduledAt" IS NULL OR "scheduledAt" <= NOW())
            ORDER BY
              CASE "priority"
                WHEN 'URGENT' THEN 0
                WHEN 'HIGH' THEN 1
                WHEN 'MEDIUM' THEN 2
                ELSE 3
              END,
              "createdAt" ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
          `
        : await tx.$queryRaw<Mission[]>`
            SELECT * FROM missions
            WHERE status = 'QUEUED'::"MissionStatus"
              AND "missionKind" = 'EXECUTE'::"MissionKind"
              AND "readiness" = 'READY'::"MissionReadiness"
              AND "requiredSpecialization" = ${criteria.specialization}
              AND ("scheduledAt" IS NULL OR "scheduledAt" <= NOW())
            ORDER BY
              CASE "priority"
                WHEN 'URGENT' THEN 0
                WHEN 'HIGH' THEN 1
                WHEN 'MEDIUM' THEN 2
                ELSE 3
              END,
              "createdAt" ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
          `;

      const row = rows[0];
      if (!row) {
        return null;
      }

      const updated = await tx.mission.update({
        where: { id: row.id },
        data: {
          status: MissionStatus.RUNNING,
          startedAt: new Date(),
          attempt: { increment: 1 },
          leaseVersion: { increment: 1 },
          progress: 10,
          ownerEmployeeId: criteria.employeeId,
        },
      });

      await tx.missionEvent.create({
        data: {
          missionId: updated.id,
          type: "claimed",
          message: `Claim por ${criteria.employeeId}`,
          payload: {
            employeeId: criteria.employeeId,
            specialization: criteria.specialization,
            missionKind: updated.missionKind,
            leaseVersion: updated.leaseVersion,
          } as Prisma.InputJsonValue,
        },
      });

      return updated;
    });
  }

  async markWaiting(
    missionId: string,
    partialResult: Prisma.InputJsonValue,
    expectedLeaseVersion: number,
  ): Promise<Mission> {
    const updated = await prisma.mission.updateMany({
      where: {
        id: missionId,
        status: MissionStatus.RUNNING,
        leaseVersion: expectedLeaseVersion,
      },
      data: {
        status: MissionStatus.WAITING,
        progress: 50,
        resultJson: partialResult,
      },
    });
    if (updated.count !== 1) {
      throw new StaleMissionOwnershipError(missionId, expectedLeaseVersion);
    }
    const mission = await prisma.mission.findUniqueOrThrow({
      where: { id: missionId },
    });
    await this.appendEvent(missionId, "waiting", "Aguardando filhos", {
      childCount: await prisma.mission.count({
        where: { parentMissionId: missionId },
      }),
      leaseVersion: expectedLeaseVersion,
    });
    return mission;
  }

  async complete(
    missionId: string,
    result: Prisma.InputJsonValue,
    expectedLeaseVersion: number,
  ): Promise<Mission> {
    const updated = await prisma.mission.updateMany({
      where: {
        id: missionId,
        status: MissionStatus.RUNNING,
        leaseVersion: expectedLeaseVersion,
      },
      data: {
        status: MissionStatus.COMPLETED,
        progress: 100,
        finishedAt: new Date(),
        resultJson: result,
        lastError: null,
      },
    });
    if (updated.count !== 1) {
      throw new StaleMissionOwnershipError(missionId, expectedLeaseVersion);
    }
    const mission = await prisma.mission.findUniqueOrThrow({
      where: { id: missionId },
    });
    await this.appendEvent(missionId, "completed", "Missao concluida", {
      leaseVersion: expectedLeaseVersion,
    });
    await this.promoteReadyDependents(missionId);
    return mission;
  }

  async linkDependency(
    missionId: string,
    dependsOnMissionId: string,
  ): Promise<void> {
    if (missionId === dependsOnMissionId) {
      return;
    }
    await prisma.missionDependency.upsert({
      where: {
        missionId_dependsOnMissionId: {
          missionId,
          dependsOnMissionId,
        },
      },
      create: { missionId, dependsOnMissionId },
      update: {},
    });
    await prisma.mission.update({
      where: { id: missionId },
      data: { readiness: "BLOCKED" },
    });
  }

  /** Promove sucessoras cujas predecessoras estao COMPLETED. */
  async promoteReadyDependents(completedMissionId: string): Promise<number> {
    const dependents = await prisma.missionDependency.findMany({
      where: { dependsOnMissionId: completedMissionId },
    });
    let promoted = 0;
    for (const edge of dependents) {
      const preds = await prisma.missionDependency.findMany({
        where: { missionId: edge.missionId },
        include: { dependsOn: true },
      });
      const allDone = preds.every(
        (pred) => pred.dependsOn.status === MissionStatus.COMPLETED,
      );
      if (!allDone) {
        continue;
      }
      await prisma.mission.update({
        where: { id: edge.missionId },
        data: { readiness: "READY", scheduledAt: new Date() },
      });
      await this.appendEvent(
        edge.missionId,
        "unblocked",
        "Dependencias concluidas — missao READY",
      );
      promoted += 1;
    }
    return promoted;
  }

  async completeConsolidation(
    consolidateMissionId: string,
    rootMissionId: string,
    result: Prisma.InputJsonValue,
    expectedLeaseVersion: number,
  ): Promise<{ consolidate: Mission; root: Mission }> {
    const rootBefore = await prisma.mission.findUnique({
      where: { id: rootMissionId },
    });
    if (!rootBefore) {
      throw new Error(`Raiz nao encontrada para consolidacao: ${rootMissionId}`);
    }

    // ADR-007 Fase 2.1: nao descartar CoordinatePhaseResult.initial ao sobrescrever.
    const merged = mergeConsolidatePreservingInitial(
      rootBefore.resultJson,
      result,
    );
    const mergedJson = asJson(merged);

    const consolidate = await this.complete(
      consolidateMissionId,
      mergedJson,
      expectedLeaseVersion,
    );
    const root = await prisma.mission.update({
      where: { id: rootMissionId },
      data: {
        status: MissionStatus.COMPLETED,
        progress: 100,
        finishedAt: new Date(),
        resultJson: mergedJson,
        lastError: null,
      },
    });
    await this.appendEvent(rootMissionId, "completed", "Raiz consolidada");
    return { consolidate, root };
  }

  async fail(
    missionId: string,
    error: string,
    expectedLeaseVersion: number,
  ): Promise<Mission> {
    const current = await prisma.mission.findUniqueOrThrow({
      where: { id: missionId },
    });

    if (
      current.status !== MissionStatus.RUNNING ||
      current.leaseVersion !== expectedLeaseVersion
    ) {
      throw new StaleMissionOwnershipError(missionId, expectedLeaseVersion);
    }

    const canRetry = current.attempt < current.maxAttempts;
    const updated = await prisma.mission.updateMany({
      where: {
        id: missionId,
        status: MissionStatus.RUNNING,
        leaseVersion: expectedLeaseVersion,
      },
      data: canRetry
        ? {
            status: MissionStatus.QUEUED,
            lastError: error,
            scheduledAt: new Date(Date.now() + backoffMs(current.attempt)),
            startedAt: null,
            progress: 0,
          }
        : {
            status: MissionStatus.FAILED,
            lastError: error,
            finishedAt: new Date(),
            progress: 100,
          },
    });

    if (updated.count !== 1) {
      throw new StaleMissionOwnershipError(missionId, expectedLeaseVersion);
    }

    const mission = await prisma.mission.findUniqueOrThrow({
      where: { id: missionId },
    });

    await this.appendEvent(
      missionId,
      canRetry ? "requeued" : "failed",
      canRetry ? `Retry agendado: ${error}` : `Falha final: ${error}`,
      {
        attempt: current.attempt,
        maxAttempts: current.maxAttempts,
        leaseVersion: expectedLeaseVersion,
      },
    );

    return mission;
  }

  /**
   * Quando um filho EXECUTE termina, verifica se pode enfileirar CONSOLIDATE.
   */
  async maybeEnqueueConsolidation(rootMissionId: string): Promise<boolean> {
    const root = await prisma.mission.findUnique({
      where: { id: rootMissionId },
    });
    if (!root || root.status !== MissionStatus.WAITING) {
      return false;
    }

    const children = await prisma.mission.findMany({
      where: {
        parentMissionId: rootMissionId,
        missionKind: PrismaMissionKind.EXECUTE,
      },
    });
    if (children.length === 0) {
      return false;
    }

    const allDone = children.every(
      (child) =>
        child.status === MissionStatus.COMPLETED ||
        child.status === MissionStatus.FAILED,
    );
    if (!allDone) {
      return false;
    }

    const existing = await prisma.mission.findFirst({
      where: {
        parentMissionId: rootMissionId,
        missionKind: PrismaMissionKind.CONSOLIDATE,
        status: { in: OPEN_STATUSES },
      },
    });
    if (existing) {
      return false;
    }

    const { created } = await this.enqueue({
      workspaceId: root.workspaceId,
      projectId: root.projectId ?? undefined,
      objective: `[CONSOLIDATE] ${root.objective}`,
      parentMissionId: rootMissionId,
      missionKind: MissionKind.CONSOLIDATE,
      ownerEmployeeId: CEO_EMPLOYEE_ID,
      requiredSpecialization: "MANAGEMENT",
      priority: root.priority,
      dedupe: false,
    });

    if (created) {
      await this.appendEvent(
        rootMissionId,
        "consolidation_enqueued",
        "Consolidacao enfileirada para Opera",
      );
    }
    return created;
  }

  async listChildren(parentMissionId: string): Promise<readonly Mission[]> {
    return prisma.mission.findMany({
      where: { parentMissionId },
      orderBy: { createdAt: "asc" },
      include: { events: { orderBy: { createdAt: "asc" } } },
    });
  }

  async list(filters?: {
    readonly status?: MissionStatus;
    readonly workspaceId?: string;
    readonly take?: number;
  }) {
    return prisma.mission.findMany({
      where: {
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.workspaceId
          ? { workspaceId: filters.workspaceId }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: filters?.take ?? 50,
      include: { events: { orderBy: { createdAt: "asc" }, take: 30 } },
    });
  }

  async listTree(filters?: {
    readonly workspaceId?: string;
    readonly take?: number;
  }): Promise<readonly MissionTreeNode[]> {
    const roots = await prisma.mission.findMany({
      where: {
        parentMissionId: null,
        missionKind: PrismaMissionKind.COORDINATE,
        ...(filters?.workspaceId
          ? { workspaceId: filters.workspaceId }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: filters?.take ?? 20,
    });

    return Promise.all(roots.map((root) => this.buildTreeNode(root.id)));
  }

  private async buildTreeNode(missionId: string): Promise<MissionTreeNode> {
    const mission = await prisma.mission.findUniqueOrThrow({
      where: { id: missionId },
    });
    const children = await prisma.mission.findMany({
      where: { parentMissionId: missionId },
      orderBy: { createdAt: "asc" },
    });
    const childNodes = await Promise.all(
      children.map((child) => this.buildTreeNode(child.id)),
    );
    return {
      id: mission.id,
      workspaceId: mission.workspaceId,
      projectId: mission.projectId,
      objective: mission.objective,
      missionKind: mission.missionKind,
      status: mission.status,
      ownerEmployeeId: mission.ownerEmployeeId,
      requiredSpecialization: mission.requiredSpecialization,
      parentMissionId: mission.parentMissionId,
      progress: mission.progress,
      attempt: mission.attempt,
      startedAt: mission.startedAt?.toISOString() ?? null,
      finishedAt: mission.finishedAt?.toISOString() ?? null,
      createdAt: mission.createdAt.toISOString(),
      children: childNodes,
    };
  }

  async get(id: string) {
    return prisma.mission.findUnique({
      where: { id },
      include: { events: { orderBy: { createdAt: "asc" } } },
    });
  }

  async depths(): Promise<QueueDepths> {
    const [queued, running, waiting, failed] = await Promise.all([
      prisma.mission.count({ where: { status: MissionStatus.QUEUED } }),
      prisma.mission.count({ where: { status: MissionStatus.RUNNING } }),
      prisma.mission.count({ where: { status: MissionStatus.WAITING } }),
      prisma.mission.count({ where: { status: MissionStatus.FAILED } }),
    ]);
    return { queued, running, waiting, failed };
  }

  /**
   * MQ-3 — RUNNING abandonadas segundo WorkerHeartbeat (nao Mission.updatedAt).
   * `livenessMs <= 0` forca todos os RUNNING (provas / boot observavel).
   */
  async listAbandonedRunningIds(livenessMs: number): Promise<readonly string[]> {
    const abandoned = await this.findAbandonedRunning(livenessMs);
    return abandoned.map((mission) => mission.id);
  }

  async recoverStaleRunning(staleAfterMs: number): Promise<number> {
    // staleAfterMs = janela de liveness do heartbeat (lastSeenAt), nao idade de updatedAt.
    const stale = await this.findAbandonedRunning(staleAfterMs);

    let recovered = 0;
    for (const mission of stale) {
      // MQ-2: invalida ownership (leaseVersion++) na mesma atualizacao condicional.
      const updated = await prisma.mission.updateMany({
        where: {
          id: mission.id,
          status: MissionStatus.RUNNING,
          leaseVersion: mission.leaseVersion,
        },
        data: {
          status: MissionStatus.QUEUED,
          startedAt: null,
          lastError: "Recuperada apos RUNNING orfao (restart/stale)",
          scheduledAt: new Date(),
          leaseVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        continue;
      }
      await this.appendEvent(
        mission.id,
        "recovered",
        "RUNNING orfao reenfileirado",
        { previousLeaseVersion: mission.leaseVersion },
      );
      recovered += 1;
    }

    return recovered;
  }

  /**
   * RUNNING cujo owner nao prova liveness via WorkerHeartbeat.
   */
  private async findAbandonedRunning(
    livenessMs: number,
  ): Promise<readonly Mission[]> {
    const running = await prisma.mission.findMany({
      where: { status: MissionStatus.RUNNING },
    });
    if (running.length === 0) {
      return [];
    }

    const ownerIds = [...new Set(running.map((m) => m.ownerEmployeeId))];
    const heartbeats = await prisma.workerHeartbeat.findMany({
      where: { employeeId: { in: ownerIds } },
      select: {
        employeeId: true,
        currentMissionId: true,
        lastSeenAt: true,
      },
    });
    const byOwner = new Map(
      heartbeats.map((row) => [
        row.employeeId,
        {
          currentMissionId: row.currentMissionId,
          lastSeenAt: row.lastSeenAt,
        },
      ]),
    );
    const nowMs = Date.now();

    return running.filter((mission) =>
      isRunningMissionAbandoned({
        missionId: mission.id,
        heartbeat: byOwner.get(mission.ownerEmployeeId),
        nowMs,
        livenessMs,
      }),
    );
  }

  /** Re-enfileira consolidacao para raizes WAITING com filhos prontos. */
  async recoverWaitingParents(): Promise<number> {
    const waiting = await prisma.mission.findMany({
      where: {
        status: MissionStatus.WAITING,
        missionKind: PrismaMissionKind.COORDINATE,
      },
    });
    let scheduled = 0;
    for (const root of waiting) {
      if (await this.maybeEnqueueConsolidation(root.id)) {
        scheduled += 1;
      }
    }
    return scheduled;
  }

  /**
   * Recupera DAG: promove BLOCKED cujas predecessoras ja COMPLETED
   * (ex.: apos restart no meio da cadeia).
   */
  async recoverBlockedDag(): Promise<number> {
    const blocked = await prisma.mission.findMany({
      where: {
        readiness: "BLOCKED",
        status: { in: [MissionStatus.QUEUED, MissionStatus.CREATED] },
      },
    });
    let promoted = 0;
    for (const mission of blocked) {
      const preds = await prisma.missionDependency.findMany({
        where: { missionId: mission.id },
        include: { dependsOn: true },
      });
      if (preds.length === 0) {
        await prisma.mission.update({
          where: { id: mission.id },
          data: { readiness: "READY", scheduledAt: new Date() },
        });
        await this.appendEvent(
          mission.id,
          "unblocked",
          "BLOCKED sem dependencias — READY apos recovery",
        );
        promoted += 1;
        continue;
      }
      const allDone = preds.every(
        (pred) => pred.dependsOn.status === MissionStatus.COMPLETED,
      );
      if (!allDone) {
        continue;
      }
      await prisma.mission.update({
        where: { id: mission.id },
        data: { readiness: "READY", scheduledAt: new Date() },
      });
      await this.appendEvent(
        mission.id,
        "unblocked",
        "DAG recuperado — missao READY",
      );
      promoted += 1;
    }
    return promoted;
  }

  async appendEvent(
    missionId: string,
    type: string,
    message: string,
    payload?: Prisma.InputJsonValue,
  ): Promise<void> {
    await prisma.missionEvent.create({
      data: {
        missionId,
        type,
        message,
        ...(payload !== undefined ? { payload } : {}),
      },
    });
  }
}

function backoffMs(attempt: number): number {
  const base = 5_000;
  return Math.min(base * 2 ** Math.max(0, attempt - 1), 5 * 60_000);
}

export { MissionQueueStatus };
