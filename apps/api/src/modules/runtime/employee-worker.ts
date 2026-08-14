import { prisma, type Prisma } from "@operaia/database";
import { runWithLLMExecutionContext } from "@operaia/ai-core";
import type { EmployeeProfile } from "@operaia/employee-framework";
import {
  StaleMissionOwnershipError,
  type MissionQueue,
} from "./mission-queue.js";
import type { QueuedMissionExecutor } from "./queued-mission-executor.js";
import {
  WorkerMetrics,
  type WorkerPublicView,
  type WorkerRuntimeStatus,
} from "./runtime-metrics.js";

export interface EmployeeWorkerLogger {
  info(obj: Record<string, unknown>, msg?: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
}

export interface EmployeeWorkerOptions {
  readonly profile: EmployeeProfile;
  readonly queue: MissionQueue;
  readonly executor: QueuedMissionExecutor;
  readonly pollIntervalMs: number;
  readonly heartbeatIntervalMs: number;
  readonly logger: EmployeeWorkerLogger;
}

/**
 * Worker logico permanente de um Employee do roster.
 * Todos consomem a Mission Queue filtrando por specialization / missionKind.
 * MQ-3: durante execute(), heartbeat continua via timer paralelo.
 */
export class EmployeeWorker {
  private readonly metrics = new WorkerMetrics();
  private status: WorkerRuntimeStatus = "stopped";
  private currentMissionId: string | null = null;
  private startedAt: number | null = null;
  private heartbeatAt: string | null = null;
  private running = false;
  private loopPromise: Promise<void> | null = null;
  private stopRequested = false;
  private executionHeartbeatTimer: ReturnType<typeof setInterval> | null =
    null;

  constructor(private readonly options: EmployeeWorkerOptions) {}

  get employeeId(): string {
    return this.options.profile.id;
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    this.stopRequested = false;
    this.running = true;
    this.startedAt = Date.now();
    this.status = "starting";
    await this.persistHeartbeat();
    this.status = "idle";
    this.options.logger.info(
      {
        component: "employee-worker",
        employeeId: this.employeeId,
        event: "started",
        specialization: this.options.profile.specialization,
      },
      "Worker iniciado",
    );
    this.loopPromise = this.loop();
  }

  async stop(): Promise<void> {
    this.stopRequested = true;
    this.status = "stopping";
    this.stopExecutionHeartbeat();
    await this.persistHeartbeat();
    if (this.loopPromise) {
      await this.loopPromise;
    }
    this.running = false;
    this.status = "stopped";
    this.currentMissionId = null;
    await this.persistHeartbeat();
    this.options.logger.info(
      {
        component: "employee-worker",
        employeeId: this.employeeId,
        event: "stopped",
      },
      "Worker parado",
    );
  }

  view(): WorkerPublicView {
    const snap = this.metrics.snapshot();
    return {
      employeeId: this.employeeId,
      name: this.options.profile.name,
      specialization: this.options.profile.specialization,
      status: this.status,
      currentMissionId: this.currentMissionId,
      heartbeatAt: this.heartbeatAt,
      uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
      missionsCompleted: snap.missionsCompleted,
      missionsFailed: snap.missionsFailed,
      retries: snap.retries,
      lastExecutionAt: snap.lastExecutionAt,
      avgDurationMs: this.metrics.averageDurationMs(),
    };
  }

