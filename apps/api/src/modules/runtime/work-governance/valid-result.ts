/**
 * ValidResult — COMPLETED sozinho NÃO basta.
 * Requer delivery DELIVERED + evidence; técnico exige technical_analysis.
 */
import type {
  GovernanceMissionSnapshot,
  WorkIdentityKind,
} from "./types.js";

interface DeliveryLike {
  readonly type?: string;
  readonly status?: string;
  readonly evidence?: readonly unknown[];
}

export function isValidDelivery(
  delivery: DeliveryLike | null | undefined,
  identityKind: WorkIdentityKind,
): boolean {
  if (!delivery) {
    return false;
  }
  if (delivery.status !== "DELIVERED") {
    return false;
  }
  if (!Array.isArray(delivery.evidence) || delivery.evidence.length === 0) {
    return false;
  }
  if (identityKind === "technical") {
    return delivery.type === "technical_analysis";
  }
  return true;
}

export function extractDeliveryFromResultJson(
  resultJson: unknown,
): DeliveryLike | null {
  if (!resultJson || typeof resultJson !== "object") {
    return null;
  }
  const root = resultJson as Record<string, unknown>;
  const direct = asDelivery(root["delivery"]);
  if (direct) {
    return direct;
  }
  const employeeResult = root["employeeResult"];
  if (employeeResult && typeof employeeResult === "object") {
    const output = (employeeResult as Record<string, unknown>)["output"];
    if (output && typeof output === "object") {
      const decision = (output as Record<string, unknown>)["decision"];
      if (decision && typeof decision === "object") {
        const nested = asDelivery(
          (decision as Record<string, unknown>)["delivery"],
        );
        if (nested) {
          return nested;
        }
      }
    }
  }
  const final = root["final"];
  if (final && typeof final === "object") {
    const output = (final as Record<string, unknown>)["output"];
    if (output && typeof output === "object") {
      const decision = (output as Record<string, unknown>)["decision"];
      if (decision && typeof decision === "object") {
        return asDelivery((decision as Record<string, unknown>)["delivery"]);
      }
    }
  }
  return null;
}

/**
 * Árvore COORDINATE + filhos: ValidResult se algum COMPLETED tiver delivery válida.
 * COORDINATE sem delegation / sem delivery técnico → false.
 */
export function treeHasValidResult(
  root: GovernanceMissionSnapshot,
  children: readonly GovernanceMissionSnapshot[],
  identityKind: WorkIdentityKind,
): boolean {
  const nodes = [root, ...children];
  for (const node of nodes) {
    if (node.status !== "COMPLETED") {
      continue;
    }
    const delivery = extractDeliveryFromResultJson(node.resultJson);
    if (isValidDelivery(delivery, identityKind)) {
      return true;
    }
  }
  return false;
}

function asDelivery(value: unknown): DeliveryLike | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as DeliveryLike;
}
