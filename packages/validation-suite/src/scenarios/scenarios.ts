import { actionRuntimeScenario } from "./action-runtime.js";
import {
  bugInvestigationScenario,
  techImplementationScenario,
} from "./technical-delegation.js";
import {
  ceoConversationScenario,
  conversationRoutingScenario,
} from "./ceo-conversation.js";
import { infrastructureOperationScenario } from "./infrastructure-operation.js";
import { ledgerValidationScenario } from "./ledger-validation.js";
import { operationalReviewScenario } from "./operational-review.js";
import { policyValidationScenario } from "./policy-validation.js";
import { recoveryScenario } from "./recovery.js";
import { workerSelectionScenario } from "./worker-selection.js";
import { workspaceIsolationScenario } from "./workspace-isolation.js";
import type { ValidationScenario } from "../scenario.js";

/** Ordem oficial dos 12 cenarios obrigatorios da Sprint A.V. */
export const ALL_VALIDATION_SCENARIOS: readonly ValidationScenario[] = [
  ceoConversationScenario,
  operationalReviewScenario,
  techImplementationScenario,
  bugInvestigationScenario,
  infrastructureOperationScenario,
  actionRuntimeScenario,
  policyValidationScenario,
  workspaceIsolationScenario,
  workerSelectionScenario,
  ledgerValidationScenario,
  conversationRoutingScenario,
  recoveryScenario,
];

export {
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
};
