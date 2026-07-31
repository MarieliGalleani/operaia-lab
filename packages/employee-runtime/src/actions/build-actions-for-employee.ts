/**
 * Factory de ActionCapabilityProvider para Employees (Sprint A.5).
 * Apenas Atlas e Orion recebem capacidade nesta sprint.
 */
import {
  createActionCapabilityProvider,
  type ActionCapabilityProvider,
  type ActionRuntime,
} from "@operaia/action-runtime";

/** Employees com Action Runtime integrado (A.5). */
export const ACTION_CAPABLE_EMPLOYEE_IDS: ReadonlySet<string> = new Set([
  "atlas",
  "orion",
]);

export type EmployeeActionsFactory = (
  employeeId: string,
  workspaceId: string,
) =>
  | ActionCapabilityProvider
  | null
  | Promise<ActionCapabilityProvider | null>;

export function isActionCapableEmployee(employeeId: string): boolean {
  return ACTION_CAPABLE_EMPLOYEE_IDS.has(employeeId);
}

/**
 * Monta provider bound a employee + workspace, ou null se fora do escopo A.5.
 */
export function buildActionsForEmployee(
  employeeId: string,
  workspaceId: string,
  runtime: ActionRuntime,
): ActionCapabilityProvider | null {
  if (!isActionCapableEmployee(employeeId)) {
    return null;
  }
  return createActionCapabilityProvider({
    runtime,
    employeeId,
    workspaceId,
  });
}

export function createEmployeeActionsFactory(
  runtime: ActionRuntime,
): EmployeeActionsFactory {
  return (employeeId, workspaceId) =>
    buildActionsForEmployee(employeeId, workspaceId, runtime);
}
