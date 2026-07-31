/**
 * ActionExecutor — policy → adapter → ledger (sem shell arbitrario).
 */
import { isKnownActionId } from "./action-id.js";
import { defaultActionPolicy, type ActionPolicy } from "./action-policy.js";
import type { ActionRequest } from "./action-request.js";
import { actionFail, type ActionResult } from "./action-result.js";
import {
  ActionExecutionStatus,
  type ActionAdapter,
  type WorkspaceActionScope,
} from "./action-types.js";
import type { ExecutionLedger } from "./ledgers/execution-ledger.js";

export interface ActionExecutorOptions {
  readonly policy?: ActionPolicy;
  readonly ledger: ExecutionLedger;
  readonly adapters: readonly ActionAdapter[];
  readonly scope?: WorkspaceActionScope;
}

export class ActionExecutor {
  private readonly policy: ActionPolicy;
  private readonly ledger: ExecutionLedger;
  private readonly scope?: WorkspaceActionScope;
  private readonly adapterByAction: Map<string, ActionAdapter>;

  constructor(options: ActionExecutorOptions) {
    this.policy = options.policy ?? defaultActionPolicy;
    this.ledger = options.ledger;
    this.scope = options.scope;
    this.adapterByAction = new Map();
    for (const adapter of options.adapters) {
      for (const actionId of adapter.supportedActions) {
        this.adapterByAction.set(actionId, adapter);
      }
    }
  }

  async execute(request: ActionRequest): Promise<ActionResult> {
    const actionId = String(request.actionId);
    const record = await this.ledger.create({
      workspaceId: request.workspaceId,
      employeeId: request.requestedBy,
      actionId,
      target: request.target,
    });

    const decision = this.policy.decide({
      employeeId: request.requestedBy,
      actionId,
      workspaceId: request.workspaceId,
    });

    if (!decision.allowed || !isKnownActionId(actionId)) {
      await this.ledger.updateStatus(record.id, ActionExecutionStatus.DENIED, {
        finishedAt: new Date().toISOString(),
        error: decision.reason,
      });
      return actionFail({
        actionId,
        error: decision.reason,
        metadata: {
          executionId: record.id,
          status: ActionExecutionStatus.DENIED,
          workspaceId: request.workspaceId,
          target: request.target,
        },
      });
    }

    if (this.scope) {
      const allowed = await this.scope.isTargetAllowed(
        request.workspaceId,
        request.target,
      );
      if (!allowed) {
        const reason = `Target fora do workspace ${request.workspaceId}: ${request.target}`;
        await this.ledger.updateStatus(record.id, ActionExecutionStatus.DENIED, {
          finishedAt: new Date().toISOString(),
          error: reason,
        });
        return actionFail({
          actionId,
          error: reason,
          metadata: {
            executionId: record.id,
            status: ActionExecutionStatus.DENIED,
            workspaceId: request.workspaceId,
            target: request.target,
          },
        });
      }
    }

    const adapter = this.adapterByAction.get(actionId);
    if (!adapter) {
      const reason = `Adapter ausente para ${actionId}`;
      await this.ledger.updateStatus(record.id, ActionExecutionStatus.FAILED, {
        finishedAt: new Date().toISOString(),
        error: reason,
      });
      return actionFail({
        actionId,
        error: reason,
        metadata: {
          executionId: record.id,
          status: ActionExecutionStatus.FAILED,
          workspaceId: request.workspaceId,
          target: request.target,
        },
      });
    }

    await this.ledger.updateStatus(record.id, ActionExecutionStatus.APPROVED);
    const startedAt = new Date().toISOString();
    await this.ledger.updateStatus(record.id, ActionExecutionStatus.RUNNING, {
      startedAt,
    });

    const startedMs = Date.now();
    try {
      const result = await adapter.execute(request);
      const finishedAt = new Date().toISOString();
      const durationMs = Date.now() - startedMs;
      const status = result.success
        ? ActionExecutionStatus.SUCCESS
        : ActionExecutionStatus.FAILED;

      await this.ledger.updateStatus(record.id, status, {
        finishedAt,
        result: {
          success: result.success,
          output: result.output,
          error: result.error,
        },
        error: result.error,
      });

      return {
        ...result,
        metadata: {
          ...result.metadata,
          executionId: record.id,
          status,
          workspaceId: request.workspaceId,
          target: request.target,
          durationMs,
        },
      };
    } catch (error) {
      const finishedAt = new Date().toISOString();
      const message =
        error instanceof Error ? error.message : "Erro desconhecido na acao";
      await this.ledger.updateStatus(record.id, ActionExecutionStatus.FAILED, {
        finishedAt,
        error: message,
      });
      return actionFail({
        actionId,
        error: message,
        metadata: {
          executionId: record.id,
          status: ActionExecutionStatus.FAILED,
          workspaceId: request.workspaceId,
          target: request.target,
          durationMs: Date.now() - startedMs,
        },
      });
    }
  }
}
