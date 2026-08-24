/**
 * Governance Product — isValidProductAnalysisDelivery.
 *
 * Tools allowlisted alinhadas a RoadmapDocs (sem readRepository).
 */
import {
  PRODUCT_EVIDENCE_DOMAIN,
  containsResidualProductSecrets,
  isProductDenyKey,
  validateSanitizedProductEvidence,
} from "./product-evidence.js";
import { isProductSensitivePath } from "./product-artifact-path.js";

export const PRODUCT_DELIVERY_TYPE = "product_analysis";
export const PRODUCT_EMPLOYEE_ID = "nexus";

export const PRODUCT_ALLOWED_TOOL_IDS = [
  "listDirectory",
  "readFile",
  "searchFiles",
] as const;

const FORBIDDEN_CONTENT_KEYS = new Set([
  "content",
  "body",
  "rawcontent",
  "fullcontent",
]);

export interface ProductDeliveryLike {
  readonly type?: string;
  readonly status?: string;
  readonly employeeId?: string;
  readonly evidence?: readonly {
    readonly source: string;
    readonly data: Readonly<Record<string, unknown>>;
  }[];
  readonly summary?: string;
  readonly findings?: readonly string[];
}

export interface ProductToolExecutionLike {
  readonly toolId: string;
  readonly success: boolean;
  readonly outcome?: string;
}

function scanValueForProductSecurityIssues(value: unknown): boolean {
  if (typeof value === "string") {
    return containsResidualProductSecrets(value);
  }
  if (Array.isArray(value)) {
    return value.some((item) => scanValueForProductSecurityIssues(item));
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (FORBIDDEN_CONTENT_KEYS.has(key.toLowerCase())) {
        return true;
      }
      if (isProductDenyKey(key) && child !== "[REDACTED]") {
        return true;
      }
      if (scanValueForProductSecurityIssues(child)) {
        return true;
      }
    }
  }
  return false;
}

function isProductToolSource(source: string): boolean {
  return (PRODUCT_ALLOWED_TOOL_IDS as readonly string[]).includes(source);
}

function isValidProductEvidenceItem(item: {
  readonly source: string;
  readonly data: Readonly<Record<string, unknown>>;
}): boolean {
  if ("error" in item.data) {
    return false;
  }
  if (!isProductToolSource(item.source)) {
    return false;
  }
  const validated = validateSanitizedProductEvidence(item.data);
  if (!validated.ok) {
    return false;
  }
  if (scanValueForProductSecurityIssues(item.data)) {
    return false;
  }
  const artifactPath = item.data.artifactPath;
  if (
    typeof artifactPath === "string" &&
    artifactPath !== "repository" &&
    artifactPath !== "" &&
    isProductSensitivePath(artifactPath)
  ) {
    return false;
  }
  return item.data.domain === PRODUCT_EVIDENCE_DOMAIN;
}

export function extractProductToolExecutions(
  resultJson: unknown,
): readonly ProductToolExecutionLike[] {
  if (!resultJson || typeof resultJson !== "object") {
    return [];
  }
  const root = resultJson as Record<string, unknown>;
  const direct = root.toolExecutions;
  if (Array.isArray(direct)) {
    return direct as ProductToolExecutionLike[];
  }
  return [];
}

/**
 * Delivery Product valida: DELIVERED + nexus + evidence estruturada
 * com workspaceId + artifactPath + sem fullContent/secrets.
 * Exige listDirectory + readFile (policy RoadmapDocs; sem readRepository).
 */
export function isValidProductAnalysisDelivery(
  delivery: ProductDeliveryLike | null | undefined,
  toolExecutions: readonly ProductToolExecutionLike[] = [],
): boolean {
  if (!delivery) {
    return false;
  }
  if (delivery.type !== PRODUCT_DELIVERY_TYPE) {
    return false;
  }
  if (delivery.status !== "DELIVERED") {
    return false;
  }
  if (delivery.employeeId && delivery.employeeId !== PRODUCT_EMPLOYEE_ID) {
    return false;
  }
  const evidence = delivery.evidence ?? [];
  if (evidence.length === 0) {
    return false;
  }
  if (!evidence.every((item) => isValidProductEvidenceItem(item))) {
    return false;
  }

  const workspaceIds = new Set(
    evidence
      .map((item) => item.data.workspaceId)
      .filter((id): id is string => typeof id === "string" && id.trim() !== ""),
  );
  if (workspaceIds.size !== 1) {
    return false;
  }

  const hasList = evidence.some((item) => item.source === "listDirectory");
  const hasRead = evidence.some((item) => item.source === "readFile");
  if (!hasList || !hasRead) {
    return false;
  }

  if (typeof delivery.summary !== "string" || !delivery.summary.trim()) {
    return false;
  }
  if (containsResidualProductSecrets(delivery.summary)) {
    return false;
  }

  for (const execution of toolExecutions) {
    if (
      !(PRODUCT_ALLOWED_TOOL_IDS as readonly string[]).includes(
        execution.toolId,
      )
    ) {
      return false;
    }
  }

  return true;
}

export function isValidProductResultJson(resultJson: unknown): boolean {
  if (!resultJson || typeof resultJson !== "object") {
    return false;
  }
  const root = resultJson as Record<string, unknown>;
  const delivery = root.delivery as ProductDeliveryLike | undefined;
  const toolExecutions = extractProductToolExecutions(resultJson);
  return isValidProductAnalysisDelivery(delivery, toolExecutions);
}
