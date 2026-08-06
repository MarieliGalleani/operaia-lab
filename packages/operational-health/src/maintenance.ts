/**
 * Manutencao automatica idempotente (A.5.3).
 */
import { logOperationalEvent } from "./observability.js";

export interface MaintenanceResult {
  readonly name: string;
  readonly affected: number;
  readonly detail: string;
}

export interface MaintenanceReport {
  readonly ranAt: string;
  readonly correlationId: string;
  readonly results: readonly MaintenanceResult[];
  readonly success: boolean;
}

/**
 * Ports injetaveis — implementacoes em apps/api (Prisma) ou stubs em testes.
 */
export interface MemoryMaintenancePort {
  archiveExpired(): Promise<number>;
  /** Eviction preventiva abaixo do warning (ex.: manter <= 80% da quota). */
  preventiveEviction(targetActiveMax: number): Promise<number>;
}

export interface QueueMaintenancePort {
  /** Cancela WAITING orfaos (ex.: resilience proof / stale pinned). */
  cancelOrphanWaiting(): Promise<number>;
  /** Remove / falha retries expirados alem do maxAttempts (no-op se ja tratado). */
  purgeExpiredRetries(): Promise<number>;
}

export interface LedgerMaintenancePort {
  purgeOlderThan(days: number): Promise<number>;
}

export interface OperationalMaintenanceOptions {
  readonly memory?: MemoryMaintenancePort;
  readonly queue?: QueueMaintenancePort;
  readonly ledger?: LedgerMaintenancePort;
  readonly memoryTargetActiveMax?: number;
  readonly ledgerRetentionDays?: number;
  readonly workspaceId?: string;
}

export class OperationalMaintenance {
  constructor(private readonly options: OperationalMaintenanceOptions) {}

  async run(correlationId = `maint-${Date.now()}`): Promise<MaintenanceReport> {
    const results: MaintenanceResult[] = [];
    let success = true;

    const runOne = async (
      name: string,
      fn: () => Promise<number>,
      detailOk: (n: number) => string,
    ) => {
      try {
        const affected = await fn();
        results.push({ name, affected, detail: detailOk(affected) });
      } catch (error) {
        success = false;
        results.push({
          name,
          affected: 0,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    };

    if (this.options.memory) {
      await runOne(
        "memory.archive_expired",
        () => this.options.memory!.archiveExpired(),
        (n) => `${n} notes expiradas arquivadas`,
      );
      const target = this.options.memoryTargetActiveMax ?? 1_600;
      await runOne(
        "memory.preventive_eviction",
        () => this.options.memory!.preventiveEviction(target),
        (n) => `${n} notes evicted (targetActiveMax=${target})`,
      );
    }

    if (this.options.queue) {
      await runOne(
        "queue.cancel_orphan_waiting",
        () => this.options.queue!.cancelOrphanWaiting(),
        (n) => `${n} WAITING orfaos cancelados`,
      );
      await runOne(
        "queue.purge_expired_retries",
        () => this.options.queue!.purgeExpiredRetries(),
        (n) => `${n} retries expirados tratados`,
      );
    }

    if (this.options.ledger) {
      const days = this.options.ledgerRetentionDays ?? 30;
      await runOne(
        "ledger.purge_old",
        () => this.options.ledger!.purgeOlderThan(days),
        (n) => `${n} registros ledger >${days}d removidos`,
      );
    }

    const report: MaintenanceReport = {
      ranAt: new Date().toISOString(),
      correlationId,
      results,
      success,
    };

    logOperationalEvent({
      event: "maintenance_execution",
      severity: success ? "info" : "error",
      component: "operational-maintenance",
      workspaceId: this.options.workspaceId,
      correlationId,
      payload: {
        success,
        results: report.results,
      },
    });

    return report;
  }
}
