/**
 * Tipos de intenção de missão (Sprint A.4.2).
 */
export const IntentType = {
  OPERATIONAL_REVIEW: "OPERATIONAL_REVIEW",
  TECH_IMPLEMENTATION: "TECH_IMPLEMENTATION",
  BUG_INVESTIGATION: "BUG_INVESTIGATION",
  INFRASTRUCTURE_OPERATION: "INFRASTRUCTURE_OPERATION",
  PROJECT_PLANNING: "PROJECT_PLANNING",
  EXECUTIVE_DECISION: "EXECUTIVE_DECISION",
  GENERAL_CONVERSATION: "GENERAL_CONVERSATION",
} as const;

export type IntentType = (typeof IntentType)[keyof typeof IntentType];

export const ALL_INTENT_TYPES: readonly IntentType[] = Object.values(IntentType);
