/**
 * Governance UX — isValidUxAnalysisDelivery (contrato especifico).
 */
import {
  UX_EVIDENCE_DOMAIN,
  containsResidualUxSecrets,
  isUxDenyKey,
  validateSanitizedUxEvidence,
} from "./ux-evidence.js";
import { isUxSensitivePath } from "./ux-artifact-path.js";

export const UX_DELIVERY_TYPE = "ux_analysis";
export const UX_EMPLOYEE_ID = "luna";

export const UX_ALLOWED_TOOL_IDS = [
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

export interface UxDeliveryLike {
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

export interface UxToolExecutionLike {
  readonly toolId: string;
  readonly success: boolean;
  readonly outcome?: string;
}

function scanValueForUxSecurityIssues(value: unknown): boolean {
  if (typeof value === "string") {
    return containsResidualUxSecrets(value);
  }
  if (Array.isArray(value)) {
    return value.some((item) => scanValueForUxSecurityIssues(item));
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (FORBIDDEN_CONTENT_KEYS.has(key.toLowerCase())) {
        return true;
      }
      if (isUxDenyKey(key) && child !== "[REDACTED]") {
        return true;
      }
      if (scanValueForUxSecurityIssues(child)) {
        return true;
      }
    }
  }
  return false;
}

function isUxToolSource(source: string): boolean {
  return (UX_ALLOWED_TOOL_IDS as readonly string[]).includes(source);
}

function isValidUxEvidenceItem(item: {
  readonly source: string;
  readonly data: Readonly<Record<string, unknown>>;
}): boolean {
  if ("error" in item.data) {
    return false;
  }
  if (!isUxToolSource(item.source)) {
    return false;
  }
  const validated = validateSanitizedUxEvidence(item.data);
  if (!validated.ok) {
    return false;
  }
  if (scanValueForUxSecurityIssues(item.data)) {
    return false;
  }
  const artifactPath = item.data.artifactPath;
  if (
    typeof artifactPath === "string" &&
    artifactPath !== "repository" &&
    artifactPath !== "" &&
    isUxSensitivePath(artifactPath)
  ) {
    return false;
  }
  return item.data.domain === UX_EVIDENCE_DOMAIN;
}

export function extractUxToolExecutions(
  resultJson: unknown,
): readonly UxToolExecutionLike[] {
  if (!resultJson || typeof resultJson !== "object") {
    return [];
  }
  const root = resultJson as Record<string, unknown>;
  const direct = root.toolExecutions;
  if (Array.isArray(direct)) {
    return direct as UxToolExecutionLike[];
  }
  return [];
}

/**
 * Delivery UX valida: DELIVERED + employee luna + evidence estruturada
 * com workspaceId + artifactPath + sem fullContent/secrets.
 * Exige ao menos readRepository + uma evidencia de superficie (list/read).
 */
export function isValidUxAnalysisDelivery(
  delivery: UxDeliveryLike | null | undefined,
  toolExecutions: readonly UxToolExecutionLike[] = [],
): boolean {
  if (!delivery) {
    return false;
  }
  if (delivery.type !== UX_DELIVERY_TYPE) {
    return false;
  }
  if (delivery.status !== "DELIVERED") {
    return false;
  }
  if (delivery.employeeId && delivery.employeeId !== UX_EMPLOYEE_ID) {
    return false;
  }
  const evidence = delivery.evidence ?? [];
  if (evidence.length === 0) {
    return false;
  }
  if (!evidence.every((item) => isValidUxEvidenceItem(item))) {
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
  if (containsResidualUxSecrets(delivery.summary)) {
    return false;
  }

  for (const execution of toolExecutions) {
    if (
      !(UX_ALLOWED_TOOL_IDS as readonly string[]).includes(execution.toolId)
    ) {
      return false;
    }
  }

  return true;
}

export function isValidUxResultJson(resultJson: unknown): boolean {
  if (!resultJson || typeof resultJson !== "object") {
    return false;
  }
  const root = resultJson as Record<string, unknown>;
  const delivery = root.delivery as UxDeliveryLike | undefined;
  const toolExecutions = extractUxToolExecutions(resultJson);
  return isValidUxAnalysisDelivery(delivery, toolExecutions);
}
