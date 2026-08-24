import { CEO_EMPLOYEE_ID } from "../mission-states.js";
import { hashObjective } from "../mission-queue.js";
import {
  exhaustedMissionLatchReason,
  type CoordinationLatchKey,
  type CoordinationLatchPort,
} from "./coordination-latch-store.js";
import type { MissionQueuePort, SupervisorLoggerPort } from "./ports.js";
import type {
  CoordinationReason,
  CoordinationRequest,
  DispatchResult,
  MissionScanReport,
  QueueScanReport,
  RecoveryReport,
  WorkspaceScanReport,
} from "./types.js";
import { SupervisorEvent } from "./types.js";

/**
 * CoordinationDispatcher — cria missoes COORDINATE para a Opera.
 *
 * Edge-trigger persistente via CoordinationLatchPort (workspaceId:reason):
 * - tryAcquire → PENDING
 * - enqueue COORDINATE
 * - complete → CONSUMED
 * - PENDING orfao (crash) e reclamado no proximo ciclo; missao ja existente
 *   desde latchedAt e reaproveitada (sem duplicata).
 */
export class CoordinationDispatcher {
  constructor(
    private readonly queue: MissionQueuePort,
    private readonly logger: SupervisorLoggerPort,
    private readonly latches: CoordinationLatchPort,
    /** Idade minima de PENDING orfao para reclaim (gap C.2). */
    private readonly pendingStaleMs: number = 60_000,
  ) {}

  async dispatch(input: {
    readonly workspaces: WorkspaceScanReport;
    readonly missions: MissionScanReport;
    readonly queue: QueueScanReport;
    readonly recovery: RecoveryReport;
    readonly healthOk: boolean;
  }): Promise<DispatchResult> {
    if (!input.healthOk) {
      return {
        dispatched: 0,
        skipped: 1,
        recovered: input.recovery.infraRecovered,
        details: ["health fail — sem coordination"],
        coordinations: [],
      };
    }

    const requests = collectCoordinationRequests({
      workspaces: input.workspaces,
      missions: input.missions,
      queue: input.queue,
    });
    const exhaustedKeep = exhaustedLatchKeys(input.missions);
    if (requests.length === 0) {
      // Nunca releaseAll: FAILED esgotado fora da janela de scan ainda
      // precisa do latch CONSUMED auditavel (missao_esgotada:*).
      await this.latches.releaseAbsent(exhaustedKeep);
      return {
        dispatched: 0,
        skipped: 1,
        recovered: input.recovery.infraRecovered,
        details: ["sem sinal operacional — ciclo encerrado"],
        coordinations: [],
      };
    }

    const activeKeys = await this.buildActiveLatchKeys(requests, exhaustedKeep);
    await this.latches.releaseAbsent(activeKeys);

    const details: string[] = [];
    let dispatched = 0;
    const created: CoordinationRequest[] = [];

    for (const req of requests) {
      const latchKey: CoordinationLatchKey = {
        workspaceId: req.workspaceId,
        reason: latchReasonFor(req),
      };

      const gate = await this.latches.tryAcquire(latchKey, {
        staleAfterMs: this.pendingStaleMs,
      });
      if (!gate.acquired) {
        continue;
      }

      try {
        const objective = buildCoordinationObjective(req);
        const objectiveHash = hashObjective(req.workspaceId, objective);

        // Recovery gap C.2: so em reclaim de PENDING orfao.
        if (
          gate.mode === "reclaim" &&
          gate.latchedAt &&
          this.queue.findByObjectiveHash
        ) {
          const existing = await this.queue.findByObjectiveHash(
            req.workspaceId,
            objectiveHash,
            { createdAtGte: gate.latchedAt },
          );
          if (existing) {
            await this.latches.complete(latchKey, existing.id);
            continue;
          }
        }

        const result = await this.queue.enqueue({
          workspaceId: req.workspaceId,
          projectId: req.projectId,
          objective,
          ownerEmployeeId: CEO_EMPLOYEE_ID,
          dedupe: true,
        });

        if (!result.id) {
          await this.latches.release(latchKey);
          continue;
        }

        await this.latches.complete(latchKey, result.id);

        if (result.created) {
          dispatched += 1;
          created.push(req);
          this.logger.emit(SupervisorEvent.COORDINATION_CREATED, {
            workspaceId: req.workspaceId,
            reason: req.reason,
            missionId: result.id,
            sourceMissionId: req.sourceMissionId ?? null,
            attempt: req.attempt ?? null,
            maxAttempts: req.maxAttempts ?? null,
          });
          details.push(`${latchReasonFor(req)}:${req.workspaceId}`);
        }
      } catch (error) {
        await this.latches.release(latchKey);
        throw error;
      }
    }

    return {
      dispatched,
      skipped: dispatched === 0 ? 1 : 0,
      recovered: input.recovery.infraRecovered,
      details,
      coordinations: created,
    };
  }

