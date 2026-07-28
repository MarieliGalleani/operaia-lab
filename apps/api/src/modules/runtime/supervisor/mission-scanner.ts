import type { ClockPort, MissionQueuePort, MissionView } from "./ports.js";
import type {
  MissionScanCategory,
  MissionScanItem,
  MissionScanReport,
} from "./types.js";

/**
 * MissionScanner — observa estados de missao.
 * Detecta timeout/stale/retry/waiting. Nao resolve — apenas encaminha.
 */
export class MissionScanner {
  constructor(
    private readonly queue: MissionQueuePort,
    private readonly clock: ClockPort,
    private readonly staleRunningMs: number,
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
          items.push(
            toItem(
              mission,
              canRetry ? "RETRY" : "FAILED",
              canRetry,
              true,
              canRetry
                ? `FAILED elegivel a retry (${mission.attempt}/${mission.maxAttempts})`
                : "FAILED sem tentativas",
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
          const stuck = isStuck(mission, this.staleRunningMs, this.clock.now());
          items.push(
            toItem(
              mission,
              stuck ? "STALE" : "RUNNING",
              stuck,
              stuck,
              stuck ? "RUNNING stale/timeout" : "Em execucao",
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

    return {
      scannedAt: this.clock.now().toISOString(),
      items,
      resumableCount: items.filter((i) => i.canResume).length,
      coordinationNeeded: items.filter((i) => i.needsCoordination).length,
      byStatus,
    };
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

function isStuck(mission: MissionView, staleAfterMs: number, now: Date): boolean {
  const anchor = mission.updatedAt ?? mission.startedAt;
  if (!anchor) {
    return false;
  }
  return now.getTime() - anchor.getTime() >= staleAfterMs;
}
