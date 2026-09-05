import {
  exhaustedMissionLatchReason,
  type CoordinationLatchPort,
} from "./coordination-latch-store.js";
import type { ClockPort, MissionQueuePort, MissionView } from "./ports.js";
import type {
  MissionScanCategory,
  MissionScanItem,
  MissionScanReport,
} from "./types.js";

/**
 * Prefixo do erro lancado por QueuedMissionExecutor#execute quando o
 * workspace da missao nao existe mais (ver queued-mission-executor.ts).
 * Esgotamento por esse motivo nunca vira COORDINATE: a missao de
 * coordenacao passaria pelo mesmo QueuedMissionExecutor#execute, bateria
 * no mesmo workspace inexistente e tambem se esgotaria — gerando uma
 * nova escalacao (novo missionId, logo fora do latch CONSUMED existente)
 * infinitamente. Confirmado em producao: workspace verify-crit-* gerou
 * 600+ falhas/2h nesse ciclo antes desse fix.
 */
const WORKSPACE_NOT_FOUND_PREFIX = "Workspace nao encontrado";

function isUnrecoverableWorkspaceError(lastError: string | null): boolean {
  return lastError != null && lastError.startsWith(WORKSPACE_NOT_FOUND_PREFIX);
}

/**
 * MissionScanner — observa estados de missao.
 * Detecta timeout/stale/retry/waiting. Nao resolve — apenas encaminha.
 * MQ-3: STALE = RUNNING sem liveness de WorkerHeartbeat (nao Mission.updatedAt).
 */
export class MissionScanner {
  constructor(
    private readonly queue: MissionQueuePort,
    private readonly clock: ClockPort,
    private readonly staleRunningMs: number,
    private readonly latches?: CoordinationLatchPort,
  ) {}

  async scan(): Promise<MissionScanReport> {
    const statuses = [
      "CREATED",
      "WAITING",
      "RUNNING",
      "QUEUED",
      "FAILED",
      "COMPLETED",
      "CANCELLED",
    ] as const;

    const batches = await Promise.all(
      statuses.map((status) => this.queue.list({ status, take: 100 })),
    );

    const abandonedRunning = new Set(
      (await this.queue.listAbandonedRunningIds?.(this.staleRunningMs)) ?? [],
    );

    const byStatus: Record<string, number> = {};
    const items: MissionScanItem[] = [];

    for (let i = 0; i < statuses.length; i += 1) {
      const status = statuses[i]!;
      const rows = batches[i] ?? [];
      byStatus[status] = rows.length;

      for (const mission of rows) {
        if (status === "COMPLETED" || status === "CANCELLED") {
          items.push(toItem(mission, status === "COMPLETED" ? "COMPLETED" : "CREATED", false, false, "estado terminal"));
          continue;
        }
        if (status === "FAILED") {
          const canRetry = mission.attempt < mission.maxAttempts;
          const unrecoverable =
            !canRetry && isUnrecoverableWorkspaceError(mission.lastError);
          items.push(
            toItem(
              mission,
              canRetry ? "RETRY" : "FAILED",
              canRetry,
              // Retryable: F6.1 sem COORDINATE. Esgotado: escalacao
              // operacional — exceto workspace inexistente (sem escalacao
              // possivel, ver isUnrecoverableWorkspaceError acima).
              !canRetry && !unrecoverable,
              canRetry
                ? `FAILED elegivel a retry (${mission.attempt}/${mission.maxAttempts})`
                : unrecoverable
                  ? `FAILED esgotado, workspace inexistente — sem escalacao (${mission.attempt}/${mission.maxAttempts})`
                  : `FAILED esgotado (${mission.attempt}/${mission.maxAttempts})`,
            ),
          );
          continue;
        }
        if (status === "WAITING") {
          items.push(
            toItem(mission, "WAITING", true, true, "Aguardando filhos/consolidacao"),
          );
          continue;
        }
        if (status === "RUNNING") {
          const stuck = abandonedRunning.has(mission.id);
          items.push(
            toItem(
              mission,
              stuck ? "STALE" : "RUNNING",
              stuck,
              stuck,
              stuck
                ? "RUNNING sem liveness de WorkerHeartbeat"
                : "Em execucao",
            ),
          );
          continue;
        }
        if (mission.readiness === "BLOCKED") {
          items.push(
            toItem(mission, "BLOCKED", true, true, "readiness=BLOCKED"),
          );
          continue;
        }
        if (status === "CREATED") {
          items.push(toItem(mission, "CREATED", true, false, "Criada aguardando fila"));
          continue;
        }
        items.push(toItem(mission, "QUEUED", false, false, "Na fila"));
      }
    }

    const resolved = await this.suppressConsumedExhausted(items);

    return {
      scannedAt: this.clock.now().toISOString(),
      items: resolved,
      resumableCount: resolved.filter((i) => i.canResume).length,
      coordinationNeeded: resolved.filter((i) => i.needsCoordination).length,
      byStatus,
    };
  }

  /**
   * Governanca: FAILED esgotado cuja escalacao ja foi entregue (latch CONSUMED)
   * nao permanece needsCoordination — evita noise eterno no Supervisor.
   */
  private async suppressConsumedExhausted(
    items: readonly MissionScanItem[],
  ): Promise<readonly MissionScanItem[]> {
    if (!this.latches) {
      return items;
    }
    const exhausted = items.filter(
      (item) => item.category === "FAILED" && item.needsCoordination,
    );
    if (exhausted.length === 0) {
      return items;
    }
    const consumedIds = new Set<string>();
    await Promise.all(
      exhausted.map(async (item) => {
        const consumed = await this.latches!.isConsumed({
          workspaceId: item.workspaceId,
          reason: exhaustedMissionLatchReason(item.missionId),
        });
        if (consumed) {
          consumedIds.add(item.missionId);
        }
      }),
    );
    if (consumedIds.size === 0) {
      return items;
    }
    return items.map((item) =>
      consumedIds.has(item.missionId)
        ? {
            ...item,
            needsCoordination: false,
            reason: `FAILED esgotado ja escalado (latch CONSUMED ${item.attempt}/${item.maxAttempts})`,
          }
        : item,
    );
  }
}

function toItem(
  mission: MissionView,
  category: MissionScanCategory,
  canResume: boolean,
  needsCoordination: boolean,
  reason: string,
): MissionScanItem {
  return {
    missionId: mission.id,
    workspaceId: mission.workspaceId,
    status: mission.status,
    category,
    attempt: mission.attempt,
    maxAttempts: mission.maxAttempts,
    canResume,
    needsCoordination,
    reason,
  };
}
