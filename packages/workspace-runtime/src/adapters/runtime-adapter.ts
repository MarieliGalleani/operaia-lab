import type { AgentRuntime, RuntimeResponse } from "@operaia/agent-runtime";
import type { ExecutionPlan } from "@operaia/execution-engine";
import type {
  ProposedPlan,
  RuntimeOutcome,
  RuntimePort,
  RuntimeRequest,
} from "@operaia/orchestration-engine";
import type { PlanMapper } from "../composition/plan-mapper.js";

export interface RuntimeAdapterDependencies {
  readonly agentRuntime: AgentRuntime;
  readonly planMapper: PlanMapper;
  readonly agentKey: string;
  /**
   * Estrategia para decidir se o objetivo foi atingido a partir do
   * RuntimeResponse. Default: um plano sem acoes indica objetivo concluido.
   */
  readonly isObjectiveComplete?: (
    response: RuntimeResponse,
    plan: ExecutionPlan,
  ) => boolean;
}

/**
 * Adapta o Agent Runtime concreto a porta neutra RuntimePort da orquestracao.
 * Traduz RuntimeResponse -> ExecutionPlan (via PlanMapper) e empacota o plano
 * como payload OPACO no ProposedPlan.
 */
export class RuntimeAdapter implements RuntimePort {
  constructor(private readonly deps: RuntimeAdapterDependencies) {}

  async run(request: RuntimeRequest): Promise<RuntimeOutcome> {
    const response = await this.deps.agentRuntime.run({
      agentKey: this.deps.agentKey,
      message: request.objective,
      metadata: request.metadata,
    });

    const executionPlan = this.deps.planMapper.toExecutionPlan(response);

    const objectiveCompleted = this.deps.isObjectiveComplete
      ? this.deps.isObjectiveComplete(response, executionPlan)
      : executionPlan.actions.length === 0;

    const plan: ProposedPlan = {
      id: executionPlan.id,
      actionCount: executionPlan.actions.length,
      payload: executionPlan,
    };

    return { plan, objectiveCompleted, output: response.output };
  }
}
