/**
 * @operaia/validation-suite — suíte oficial de validação operacional (Sprint A.V).
 */

export {
  assert,
  failScenario,
  passScenario,
  type ScenarioResult,
  type ScenarioStatus,
  type ValidationScenario,
} from "./scenario.js";

export { runScenarios } from "./scenario-runner.js";

export {
  buildValidationReport,
  type ValidationReport,
} from "./validation-report.js";

export {
  ValidationRunner,
  runValidationSuite,
  type ValidationRunnerOptions,
  type ValidationRunnerResult,
} from "./validation-runner.js";

export {
  buildOperationalProof,
  type OperationalProof,
} from "./operational-proof.js";

export {
  ALL_VALIDATION_SCENARIOS,
  actionRuntimeScenario,
  bugInvestigationScenario,
  ceoConversationScenario,
  conversationRoutingScenario,
  infrastructureOperationScenario,
  ledgerValidationScenario,
  operationalReviewScenario,
  policyValidationScenario,
  recoveryScenario,
  techImplementationScenario,
  workerSelectionScenario,
  workspaceIsolationScenario,
} from "./scenarios/scenarios.js";
