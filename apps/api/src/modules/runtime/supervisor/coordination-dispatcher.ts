import { CEO_EMPLOYEE_ID } from "../mission-states.js";
import { hashObjective } from "../mission-queue.js";
import type {
  CoordinationLatchKey,
  CoordinationLatchPort,
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
    if (requests.length === 0) {
      await this.latches.releaseAll();
      return {
        dispatched: 0,
        skipped: 1,
        recovered: input.recovery.infraRecovered,
        details: ["sem sinal operacional — ciclo encerrado"],
        coordinations: [],
      };
    }

    const activeKeys: CoordinationLatchKey[] = requests.map((req) => ({
      workspaceId: req.workspaceId,
      reason: req.reason,
    }));
    await this.latches.releaseAbsent(activeKeys);

    const details: string[] = [];
    let dispatched = 0;
    const created: CoordinationRequest[] = [];

    for (const req of requests) {
      const latchKey: CoordinationLatchKey = {
        workspaceId: req.workspaceId,
        reason: req.reason,
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
          });
          details.push(`${req.reason}:${req.workspaceId}`);
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
}

function collectCoordinationRequests(input: {
  readonly workspaces: WorkspaceScanReport;
  readonly missions: MissionScanReport;
  readonly queue: QueueScanReport;
}): CoordinationRequest[] {
  const requests: CoordinationRequest[] = [];
  const seen = new Set<string>();

  const push = (req: CoordinationRequest) => {
    const key = `${req.workspaceId}:${req.reason}`;
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

function buildCoordinationObjective(req: CoordinationRequest): string {
  return `[COORDINATE/${req.reason}] Atencao operacional no workspace ${req.workspaceId}. ${req.detail}`;
}

/** Alias legado. */
export { CoordinationDispatcher as SupervisorDispatcher };
