// Ativacao: colocar um funcionario para trabalhar dentro de um Workspace
export {
  EmployeeRunner,
  getToolContextFromBriefing,
  getActionCapabilityFromBriefing,
  BRIEFING_TOOL_CONTEXT_KEY,
  BRIEFING_ACTION_CAPABILITY_KEY,
} from "./activation/employee-runner.js";
export type {
  EmployeeContext,
  ExecutionSummaryNote,
} from "./activation/employee-context.js";
export type { EmployeeResult } from "./activation/employee-result.js";

// Briefing: adaptacao Workspace -> EmployeeBriefing
export { WorkspaceBriefingAdapter } from "./briefing/workspace-briefing-adapter.js";

// Delegacao: especialidade -> funcionario compativel
export { EmployeeMatcher } from "./delegation/employee-matcher.js";
export {
  DelegationService,
  type DelegationOutcome,
  type ExecutionReportPayload,
} from "./delegation/delegation-service.js";

// Execucao: EmployeeTask -> Actions do Execution Engine
export { EmployeeActionMapper } from "./execution/employee-action-mapper.js";

// Tool Runtime (A.1): ToolContext filtrado por Permission Policy
export { buildToolsForEmployee } from "./tools/build-tools-for-employee.js";
export type { EmployeeToolsFactory } from "./tools/build-tools-for-employee.js";

// Action Runtime (A.5): capacidade operacional via ActionRuntime
export {
  ACTION_CAPABLE_EMPLOYEE_IDS,
  buildActionsForEmployee,
  createEmployeeActionsFactory,
  isActionCapableEmployee,
} from "./actions/build-actions-for-employee.js";
export type { EmployeeActionsFactory } from "./actions/build-actions-for-employee.js";
