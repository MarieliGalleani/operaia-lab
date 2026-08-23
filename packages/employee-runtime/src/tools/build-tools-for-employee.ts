/**
 * Helper de integracao: monta ToolContext filtrado pela Permission Policy.
 * Ports (ex.: GitHubToolAdapter) sao injetados pelo composition root.
 */
import {
  createToolContext,
  defaultToolPermissionPolicy,
  type ToolContext,
  type ToolPermissionPolicy,
  type ToolPorts,
} from "@operaia/tool-runtime";

export function buildToolsForEmployee(
  employeeId: string,
  options: {
    readonly workspaceId?: string;
    readonly policy?: ToolPermissionPolicy;
    readonly ports?: ToolPorts;
  } = {},
): ToolContext {
  return createToolContext({
    employeeId,
    workspaceId: options.workspaceId,
    policy: options.policy ?? defaultToolPermissionPolicy,
    ports: options.ports,
  });
}

export type EmployeeToolsFactory = (
  employeeId: string,
  workspaceId: string,
) => ToolContext | Promise<ToolContext>;

