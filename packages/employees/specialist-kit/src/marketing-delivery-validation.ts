/**
 * Governance Marketing — isValidMarketingAnalysisDelivery.
 */
import {
  MARKETING_EVIDENCE_DOMAIN,
  containsResidualMarketingSecrets,
  isMarketingDenyKey,
  validateSanitizedMarketingEvidence,
} from "./marketing-evidence.js";
import { isMarketingSensitivePath } from "./marketing-artifact-path.js";

export const MARKETING_DELIVERY_TYPE = "marketing_analysis";
export const MARKETING_EMPLOYEE_ID = "mercurio";

export const MARKETING_ALLOWED_TOOL_IDS = [
  "readRepository",
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

export interface MarketingDeliveryLike {
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

export interface MarketingToolExecutionLike {
  readonly toolId: string;
  readonly success: boolean;
  readonly outcome?: string;
}

function scanValueForMarketingSecurityIssues(value: unknown): boolean {
  if (typeof value === "string") {
    return containsResidualMarketingSecrets(value);
  }
  if (Array.isArray(value)) {
    return value.some((item) => scanValueForMarketingSecurityIssues(item));
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (FORBIDDEN_CONTENT_KEYS.has(key.toLowerCase())) {
        return true;
      }
      if (isMarketingDenyKey(key) && child !== "[REDACTED]") {
        return true;
      }
      if (scanValueForMarketingSecurityIssues(child)) {
        return true;
      }
    }
  }
  return false;
}

function isMarketingToolSource(source: string): boolean {
  return (MARKETING_ALLOWED_TOOL_IDS as readonly string[]).includes(source);
}

function isValidMarketingEvidenceItem(item: {
  readonly source: string;
  readonly data: Readonly<Record<string, unknown>>;
}): boolean {
  if ("error" in item.data) {
    return false;
  }
  if (!isMarketingToolSource(item.source)) {
    return false;
  }
  const validated = validateSanitizedMarketingEvidence(item.data);
  if (!validated.ok) {
    return false;
  }
  if (scanValueForMarketingSecurityIssues(item.data)) {
    return false;
  }
  const artifactPath = item.data.artifactPath;
  if (
    typeof artifactPath === "string" &&
    artifactPath !== "repository" &&
    artifactPath !== "" &&
    isMarketingSensitivePath(artifactPath)
  ) {
    return false;
  }
  return item.data.domain === MARKETING_EVIDENCE_DOMAIN;
}

export function extractMarketingToolExecutions(
  resultJson: unknown,
): readonly MarketingToolExecutionLike[] {
  if (!resultJson || typeof resultJson !== "object") {
    return [];
  }
  const root = resultJson as Record<string, unknown>;
  const direct = root.toolExecutions;
  if (Array.isArray(direct)) {
    return direct as MarketingToolExecutionLike[];
  }
  return [];
}

/**
 * Delivery Marketing valida: DELIVERED + mercurio + evidence estruturada
 * com workspaceId + artifactPath + sem fullContent/secrets.
 * Exige readRepository + superficie (list/read).
 */
export function isValidMarketingAnalysisDelivery(
  delivery: MarketingDeliveryLike | null | undefined,
  toolExecutions: readonly MarketingToolExecutionLike[] = [],
): boolean {
  if (!delivery) {
    return false;
  }
  if (delivery.type !== MARKETING_DELIVERY_TYPE) {
    return false;
  }
  if (delivery.status !== "DELIVERED") {
    return false;
  }
  if (delivery.employeeId && delivery.employeeId !== MARKETING_EMPLOYEE_ID) {
    return false;
  }
  const evidence = delivery.evidence ?? [];
  if (evidence.length === 0) {
    return false;
  }
  if (!evidence.every((item) => isValidMarketingEvidenceItem(item))) {
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

  const hasRepo = evidence.some((item) => item.source === "readRepository");
  const hasSurface = evidence.some(
    (item) => item.source === "listDirectory" || item.source === "readFile",
  );
  if (!hasRepo || !hasSurface) {
    return false;
  }

  if (typeof delivery.summary !== "string" || !delivery.summary.trim()) {
    return false;
  }
  if (containsResidualMarketingSecrets(delivery.summary)) {
    return false;
  }

  for (const execution of toolExecutions) {
    if (
      !(MARKETING_ALLOWED_TOOL_IDS as readonly string[]).includes(
        execution.toolId,
      )
    ) {
      return false;
    }
  }

  return true;
}

export function isValidMarketingResultJson(resultJson: unknown): boolean {
  if (!resultJson || typeof resultJson !== "object") {
    return false;
  }
  const root = resultJson as Record<string, unknown>;
  const delivery = root.delivery as MarketingDeliveryLike | undefined;
  const toolExecutions = extractMarketingToolExecutions(resultJson);
  return isValidMarketingAnalysisDelivery(delivery, toolExecutions);
}
