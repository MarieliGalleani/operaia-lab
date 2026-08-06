/**
 * Adapters Prisma para OperationalHealth / Maintenance (A.5.3).
 * Sem mudar schema — apenas leituras e updates idempotentes.
 */
import { MEMORY_M1_QUOTA_PER_WORKSPACE } from "@operaia/memory";
import { prisma } from "@operaia/database";
import type {
  LedgerMaintenancePort,
  MemoryMaintenancePort,
  OperationalMetricsInput,
  OperationalMetricsProvider,
  QueueMaintenancePort,
} from "@operaia/operational-health";

export class PrismaMemoryMaintenance implements MemoryMaintenancePort {
  constructor(private readonly workspaceId = "nexo") {}

  async archiveExpired(): Promise<number> {
    const result = await prisma.operationalMemoryNote.updateMany({
      where: {
        workspaceId: this.workspaceId,
        archivedAt: null,
        expiresAt: { lte: new Date() },
      },
      data: { archivedAt: new Date() },
    });
    return result.count;
  }

  async preventiveEviction(targetActiveMax: number): Promise<number> {
    const active = await prisma.operationalMemoryNote.count({
      where: {
        workspaceId: this.workspaceId,
        archivedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    if (active <= targetActiveMax) {
      return 0;
    }
    const toArchive = active - targetActiveMax;
    const oldest = await prisma.operationalMemoryNote.findMany({
      where: {
        workspaceId: this.workspaceId,
        archivedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "asc" },
      take: toArchive,
      select: { id: true },
    });
    if (oldest.length === 0) {
      return 0;
    }
    const result = await prisma.operationalMemoryNote.updateMany({
      where: { id: { in: oldest.map((row) => row.id) } },
      data: { archivedAt: new Date() },
    });
    return result.count;
  }
}

export class PrismaQueueMaintenance implements QueueMaintenancePort {
  async cancelOrphanWaiting(): Promise<number> {
    const result = await prisma.mission.updateMany({
      where: {
        status: "WAITING",
        OR: [
          { objective: { contains: "resilience_dedupe" } },
          {
            lastError: {
              contains: "pinned WAITING",
            },
          },
        ],
      },
      data: {
        status: "CANCELLED",
        finishedAt: new Date(),
        progress: 100,
        lastError:
          "A.5.3 maintenance: WAITING orfao cancelado (nao gera loop de congestao)",
      },
    });
    return result.count;
  }

  async purgeExpiredRetries(): Promise<number> {
    // Retries ja sao terminalizados por maxAttempts no MissionQueue.fail.
    // Aqui limpamos QUEUED com lastError de Quota antigos e scheduledAt muito velho.
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await prisma.mission.updateMany({
      where: {
        status: "QUEUED",
        lastError: { contains: "Quota M1" },
        scheduledAt: { lt: cutoff },
        attempt: { gte: 3 },
      },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        progress: 100,
        lastError: "A.5.3 maintenance: retry expirado (Quota M1 historico)",
      },
    });
    return result.count;
  }
}

export class PrismaLedgerMaintenance implements LedgerMaintenancePort {
  async purgeOlderThan(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    try {
      const result = await prisma.actionExecution.deleteMany({
        where: { requestedAt: { lt: cutoff } },
      });
      return result.count;
    } catch {
      // Modelo pode nao existir em ambientes antigos — idempotente.
      return 0;
    }
  }
}

export interface PrismaOperationalMetricsOptions {
  readonly workspaceId?: string;
  readonly memoryQuota?: number;
  readonly workersAlive?: () => number;
  readonly workersExpected?: () => number;
  readonly schedulerRunning?: () => boolean;
  readonly runtimeOk?: () => boolean;
}

export class PrismaOperationalMetricsProvider
  implements OperationalMetricsProvider
{
  constructor(private readonly options: PrismaOperationalMetricsOptions = {}) {}

  async collect(): Promise<OperationalMetricsInput> {
    try {
      return await this.collectUnsafe();
    } catch (error) {
      console.log(
        JSON.stringify({
          level: "warn",
          component: "operational-metrics",
          event: "collect_failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return {
        memoryActiveNotes: 0,
        memoryQuota: this.options.memoryQuota ?? MEMORY_M1_QUOTA_PER_WORKSPACE,
        queueWaiting: 0,
        queueDepth: 0,
        consecutiveFailed: 0,
        workersAlive: this.options.workersAlive?.(),
        workersExpected: this.options.workersExpected?.(),
        schedulerRunning: this.options.schedulerRunning?.() ?? true,
        runtimeOk: this.options.runtimeOk?.() ?? true,
        actionsOk: true,
      };
    }
  }

  private async collectUnsafe(): Promise<OperationalMetricsInput> {
    const workspaceId = this.options.workspaceId ?? "nexo";
    const quota =
      this.options.memoryQuota ?? MEMORY_M1_QUOTA_PER_WORKSPACE;

    const [activeNotes, depths, recentFailed] = await Promise.all([
      prisma.operationalMemoryNote.count({
        where: {
          workspaceId,
          archivedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      }),
      prisma.mission.groupBy({
        by: ["status"],
        _count: true,
      }),
      prisma.mission.count({
        where: {
          status: "FAILED",
          updatedAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
          lastError: { contains: "Quota M1" },
        },
      }),
    ]);

    const countOf = (status: string) =>
      depths.find((row) => row.status === status)?._count ?? 0;

    const queued = countOf("QUEUED");
    const running = countOf("RUNNING");
    const waiting = countOf("WAITING");
    const depth = queued + running + waiting;

    return {
      memoryActiveNotes: activeNotes,
      memoryQuota: quota,
      queueWaiting: waiting,
      queueDepth: depth,
      consecutiveFailed: recentFailed,
      workersAlive: this.options.workersAlive?.() ?? undefined,
      workersExpected: this.options.workersExpected?.() ?? undefined,
      schedulerRunning: this.options.schedulerRunning?.() ?? true,
      runtimeOk: this.options.runtimeOk?.() ?? true,
      actionsOk: true,
    };
  }
}
