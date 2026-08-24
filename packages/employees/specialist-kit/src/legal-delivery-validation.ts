/**
 * Governance Legal — isValidLegalAnalysisDelivery.
 *
 * Tools allowlisted alinhadas a Documents do Themis (sem readRepository).
 */
import {
  LEGAL_EVIDENCE_DOMAIN,
  containsResidualLegalSecrets,
  isLegalDenyKey,
  validateSanitizedLegalEvidence,
} from "./legal-evidence.js";
import { isLegalSensitivePath } from "./legal-artifact-path.js";

export const LEGAL_DELIVERY_TYPE = "legal_analysis";
export const LEGAL_EMPLOYEE_ID = "themis";

export const LEGAL_ALLOWED_TOOL_IDS = [
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

export interface LegalDeliveryLike {
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

export interface LegalToolExecutionLike {
  readonly toolId: string;
  readonly success: boolean;
  readonly outcome?: string;
}

function scanValueForLegalSecurityIssues(value: unknown): boolean {
  if (typeof value === "string") {
    return containsResidualLegalSecrets(value);
  }
  if (Array.isArray(value)) {
    return value.some((item) => scanValueForLegalSecurityIssues(item));
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (FORBIDDEN_CONTENT_KEYS.has(key.toLowerCase())) {
        return true;
      }
      if (isLegalDenyKey(key) && child !== "[REDACTED]") {
        return true;
      }
      if (scanValueForLegalSecurityIssues(child)) {
        return true;
      }
    }
  }
  return false;
}

function isLegalToolSource(source: string): boolean {
  return (LEGAL_ALLOWED_TOOL_IDS as readonly string[]).includes(source);
}

function isValidLegalEvidenceItem(item: {
  readonly source: string;
  readonly data: Readonly<Record<string, unknown>>;
}): boolean {
  if ("error" in item.data) {
    return false;
  }
  if (!isLegalToolSource(item.source)) {
    return false;
  }
  const validated = validateSanitizedLegalEvidence(item.data);
  if (!validated.ok) {
    return false;
  }
  if (scanValueForLegalSecurityIssues(item.data)) {
    return false;
  }
  const artifactPath = item.data.artifactPath;
  if (
    typeof artifactPath === "string" &&
    artifactPath !== "repository" &&
    artifactPath !== "" &&
    isLegalSensitivePath(artifactPath)
  ) {
    return false;
  }
  return item.data.domain === LEGAL_EVIDENCE_DOMAIN;
}

export function extractLegalToolExecutions(
  resultJson: unknown,
): readonly LegalToolExecutionLike[] {
  if (!resultJson || typeof resultJson !== "object") {
    return [];
  }
  const root = resultJson as Record<string, unknown>;
  const direct = root.toolExecutions;
  if (Array.isArray(direct)) {
    return direct as LegalToolExecutionLike[];
  }
  return [];
}

/**
 * Delivery Legal valida: DELIVERED + themis + evidence estruturada
 * com workspaceId + artifactPath + sem fullContent/secrets.
 * Exige listDirectory + readFile (policy Documents; sem readRepository).
 */
export function isValidLegalAnalysisDelivery(
  delivery: LegalDeliveryLike | null | undefined,
  toolExecutions: readonly LegalToolExecutionLike[] = [],
): boolean {
  if (!delivery) {
    return false;
  }
  if (delivery.type !== LEGAL_DELIVERY_TYPE) {
    return false;
  }
  if (delivery.status !== "DELIVERED") {
    return false;
  }
  if (delivery.employeeId && delivery.employeeId !== LEGAL_EMPLOYEE_ID) {
    return false;
  }
  const evidence = delivery.evidence ?? [];
  if (evidence.length === 0) {
    return false;
  }
  if (!evidence.every((item) => isValidLegalEvidenceItem(item))) {
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
  if (containsResidualLegalSecrets(delivery.summary)) {
    return false;
  }

  for (const execution of toolExecutions) {
    if (
      !(LEGAL_ALLOWED_TOOL_IDS as readonly string[]).includes(
        execution.toolId,
      )
    ) {
      return false;
    }
  }

  return true;
}

export function isValidLegalResultJson(resultJson: unknown): boolean {
  if (!resultJson || typeof resultJson !== "object") {
    return false;
  }
  const root = resultJson as Record<string, unknown>;
  const delivery = root.delivery as LegalDeliveryLike | undefined;
  const toolExecutions = extractLegalToolExecutions(resultJson);
  return isValidLegalAnalysisDelivery(delivery, toolExecutions);
}
