/**
 * Politicas OPERACIONAIS do Supervisor (infraestrutura).
 *
 * Regra: NUNCA contem regras de negocio.
 * Apenas observam sinais de runtime (fila, workers, health, timeouts)
 * e pedem recovery / agendamento / coordenacao.
 *
 * Decisao de negocio permanece em:
 * - Opera (CEO)
 * - Specialist Employees
 * - politicas de dominio configuraveis fora deste modulo
 */
import type {
  MissionScanReport,
  PolicyAction,
  PolicyEvaluationResult,
  QueueScanReport,
  WorkerScanReport,
  WorkspaceScanReport,
  HealthReport,
} from "./types.js";

export interface PolicyContext {
  readonly health: HealthReport;
  readonly workspaces: WorkspaceScanReport;
  readonly missions: MissionScanReport;
  readonly queue: QueueScanReport;
  readonly workers: WorkerScanReport;
  readonly staleRunningMs: number;
}

export interface SupervisorPolicy {
  readonly name: string;
  evaluate(ctx: PolicyContext): PolicyAction[] | Promise<PolicyAction[]>;
}

/** Politica operacional: sinaliza recovery quando ha FAILED elegivel a retry. */
export class AutoRetryPolicy implements SupervisorPolicy {
  readonly name = "AutoRetryPolicy";

  evaluate(ctx: PolicyContext): PolicyAction[] {
    const retries = ctx.missions.items.filter(
      (m) => m.category === "RETRY" && m.canResume,
    );
    if (retries.length === 0) {
      return [];
    }
    return [
      {
        policy: this.name,
        type: "recover_queue",
        reason: `${retries.length} missao(oes) FAILED elegiveis a retry operacional`,
        count: retries.length,
      },
    ];
  }
}

/** Politica operacional: detecta RUNNING stale (timeout de infraestrutura). */
export class MissionTimeoutPolicy implements SupervisorPolicy {
  readonly name = "MissionTimeoutPolicy";

  evaluate(ctx: PolicyContext): PolicyAction[] {
    if (ctx.queue.stuck === 0) {
      return [];
    }
    return [
      {
        policy: this.name,
        type: "recover_queue",
        reason: `${ctx.queue.stuck} execucao(oes) RUNNING interrompida(s)/stale`,
        count: ctx.queue.stuck,
      },
    ];
  }
}

/** Politica operacional: recovery de fila (waiting / blocked DAG). */
export class QueueRecoveryPolicy implements SupervisorPolicy {
  readonly name = "QueueRecoveryPolicy";

  evaluate(ctx: PolicyContext): PolicyAction[] {
    const actions: PolicyAction[] = [];
    if (ctx.queue.waiting > 0) {
      actions.push({
        policy: this.name,
        type: "recover_queue",
        reason: "WAITING parents / consolidacao potencialmente pronta",
        count: ctx.queue.waiting,
      });
    }
    const blocked = ctx.missions.items.filter((m) => m.category === "BLOCKED");
    if (blocked.length > 0) {
      actions.push({
        policy: this.name,
        type: "recover_queue",
        reason: "Missoes BLOCKED na DAG",
        count: blocked.length,
      });
    }
    return actions;
  }
}

/** Politica operacional: detecta workers parados com fila pendente. */
export class WorkerRecoveryPolicy implements SupervisorPolicy {
  readonly name = "WorkerRecoveryPolicy";

  evaluate(ctx: PolicyContext): PolicyAction[] {
    if (ctx.workers.total === 0) {
      return [
        {
          policy: this.name,
          type: "recover_workers",
          reason: "Nenhum worker registrado",
          count: 0,
        },
      ];
    }
    if (ctx.workers.alive === 0 && ctx.queue.pending > 0) {
      return [
        {
          policy: this.name,
          type: "recover_workers",
          reason: "Workers parados com fila pendente",
          count: ctx.workers.stopped,
        },
      ];
    }
    return [];
  }
}

/**
 * Politica operacional: se ha workspace ACTIVE com pendencias de fila/tarefas,
 * agenda coordenacao para a Opera — sem decidir o que fazer com as pendencias.
 */
export class WorkspaceHealthPolicy implements SupervisorPolicy {
  readonly name = "WorkspaceHealthPolicy";

  evaluate(ctx: PolicyContext): PolicyAction[] {
    if (ctx.health.overall === "fail") {
      return [
        {
          policy: this.name,
          type: "skip",
          reason: "Health FAIL — sem dispatch de coordenacao",
        },
      ];
    }

    const needy = ctx.workspaces.workspaces.filter(
      (w) => w.status === "ACTIVE" && w.pendingTasks > 0,
    );
    if (needy.length === 0) {
      return [];
    }
    return [
      {
        policy: this.name,
        type: "dispatch_coordinate",
        reason: `${needy.length} workspace(s) ACTIVE com sinal operacional de pendencia — coordenar via Opera`,
        count: needy.length,
        workspaceId: needy[0]?.workspaceId,
      },
    ];
  }
}

/**
 * Policy Engine — avalia politicas operacionais independentes e agrega acoes.
 * Nao interpreta dominio de negocio.
 */
export class PolicyEngine {
  constructor(private readonly policies: readonly SupervisorPolicy[]) {}

  async evaluate(ctx: PolicyContext): Promise<PolicyEvaluationResult> {
    const actions: PolicyAction[] = [];
    for (const policy of this.policies) {
      const result = await policy.evaluate(ctx);
      actions.push(...result);
    }
    return {
      evaluatedAt: new Date().toISOString(),
      actions,
    };
  }
}

export function defaultSupervisorPolicies(): readonly SupervisorPolicy[] {
  return [
    new AutoRetryPolicy(),
    new MissionTimeoutPolicy(),
    new QueueRecoveryPolicy(),
    new WorkerRecoveryPolicy(),
    new WorkspaceHealthPolicy(),
  ];
}
