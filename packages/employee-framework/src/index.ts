// Employee (contrato + perfil + motor)
export {
  Specialization,
} from "./employee/employee-specialization.js";
export type { EmployeeProfile } from "./employee/employee-profile.js";
export type { Employee, EmployeeBrain } from "./employee/employee-contract.js";
export {
  BaseEmployee,
  type EmployeePolicies,
} from "./employee/base-employee.js";

// Briefing
export type {
  EmployeeBriefing,
  BriefingSection,
} from "./briefing/employee-briefing.js";
export {
  BriefingBuilder,
  type WorkspaceSnapshot,
} from "./briefing/briefing-builder.js";
export { validateBriefing } from "./briefing/briefing-validator.js";

// Contratos de dados
export type { EmployeeTask } from "./contracts/employee-task.js";
export type { EmployeeInput } from "./contracts/employee-input.js";
export type { EmployeeOutput } from "./contracts/employee-output.js";
export type { EmployeeReport } from "./contracts/employee-report.js";

// Decisao e politicas
export type {
  EmployeeDecision,
  EmployeeToolExecution,
  EmployeeDelivery,
  EmployeeDeliveryEvidence,
  DelegationRequest,
} from "./decision/decision-model.js";
export type { DelegationPolicy } from "./decision/delegation-policy.js";
export type { ResponsePolicy } from "./decision/response-policy.js";
export type {
  QualityPolicy,
  QualityResult,
  QualityIssue,
} from "./decision/quality-policy.js";

// Defaults
export { DefaultResponsePolicy } from "./defaults/default-response-policy.js";
export { DefaultQualityPolicy } from "./defaults/default-quality-policy.js";
export { DefaultDelegationPolicy } from "./defaults/default-delegation-policy.js";

// Factory e Registry
export {
  EmployeeFactory,
  type EmployeeBlueprint,
} from "./factory/employee-factory.js";
export {
  EmployeeRegistry,
  defineEmployee,
  type RegisteredEmployee,
} from "./factory/employee-registry.js";

// Erros
export {
  EmployeeFrameworkError,
  BriefingValidationError,
  EmployeeNotFoundError,
  EmployeeAlreadyRegisteredError,
} from "./errors/index.js";
