// Ativacao: colocar um funcionario para trabalhar dentro de um Workspace
export { EmployeeRunner } from "./activation/employee-runner.js";
export type { EmployeeContext } from "./activation/employee-context.js";
export type { EmployeeResult } from "./activation/employee-result.js";

// Briefing: adaptacao Workspace -> EmployeeBriefing
export { WorkspaceBriefingAdapter } from "./briefing/workspace-briefing-adapter.js";

// Delegacao: especialidade -> funcionario compativel
export { EmployeeMatcher } from "./delegation/employee-matcher.js";
export {
  DelegationService,
  type DelegationOutcome,
} from "./delegation/delegation-service.js";

// Execucao: EmployeeTask -> Actions do Execution Engine
export { EmployeeActionMapper } from "./execution/employee-action-mapper.js";
