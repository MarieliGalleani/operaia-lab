/**
 * Factory do ToolContext — unica porta de criacao para o Employee Runtime.
 */
import { ToolContext } from "./tool-context.js";
import {
  defaultToolPermissionPolicy,
  type ToolPermissionPolicy,
} from "./tool-permission-policy.js";
import type { ToolPorts } from "./tools.js";

export interface CreateToolContextInput {
  readonly employeeId: string;
  readonly policy?: ToolPermissionPolicy;
  /** Adapters concretos (A.2+). Em A.1 permanece vazio. */
  readonly ports?: ToolPorts;
}

export function createToolContext(
  input: CreateToolContextInput,
): ToolContext {
  const policy = input.policy ?? defaultToolPermissionPolicy;
  return new ToolContext({
    employeeId: input.employeeId,
    allowedTools: policy.allowedTools(input.employeeId),
    ports: input.ports,
  });
}
