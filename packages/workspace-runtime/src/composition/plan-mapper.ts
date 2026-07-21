import { randomUUID } from "node:crypto";
import type { RuntimeResponse } from "@operaia/agent-runtime";
import {
  ActionStatus,
  type Action,
  type ExecutionPlan,
} from "@operaia/execution-engine";
import { Priority } from "@operaia/shared";

/**
 * Traduz um RuntimeResponse (raciocinio do agente) em um ExecutionPlan
 * executavel pelo Execution Engine.
 *
 * Esta e a UNICA camada que conhece os dois vocabularios de "plano" e impede
 * qualquer acoplamento entre Runtime e Execution Engine.
 */
export class PlanMapper {
  toExecutionPlan(response: RuntimeResponse): ExecutionPlan {
    const actions: Action[] = response.actions.map((action) => ({
      id: randomUUID(),
      type: action.type,
      description: describeAction(action.type, action.payload),
      payload: action.payload,
      priority: resolvePriority(action.payload),
      status: ActionStatus.PENDING,
    }));

    return {
      id: randomUUID(),
      actions,
      metadata: { source: "agent-runtime", output: response.output },
    };
  }
}

function describeAction(
  type: string,
  payload: Readonly<Record<string, unknown>>,
): string {
  const description = payload["description"];
  return typeof description === "string" && description.length > 0
    ? description
    : `Acao ${type}`;
}

function resolvePriority(payload: Readonly<Record<string, unknown>>): Priority {
  const candidate = payload["priority"];
  const values = Object.values(Priority) as string[];
  return typeof candidate === "string" && values.includes(candidate)
    ? (candidate as Priority)
    : Priority.MEDIUM;
}
