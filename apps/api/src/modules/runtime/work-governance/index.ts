/**
 * Factory de produto — AlreadyDoneGate com Prisma.
 */
import { AlreadyDoneGate } from "./already-done-gate.js";
import { PrismaWorkGovernanceLedger } from "./decision-ledger.js";
import { PrismaPriorMissionLookup } from "./prior-mission-lookup.js";

export function createPrismaAlreadyDoneGate(): AlreadyDoneGate {
  return new AlreadyDoneGate({
    ledger: new PrismaWorkGovernanceLedger(),
    missions: new PrismaPriorMissionLookup(),
  });
}

export { AlreadyDoneGate } from "./already-done-gate.js";
export type { PriorMissionLookupPort } from "./already-done-gate.js";
export {
  InMemoryWorkGovernanceLedger,
  PrismaWorkGovernanceLedger,
} from "./decision-ledger.js";
export {
  InMemoryPriorMissionLookup,
  PrismaPriorMissionLookup,
} from "./prior-mission-lookup.js";
export {
  buildContextFingerprint,
  contextFingerprintsMatch,
} from "./context-fingerprint.js";
export {
  extractDeliveryFromResultJson,
  isValidDelivery,
  treeHasValidResult,
} from "./valid-result.js";
export { buildWorkIdentity, normalizeTarget } from "./work-identity.js";
export type {
  WorkContextHints,
  WorkGovernanceAdmitResult,
  WorkGovernanceDecisionKind,
  WorkGovernanceRequest,
  WorkGovernanceSource,
} from "./types.js";
export { WORK_GOVERNANCE_AUTHORITY } from "./types.js";
