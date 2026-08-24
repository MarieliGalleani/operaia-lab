/**
 * ValidResult — COMPLETED sozinho NÃO basta.
 * Requer delivery DELIVERED + evidence; técnico exige technical_analysis;
 * financeiro exige contrato financial_analysis (P0.2H-5L);
 * UX exige contrato ux_analysis (P0.2H-POST.5);
 * Marketing exige contrato marketing_analysis (P0.2H-POST.6);
 * Product exige contrato product_analysis (P0.2H-POST.7);
 * Legal exige contrato legal_analysis (P0.2H-POST.8).
 */
import {
  extractFinancialToolExecutions,
  isValidFinancialAnalysisDelivery,
  isValidFinancialResultJson,
} from "@operaia/specialist-kit/finance-delivery-validation.js";
import {
  extractLegalToolExecutions,
  isValidLegalAnalysisDelivery,
  isValidLegalResultJson,
} from "@operaia/specialist-kit/legal-delivery-validation.js";
import {
  extractMarketingToolExecutions,
  isValidMarketingAnalysisDelivery,
  isValidMarketingResultJson,
} from "@operaia/specialist-kit/marketing-delivery-validation.js";
import {
  extractProductToolExecutions,
  isValidProductAnalysisDelivery,
  isValidProductResultJson,
} from "@operaia/specialist-kit/product-delivery-validation.js";
import {
  extractUxToolExecutions,
  isValidUxAnalysisDelivery,
  isValidUxResultJson,
} from "@operaia/specialist-kit/ux-delivery-validation.js";
import type {
  GovernanceMissionSnapshot,
  WorkIdentityKind,
} from "./types.js";

interface DeliveryLike {
  readonly type?: string;
  readonly status?: string;
  readonly employeeId?: string;
  readonly evidence?: readonly unknown[];
}

export function isValidDelivery(
  delivery: DeliveryLike | null | undefined,
  identityKind: WorkIdentityKind,
  resultJson?: unknown,
): boolean {
  if (!delivery) {
    return false;
  }

  const isFinance =
    identityKind === "finance" || delivery.type === "financial_analysis";

  if (isFinance) {
    const toolExecutions = extractFinancialToolExecutions(resultJson);
    if (
      !isValidFinancialAnalysisDelivery(
        delivery as Parameters<typeof isValidFinancialAnalysisDelivery>[0],
        toolExecutions,
      )
    ) {
      return false;
    }
    if (resultJson !== undefined && !isValidFinancialResultJson(resultJson)) {
      return false;
    }
    return true;
  }

  const isUx = identityKind === "ux" || delivery.type === "ux_analysis";
  if (isUx) {
    const toolExecutions = extractUxToolExecutions(resultJson);
    if (
      !isValidUxAnalysisDelivery(
        delivery as Parameters<typeof isValidUxAnalysisDelivery>[0],
        toolExecutions,
      )
    ) {
      return false;
    }
    if (resultJson !== undefined && !isValidUxResultJson(resultJson)) {
      return false;
    }
    return true;
  }

  const isMarketing =
    identityKind === "marketing" || delivery.type === "marketing_analysis";
  if (isMarketing) {
    const toolExecutions = extractMarketingToolExecutions(resultJson);
    if (
      !isValidMarketingAnalysisDelivery(
        delivery as Parameters<typeof isValidMarketingAnalysisDelivery>[0],
        toolExecutions,
      )
    ) {
      return false;
    }
    if (
      resultJson !== undefined &&
      !isValidMarketingResultJson(resultJson)
    ) {
      return false;
    }
    return true;
  }

  const isProduct =
    identityKind === "product" || delivery.type === "product_analysis";
  if (isProduct) {
    const toolExecutions = extractProductToolExecutions(resultJson);
    if (
      !isValidProductAnalysisDelivery(
        delivery as Parameters<typeof isValidProductAnalysisDelivery>[0],
        toolExecutions,
      )
    ) {
      return false;
    }
    if (
      resultJson !== undefined &&
      !isValidProductResultJson(resultJson)
    ) {
      return false;
    }
    return true;
  }

  const isLegal =
    identityKind === "legal" || delivery.type === "legal_analysis";
  if (isLegal) {
    const toolExecutions = extractLegalToolExecutions(resultJson);
    if (
      !isValidLegalAnalysisDelivery(
        delivery as Parameters<typeof isValidLegalAnalysisDelivery>[0],
        toolExecutions,
      )
    ) {
      return false;
    }
    if (resultJson !== undefined && !isValidLegalResultJson(resultJson)) {
      return false;
    }
    return true;
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
    if (isValidDelivery(delivery, identityKind, node.resultJson)) {
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
