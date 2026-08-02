/**
 * @operaia/mission-router — roteamento de intenção → missão (A.4.2).
 */

export { IntentType, ALL_INTENT_TYPES, type IntentType as IntentTypeValue } from "./intent-type.js";

export type {
  MissionIntent,
  MissionIntentPriority,
} from "./mission-intent.js";

export {
  classifyIntent,
  type IntentClassification,
} from "./intent-classifier.js";

export {
  RoutedEmployeeId,
  resolveEmployeeForIntent,
  defaultPriorityForIntent,
} from "./employee-routing-policy.js";

export {
  RuleBasedIntentRouter,
  defaultIntentRouter,
  formatObjectiveWithIntent,
  parseMissionIntentMarker,
  requiresSpecialistFromIntentMarker,
  MISSION_INTENT_MARKER,
  type IntentRouter,
} from "./intent-router.js";

export {
  ConversationMissionRouter,
  defaultConversationMissionRouter,
  type ConversationMissionType,
  type ConversationRouteContext,
  type ConversationRouteInput,
  type ConversationRouteResult,
  type ConversationMissionRouterOptions,
} from "./conversation-mission-router.js";
