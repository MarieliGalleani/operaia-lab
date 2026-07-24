import { randomUUID } from "node:crypto";
import {
  ActionRegistry,
  ActionStatus,
  ActionType,
  AllowlistActionPolicy,
  ExecutionEngine,
  NoopExecutor,
  TaskActionExecutor,
  normalizeExecutionResults,
  type Action,
  type ActionPolicy,
  type ExecutionPlan,
  type ExecutionResult,
  type NormalizedActionResult,
} from "@operaia/execution-engine";
import { Priority } from "@operaia/shared";
import type { TaskRepository } from "../tasks/domain/task.repository.js";
import { DomainUpdateTaskExecutor } from "./domain-update-task-executor.js";

export interface MissionExecutionStack {
  readonly registry: ActionRegistry;
  readonly policy: ActionPolicy;
  readonly engine: ExecutionEngine;
}

export interface BuildMissionPlanInput {
  readonly workspaceId: string;
  readonly objective: string;
  /** Actions extras (sync de dominio, auditoria adicional, etc.). */
  readonly extraActions?: readonly Action[];
}

/**
 * Composition do motor oficial da Equipe Digital.
 * Com TaskRepository: UPDATE_TASK persiste no board.
 * Sem TaskRepository: UPDATE_TASK e acknowledge-only (testes isolados).
 */
export function createMissionExecutionStack(
  overrides: {
    readonly policy?: ActionPolicy;
    readonly taskRepository?: TaskRepository;
  } = {},
): MissionExecutionStack {
  const updateExecutor = overrides.taskRepository
    ? new DomainUpdateTaskExecutor(overrides.taskRepository)
    : new NoopExecutor(ActionType.UPDATE_TASK);

  const registry = new ActionRegistry()
    .register(ActionType.CREATE_TASK, new TaskActionExecutor())
    .register(ActionType.UPDATE_TASK, updateExecutor)
    .register(ActionType.LOG, new NoopExecutor(ActionType.LOG));

  const policy =
    overrides.policy ??
    new AllowlistActionPolicy([
      ActionType.CREATE_TASK,
      ActionType.UPDATE_TASK,
      ActionType.LOG,
    ]);

  const engine = new ExecutionEngine({
    registry: registry.toExecutorRegistry(),
    policy,
  });

  return { registry, policy, engine };
}

/**
 * Plano de execucao da missao.
 * Sempre inclui LOG de auditoria; extraActions trazem sync de dominio.
 */
export function buildMissionExecutionPlan(
  input: BuildMissionPlanInput,
): ExecutionPlan {
  const audit: Action = {
    id: randomUUID(),
    type: ActionType.LOG,
    description: `Auditoria de missao: ${input.objective.slice(0, 120)}`,
    payload: {
      workspaceId: input.workspaceId,
      kind: "mission-execution-audit",
      objective: input.objective,
    },
    priority: Priority.LOW,
    status: ActionStatus.PENDING,
  };

  return {
    id: randomUUID(),
    actions: [audit, ...(input.extraActions ?? [])],
    metadata: {
      source: "mission-orchestrator",
      workspaceId: input.workspaceId,
    },
  };
}

export async function executeMissionPlan(
  stack: MissionExecutionStack,
  plan: ExecutionPlan,
): Promise<{
  readonly result: ExecutionResult;
  readonly summaries: readonly NormalizedActionResult[];
}> {
  const result = await stack.engine.execute(plan);
  return {
    result,
    summaries: normalizeExecutionResults(result.results),
  };
}
