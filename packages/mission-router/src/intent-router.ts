/**
 * IntentRouter — classifica mensagem e sugere employee/missão.
 */
import { classifyIntent } from "./intent-classifier.js";
import {
  defaultPriorityForIntent,
  resolveEmployeeForIntent,
} from "./employee-routing-policy.js";
import type { MissionIntent } from "./mission-intent.js";

export interface IntentRouter {
  route(message: string, workspaceId: string): MissionIntent;
}

/**
 * Implementacao deterministica (sem LLM) — Sprint A.4.2.
 */
export class RuleBasedIntentRouter implements IntentRouter {
  route(message: string, workspaceId: string): MissionIntent {
    const trimmed = message.trim();
    const { intentType, confidence } = classifyIntent(trimmed);
    const suggestedEmployee = resolveEmployeeForIntent(intentType, trimmed);

    return {
      message: trimmed,
      workspaceId,
      intentType,
      priority: defaultPriorityForIntent(intentType),
      suggestedEmployee,
      confidence,
    };
  }
}

export const defaultIntentRouter = new RuleBasedIntentRouter();

/** Prefixo estavel para enriquecimento do objective (CEO gate / auditoria). */
export const MISSION_INTENT_MARKER = "[MISSION_INTENT]";

export function formatObjectiveWithIntent(
  message: string,
  intent: MissionIntent,
): string {
  return (
    `${MISSION_INTENT_MARKER} ${intent.intentType}|employee:${intent.suggestedEmployee}|confidence:${intent.confidence.toFixed(2)}\n\n` +
    message.trim()
  );
}

export function parseMissionIntentMarker(objective: string): {
  readonly intentType: string;
  readonly employee: string;
} | null {
  const match =
    /\[MISSION_INTENT\]\s+([A-Z_]+)\|employee:([a-z0-9-]+)/i.exec(objective);
  if (!match?.[1] || !match[2]) {
    return null;
  }
  return { intentType: match[1], employee: match[2] };
}

export function requiresSpecialistFromIntentMarker(objective: string): boolean {
  const parsed = parseMissionIntentMarker(objective);
  if (!parsed) {
    return false;
  }
  return (
    parsed.intentType === "TECH_IMPLEMENTATION" ||
    parsed.intentType === "BUG_INVESTIGATION" ||
    parsed.intentType === "INFRASTRUCTURE_OPERATION"
  );
}