  private async loop(): Promise<void> {
    let lastHeartbeat = 0;

    while (!this.stopRequested) {
      const now = Date.now();
      if (now - lastHeartbeat >= this.options.heartbeatIntervalMs) {
        await this.persistHeartbeat();
        lastHeartbeat = now;
      }

      try {
        const claimed = await this.options.queue.claim({
          employeeId: this.employeeId,
          specialization: this.options.profile.specialization,
        });

        if (!claimed) {
          this.status = "idle";
          await sleep(this.options.pollIntervalMs);
          continue;
        }

        this.status = "busy";
        this.currentMissionId = claimed.id;
        await this.persistHeartbeat();
        this.startExecutionHeartbeat();
        const started = Date.now();

        this.options.logger.info(
          {
            component: "employee-worker",
            employeeId: this.employeeId,
            event: "mission_started",
            missionId: claimed.id,
            missionKind: claimed.missionKind,
            workspaceId: claimed.workspaceId,
            specialization: claimed.requiredSpecialization,
          },
          "Executando missao",
        );

        try {
          await runWithLLMExecutionContext(
            {
              missionId: claimed.id,
              correlationId:
                extractMissionCorrelationId(claimed.objective) ?? claimed.id,
            },
            async () => {
              await this.options.executor.execute(claimed, this.employeeId);
            },
          );
          this.metrics.recordSuccess(Date.now() - started);
          this.options.logger.info(
            {
              component: "employee-worker",
              employeeId: this.employeeId,
              event: "mission_completed",
              missionId: claimed.id,
              missionKind: claimed.missionKind,
              durationMs: Date.now() - started,
            },
            "Missao concluida",
          );
        } catch (error) {
          if (error instanceof StaleMissionOwnershipError) {
            this.options.logger.warn(
              {
                component: "employee-worker",
                employeeId: this.employeeId,
                event: "stale_ownership",
                missionId: claimed.id,
                leaseVersion: claimed.leaseVersion,
                error: error.message,
              },
              "Execucao perdeu ownership — complete/fail ignorado",
            );
          } else {
            const message =
              error instanceof Error ? error.message : "erro desconhecido";
            const stack = error instanceof Error ? error.stack : undefined;
            try {
              const failed = await this.options.queue.fail(
                claimed.id,
                message,
                claimed.leaseVersion,
              );
              const wasRetry = failed.status === "QUEUED";
              this.metrics.recordFailure(Date.now() - started, wasRetry);
              this.options.logger.error(
                {
                  component: "employee-worker",
                  employeeId: this.employeeId,
                  event: "mission_failed",
                  missionId: claimed.id,
                  workspaceId: claimed.workspaceId,
                  objective: claimed.objective,
                  error: message,
                  stack,
                  requeued: wasRetry,
                },
                "Missao falhou",
              );
            } catch (failError) {
              if (failError instanceof StaleMissionOwnershipError) {
                this.options.logger.warn(
                  {
                    component: "employee-worker",
                    employeeId: this.employeeId,
                    event: "stale_ownership_on_fail",
                    missionId: claimed.id,
                    leaseVersion: claimed.leaseVersion,
                    originalError: message,
                    error: failError.message,
                  },
                  "Fail rejeitado — ownership ja invalido",
                );
              } else {
                throw failError;
              }
            }
          }
        } finally {
          this.stopExecutionHeartbeat();
          this.currentMissionId = null;
          this.status = this.stopRequested ? "stopping" : "idle";
          await this.persistHeartbeat();
        }
      } catch (error) {
        this.stopExecutionHeartbeat();
        this.status = "error";
        this.options.logger.error(
          {
            component: "employee-worker",
            employeeId: this.employeeId,
            event: "loop_error",
            error: error instanceof Error ? error.message : String(error),
          },
          "Erro no loop do worker",
        );
        await sleep(this.options.pollIntervalMs);
        this.status = this.stopRequested ? "stopping" : "idle";
      }
    }
  }

  /**
   * MQ-3 — pulso independente do await execute() (operacao longa / event loop ok).
   */
  private startExecutionHeartbeat(): void {
    this.stopExecutionHeartbeat();
    this.executionHeartbeatTimer = setInterval(() => {
      void this.persistHeartbeat().catch((error) => {
        this.options.logger.warn(
          {
            component: "employee-worker",
            employeeId: this.employeeId,
            event: "execution_heartbeat_failed",
            missionId: this.currentMissionId,
            error: error instanceof Error ? error.message : String(error),
          },
          "Falha ao persistir heartbeat durante execucao",
        );
      });
    }, this.options.heartbeatIntervalMs);
  }

  private stopExecutionHeartbeat(): void {
    if (this.executionHeartbeatTimer) {
      clearInterval(this.executionHeartbeatTimer);
      this.executionHeartbeatTimer = null;
    }
  }

  private async persistHeartbeat(): Promise<void> {
    const now = new Date();
    this.heartbeatAt = now.toISOString();
    const snap = this.metrics.snapshot();
    const metricsJson = {
      ...snap,
      avgDurationMs: this.metrics.averageDurationMs(),
    } as Prisma.InputJsonValue;

    await prisma.workerHeartbeat.upsert({
      where: { employeeId: this.employeeId },
      create: {
        employeeId: this.employeeId,
        status: this.status,
        currentMissionId: this.currentMissionId,
        metricsJson,
        startedAt: this.startedAt ? new Date(this.startedAt) : now,
        lastSeenAt: now,
      },
      update: {
        status: this.status,
        currentMissionId: this.currentMissionId,
        metricsJson,
        lastSeenAt: now,
      },
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extrai correlation=… embutido no objective de sinais DomainSignal. */
function extractMissionCorrelationId(objective: string): string | undefined {
  const match = /correlation=([^\s·]+)/.exec(objective);
  const value = match?.[1]?.trim();
  return value && value !== "n/a" ? value : undefined;
}
