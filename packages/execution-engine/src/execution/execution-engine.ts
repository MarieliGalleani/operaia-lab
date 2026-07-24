import { randomUUID } from "node:crypto";
import { ExecutorNotFoundError, InvalidExecutionPlanError } from "../errors/execution-errors.js";
import type { ExecutorRegistry } from "../executors/registry.js";
import {
  AllowAllActionPolicy,
  type ActionPolicy,
  type PolicyDecision,
} from "../policies/action-policy.js";
import { systemClock, type Clock } from "../ports/clock.js";
import type { ExecutionStore } from "../ports/execution-store.js";
import { ActionStatus, type Action } from "./action.js";
import type { ExecutionContext } from "./execution-context.js";
import {
  ExecutionPhase,
  type ExecutionLog,
  type LogLevel,
} from "./execution-log.js";
import type { ExecutionPlan } from "./execution-plan.js";
import {
  ExecutionStatus,
  type ActionResult,
  type ExecutionResult,
} from "./execution-result.js";

export interface ExecutionEngineDependencies {
  readonly registry: ExecutorRegistry;
  /** Policy Layer: canExecute → validate antes do Registry/Executor. */
  readonly policy?: ActionPolicy;
  readonly store?: ExecutionStore;
  readonly clock?: Clock;
  /** Se true, interrompe na primeira falha. Default: false (continue-on-error). */
  readonly stopOnError?: boolean;
}

type LogMeta = Pick<ExecutionLog, "actionId" | "executor" | "durationMs">;

/**
 * O "braco" dos agentes: transforma um ExecutionPlan em trabalho executavel.
 * Nao pensa, nao fala com LLM. Depende apenas de contratos (registry/store/clock).
 */
export class ExecutionEngine {
  private readonly registry: ExecutorRegistry;
  private readonly policy: ActionPolicy;
  private readonly store: ExecutionStore | undefined;
  private readonly clock: Clock;
  private readonly stopOnError: boolean;

  constructor(deps: ExecutionEngineDependencies) {
    this.registry = deps.registry;
    this.policy = deps.policy ?? new AllowAllActionPolicy();
    this.store = deps.store;
    this.clock = deps.clock ?? systemClock;
    this.stopOnError = deps.stopOnError ?? false;
  }

  async execute(plan: ExecutionPlan): Promise<ExecutionResult> {
    const startedAt = this.clock.now();
    const logs: ExecutionLog[] = [];
    const log = (
      level: LogLevel,
      phase: ExecutionPhase,
      message: string,
      meta: Partial<LogMeta> = {},
    ): void => {
      logs.push({ level, phase, message, at: this.clock.now(), ...meta });
    };

    this.validatePlan(plan);
    log(
      "info",
      ExecutionPhase.PLAN_VALIDATED,
      `Plano ${plan.id} validado com ${plan.actions.length} acao(oes).`,
    );

    const context: ExecutionContext = {
      executionId: randomUUID(),
      startedAt,
      metadata: plan.metadata ?? {},
    };

    const results: ActionResult[] = [];
    for (const action of plan.actions) {
      const result = await this.executeAction(action, context, log);
      results.push(result);
      if (result.status === ActionStatus.FAILED && this.stopOnError) {
        break;
      }
    }

    const executed = results.filter((r) => r.status === ActionStatus.SUCCESS);
    const failed = results.filter((r) => r.status === ActionStatus.FAILED);
    const status = resolveStatus(results);
    const durationMs = this.clock.now().getTime() - startedAt.getTime();

    log(
      "info",
      ExecutionPhase.EXECUTION_FINISH,
      `Execucao ${status}: ${executed.length} ok, ${failed.length} erro.`,
      { durationMs },
    );

    const result: ExecutionResult = {
      executionId: context.executionId,
      status,
      executed,
      failed,
      results,
      durationMs,
      logs,
    };

    if (this.store) {
      await this.store.save(result);
    }

    return result;
  }

