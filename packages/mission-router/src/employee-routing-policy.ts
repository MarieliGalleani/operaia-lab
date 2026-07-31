/**
 * Politica de roteamento IntentType → Employee.
 */
import { IntentType } from "./intent-type.js";

export const RoutedEmployeeId = {
  opera: "operaia-ceo",
  mag: "cto-mag",
  atlas: "atlas",
  orion: "orion",
} as const;

export type RoutedEmployeeId =
  (typeof RoutedEmployeeId)[keyof typeof RoutedEmployeeId];

/**
 * Resolve o employee sugerido para um intent (+ mensagem para Atlas vs Orion).
 */
export function resolveEmployeeForIntent(
  intentType: IntentType,
  message: string,
): RoutedEmployeeId {
  switch (intentType) {
    case IntentType.TECH_IMPLEMENTATION:
    case IntentType.BUG_INVESTIGATION:
      return RoutedEmployeeId.mag;

    case IntentType.INFRASTRUCTURE_OPERATION:
      return resolveInfraEmployee(message);

    case IntentType.OPERATIONAL_REVIEW:
    case IntentType.PROJECT_PLANNING:
    case IntentType.EXECUTIVE_DECISION:
    case IntentType.GENERAL_CONVERSATION:
    default:
      return RoutedEmployeeId.opera;
  }
}

/**
 * Atlas: docker / servidor / infra geral.
 * Orion: logs / systemd / runtime operacional.
 */
function resolveInfraEmployee(message: string): RoutedEmployeeId {
  const text = message.toLowerCase();
  if (
    /\b(log|logs|journal|systemd|runtime|orion)\b/i.test(text) &&
    !/\b(docker|compose|caddy|container)\b/i.test(text)
  ) {
    return RoutedEmployeeId.orion;
  }
  return RoutedEmployeeId.atlas;
}

export function defaultPriorityForIntent(
  intentType: IntentType,
): "LOW" | "MEDIUM" | "HIGH" | "URGENT" {
  switch (intentType) {
    case IntentType.BUG_INVESTIGATION:
      return "HIGH";
    case IntentType.INFRASTRUCTURE_OPERATION:
      return "HIGH";
    case IntentType.TECH_IMPLEMENTATION:
      return "MEDIUM";
    case IntentType.EXECUTIVE_DECISION:
      return "HIGH";
    case IntentType.PROJECT_PLANNING:
      return "MEDIUM";
    case IntentType.OPERATIONAL_REVIEW:
      return "MEDIUM";
    default:
      return "LOW";
  }
}