  /**
   * Mantem latches ativos enquanto houver COORDINATE OPEN do mesmo reason —
   * impede releaseAbsent por oscilacao causada pela propria missao.
   */
  private async buildActiveLatchKeys(
    requests: readonly CoordinationRequest[],
    extraKeep: readonly CoordinationLatchKey[] = [],
  ): Promise<CoordinationLatchKey[]> {
    const keys = new Map<string, CoordinationLatchKey>();
    const put = (key: CoordinationLatchKey) => {
      keys.set(`${key.workspaceId}\0${key.reason}`, key);
    };
    for (const req of requests) {
      put({ workspaceId: req.workspaceId, reason: latchReasonFor(req) });
    }
    for (const key of extraKeep) {
      put(key);
    }

    try {
      const open = await this.queue.list({ take: 200 });
      for (const mission of open) {
        if (mission.missionKind !== "COORDINATE") {
          continue;
        }
        if (
          mission.status !== "QUEUED" &&
          mission.status !== "RUNNING" &&
          mission.status !== "CREATED" &&
          mission.status !== "WAITING"
        ) {
          continue;
        }
        const objective = mission.objective ?? "";
        const match = /^\[COORDINATE\/([^\]]+)\]/.exec(objective);
        const reason = match?.[1];
        if (!reason) {
          continue;
        }
        put({
          workspaceId: mission.workspaceId,
          reason: reason as CoordinationReason,
        });
      }
    } catch {
      // Mocks sem list completa: segue so com requests.
    }

    return [...keys.values()];
  }
}

function collectCoordinationRequests(input: {
  readonly workspaces: WorkspaceScanReport;
  readonly missions: MissionScanReport;
  readonly queue: QueueScanReport;
}): CoordinationRequest[] {
  const requests: CoordinationRequest[] = [];
  const seen = new Set<string>();

  const push = (req: CoordinationRequest) => {
    const key = req.sourceMissionId
      ? `${req.workspaceId}:${req.reason}:${req.sourceMissionId}`
      : `${req.workspaceId}:${req.reason}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    requests.push(req);
  };

  for (const ws of input.workspaces.workspaces) {
    if (!ws.needsAttention) {
      continue;
    }
    for (const reason of ws.attentionReasons) {
      push({
        workspaceId: ws.workspaceId,
        projectId: ws.projectId,
        reason,
        detail: `workspace ${ws.name}: ${reason}`,
      });
    }
  }

  for (const m of input.missions.items) {
    if (!m.needsCoordination) {
      continue;
    }
    const reason: CoordinationReason =
      m.category === "RETRY"
        ? "retry"
        : m.category === "FAILED"
          ? "missao_esgotada"
          : m.category === "BLOCKED"
            ? "missao_bloqueada"
            : m.category === "STALE" || m.category === "TIMEOUT"
              ? "missao_parada"
              : m.category === "WAITING"
                ? "missao_aguardando"
                : "recuperacao";
    push({
      workspaceId: m.workspaceId,
      reason,
      detail: m.reason,
      ...(reason === "missao_esgotada"
        ? {
            sourceMissionId: m.missionId,
            attempt: m.attempt,
            maxAttempts: m.maxAttempts,
          }
        : {}),
    });
  }

  if (input.queue.congested) {
    for (const ws of input.workspaces.workspaces) {
      if (!ws.needsAttention && ws.openMissions === 0) {
        continue;
      }
      push({
        workspaceId: ws.workspaceId,
        projectId: ws.projectId,
        reason: "congestionamento_fila",
        detail: `depth=${input.queue.depth}`,
      });
    }
  }

  return requests;
}

/** Latches de FAILED esgotado (mesmo apos CONSUMED / needsCoordination=false). */
function exhaustedLatchKeys(
  missions: MissionScanReport,
): CoordinationLatchKey[] {
  return missions.items
    .filter(
      (item) =>
        item.category === "FAILED" &&
        !item.canResume &&
        item.attempt >= item.maxAttempts,
    )
    .map((item) => ({
      workspaceId: item.workspaceId,
      reason: exhaustedMissionLatchReason(item.missionId),
    }));
}

/** Latch/reason persistido — por missao quando escalacao de FAILED esgotado. */
function latchReasonFor(req: CoordinationRequest): string {
  if (req.reason === "missao_esgotada" && req.sourceMissionId) {
    return exhaustedMissionLatchReason(req.sourceMissionId);
  }
  return req.reason;
}

function buildCoordinationObjective(req: CoordinationRequest): string {
  const tag = latchReasonFor(req);
  if (req.reason === "missao_esgotada" && req.sourceMissionId) {
    return (
      `[COORDINATE/${tag}] Missao ${req.sourceMissionId} esgotada ` +
      `(${req.attempt ?? "?"}/${req.maxAttempts ?? "?"}) no workspace ` +
      `${req.workspaceId}. ${req.detail}`
    );
  }
  return `[COORDINATE/${req.reason}] Atencao operacional no workspace ${req.workspaceId}. ${req.detail}`;
}

/** Alias legado. */
export { CoordinationDispatcher as SupervisorDispatcher };