  private async executeAction(
    action: Action,
    context: ExecutionContext,
    log: (
      level: LogLevel,
      phase: ExecutionPhase,
      message: string,
      meta?: Partial<LogMeta>,
    ) => void,
  ): Promise<ActionResult> {
    const startedAt = this.clock.now();

    const can = await this.policy.canExecute(action, context);
    if (!can.allowed) {
      return this.skipped(action, can, startedAt, log);
    }

    const valid: PolicyDecision = this.policy.validate
      ? await this.policy.validate(action, context)
      : { allowed: true };
    if (!valid.allowed) {
      return this.skipped(action, valid, startedAt, log);
    }

    const executor = this.registry.resolve(action);

    if (!executor) {
      const error = new ExecutorNotFoundError(action.type, action.id);
      log("error", ExecutionPhase.ACTION_ERROR, error.message, {
        actionId: action.id,
      });
      return this.failure(action, null, error.message, startedAt);
    }

    log("info", ExecutionPhase.ACTION_START, `Iniciando ${action.type}.`, {
      actionId: action.id,
      executor: executor.name,
    });

    try {
      const output = await executor.execute(action, context);
      const finishedAt = this.clock.now();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      log("info", ExecutionPhase.ACTION_FINISH, `Concluida ${action.type}.`, {
        actionId: action.id,
        executor: executor.name,
        durationMs,
      });
      return {
        actionId: action.id,
        type: action.type,
        status: ActionStatus.SUCCESS,
        executor: executor.name,
        output,
        startedAt,
        finishedAt,
        durationMs,
      };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      log("error", ExecutionPhase.ACTION_ERROR, `Falhou ${action.type}: ${message}`, {
        actionId: action.id,
        executor: executor.name,
      });
      return this.failure(action, executor.name, message, startedAt);
    }
  }

  private skipped(
    action: Action,
    decision: PolicyDecision,
    startedAt: Date,
    log: (
      level: LogLevel,
      phase: ExecutionPhase,
      message: string,
      meta?: Partial<LogMeta>,
    ) => void,
  ): ActionResult {
    const reason = decision.reason ?? "Policy negou a execucao.";
    log("warn", ExecutionPhase.ACTION_ERROR, reason, { actionId: action.id });
    const finishedAt = this.clock.now();
    return {
      actionId: action.id,
      type: action.type,
      status: ActionStatus.SKIPPED,
      executor: null,
      error: reason,
      startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };
  }

  private failure(
    action: Action,
    executor: string | null,
    error: string,
    startedAt: Date,
  ): ActionResult {
    const finishedAt = this.clock.now();
    return {
      actionId: action.id,
      type: action.type,
      status: ActionStatus.FAILED,
      executor,
      error,
      startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };
  }

  private validatePlan(plan: ExecutionPlan): void {
    if (!plan || !Array.isArray(plan.actions)) {
      throw new InvalidExecutionPlanError("Plano sem lista de acoes.");
    }
    const ids = new Set<string>();
    for (const action of plan.actions) {
      if (!action.id) {
        throw new InvalidExecutionPlanError("Acao sem id.");
      }
      if (!action.type) {
        throw new InvalidExecutionPlanError(`Acao ${action.id} sem type.`);
      }
      if (ids.has(action.id)) {
        throw new InvalidExecutionPlanError(`Id de acao duplicado: ${action.id}.`);
      }
      ids.add(action.id);
    }
  }
}

function resolveStatus(results: readonly ActionResult[]): ExecutionStatus {
  if (results.length === 0) {
    return ExecutionStatus.SUCCESS;
  }
  const anyFailed = results.some((r) => r.status === ActionStatus.FAILED);
  const anySucceeded = results.some((r) => r.status === ActionStatus.SUCCESS);
  const anySkipped = results.some((r) => r.status === ActionStatus.SKIPPED);

  if (anyFailed && anySucceeded) {
    return ExecutionStatus.PARTIAL;
  }
  if (anySkipped && anySucceeded) {
    return ExecutionStatus.PARTIAL;
  }
  if (anyFailed || (anySkipped && !anySucceeded)) {
    return ExecutionStatus.FAILED;
  }
  return ExecutionStatus.SUCCESS;
}
