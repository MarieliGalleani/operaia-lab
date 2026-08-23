import {
  FINANCE_EVIDENCE_DOMAIN,
  containsResidualFinancePii,
  isFinanceDenyKey,
} from "./finance-evidence.js";
import {
  FINANCE_MANDATORY_OVERVIEW,
  FINANCE_OPTIONAL_FILES,
} from "./finance-artifact-path.js";

export const FINANCE_DELIVERY_TYPE = "financial_analysis";
export const FINANCE_EMPLOYEE_ID = "aurora";

export const FINANCE_ALLOWED_TOOL_IDS = [
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

export interface FinancialDeliveryLike {
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

export interface FinancialToolExecutionLike {
  readonly toolId: string;
  readonly success: boolean;
  /** Codigo/mensagem persistidos pelo SpecialistBrain (`CODE: message`). */
  readonly outcome?: string;
}

function isAllowedFinancePath(path: string): boolean {
  if (path === "finance" || path === "billing") {
    return true;
  }
  if (path === "finance/" || path === "billing/") {
    return true;
  }
  return /^(finance|billing)\//.test(path);
}

function isFinanceToolSource(source: string): boolean {
  return (FINANCE_ALLOWED_TOOL_IDS as readonly string[]).includes(source);
}

function scanValueForFinanceSecurityIssues(value: unknown): boolean {
  if (typeof value === "string") {
    return containsResidualFinancePii(value);
  }
  if (Array.isArray(value)) {
    return value.some((item) => scanValueForFinanceSecurityIssues(item));
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (FORBIDDEN_CONTENT_KEYS.has(key.toLowerCase())) {
        return true;
      }
      if (isFinanceDenyKey(key) && child !== "[REDACTED]") {
        return true;
      }
      if (scanValueForFinanceSecurityIssues(child)) {
        return true;
      }
    }
  }
  return false;
}

function hasOverviewFinancialIndicator(
  data: Readonly<Record<string, unknown>>,
): boolean {
  const structured = data.structured;
  if (structured && typeof structured === "object") {
    const record = structured as Record<string, unknown>;
    if (record.runwayMonths != null) {
      return true;
    }
    if (record.monthlyBurn != null) {
      return true;
    }
    if (record.monthlyRevenue != null) {
      return true;
    }
    if (record.riskLevel != null && String(record.riskLevel).trim() !== "") {
      return true;
    }
  }
  const blob =
    `${String(data.summary ?? "")} ${String(data.contentExcerpt ?? "")}`.toLowerCase();
  return /\brunway\b|\bburn\b|\brevenue\b|risklevel|risk_level/.test(
    blob.replace(/[^a-z0-9_]/g, ""),
  );
}

function isValidFinanceEvidenceItem(item: {
  readonly source: string;
  readonly data: Readonly<Record<string, unknown>>;
}): boolean {
  if ("error" in item.data) {
    return false;
  }
  if (!isFinanceToolSource(item.source)) {
    return false;
  }
  const artifactPath = item.data.artifactPath;
  if (typeof artifactPath !== "string" || !isAllowedFinancePath(artifactPath)) {
    return false;
  }
  if (item.data.domain !== FINANCE_EVIDENCE_DOMAIN) {
    return false;
  }
  if (scanValueForFinanceSecurityIssues(item.data)) {
    return false;
  }
  return true;
}

/** Extrai codigo de erro do outcome auditavel (`NOT_FOUND: ...`). */
function parseOutcomeErrorCode(outcome: string | undefined): string | null {
  if (!outcome?.trim()) {
    return null;
  }
  const colon = outcome.indexOf(":");
  const raw = colon >= 0 ? outcome.slice(0, colon) : outcome;
  return raw.trim() || null;
}

function hasSuccessfulFinanceListEvidence(
  delivery: FinancialDeliveryLike,
): boolean {
  return (delivery.evidence ?? []).some(
    (item) =>
      item.source === "listDirectory" &&
      item.data.artifactPath === "finance" &&
      !("error" in item.data),
  );
}

/**
 * Evidence de erro NOT_FOUND em sondas explicitamente opcionais do contrato.
 * Nao ignora NOT_FOUND em operacoes obrigatorias (finance/, overview.md).
 */
function isIgnorableOptionalFinanceEvidenceError(
  item: {
    readonly source: string;
    readonly data: Readonly<Record<string, unknown>>;
  },
  delivery: FinancialDeliveryLike,
): boolean {
  if (!("error" in item.data)) {
    return false;
  }
  if (item.data.error !== "NOT_FOUND") {
    return false;
  }
  if (item.source === "searchFiles") {
    return true;
  }
  if (item.source === "listDirectory") {
    return hasSuccessfulFinanceListEvidence(delivery);
  }
  if (item.source === "readFile") {
    const artifactPath = item.data.artifactPath ?? item.data.path;
    if (typeof artifactPath !== "string") {
      return false;
    }
    return (FINANCE_OPTIONAL_FILES as readonly string[]).includes(artifactPath);
  }
  return false;
}

/**
 * Valida toolExecutions alinhado a ordem do SpecialistBrain.inspectFinanceArtifacts:
 * 1 listDirectory(finance)* → readFile(overview)* → readFile(opcionais) → searchFiles → listDirectory(billing)
 * * obrigatorios; demais falhas NOT_FOUND sao ausencia opcional permitida.
 */
function validateFinanceToolExecutions(
  toolExecutions: readonly FinancialToolExecutionLike[],
): boolean {
  let listDirectoryIndex = 0;
  let readFileIndex = 0;

  for (const execution of toolExecutions) {
    if (
      !(FINANCE_ALLOWED_TOOL_IDS as readonly string[]).includes(
        execution.toolId,
      )
    ) {
      return false;
    }

    if (execution.success) {
      if (execution.toolId === "listDirectory") {
        listDirectoryIndex += 1;
      } else if (execution.toolId === "readFile") {
        readFileIndex += 1;
      }
      continue;
    }

    const errorCode = parseOutcomeErrorCode(execution.outcome);

    if (execution.toolId === "listDirectory") {
      listDirectoryIndex += 1;
      if (listDirectoryIndex === 1) {
        return false;
      }
      if (errorCode !== "NOT_FOUND") {
        return false;
      }
      continue;
    }

    if (execution.toolId === "readFile") {
      readFileIndex += 1;
      if (readFileIndex === 1) {
        return false;
      }
      if (errorCode !== "NOT_FOUND") {
        return false;
      }
      continue;
    }

    if (execution.toolId === "searchFiles" && errorCode !== "NOT_FOUND") {
      return false;
    }
  }

  return true;
}

export function isValidFinancialAnalysisDelivery(
  delivery: FinancialDeliveryLike | null | undefined,
  toolExecutions?: readonly FinancialToolExecutionLike[] | null,
): boolean {
  if (!delivery) {
    return false;
  }
  if (delivery.type !== FINANCE_DELIVERY_TYPE) {
    return false;
  }
  if (delivery.status !== "DELIVERED") {
    return false;
  }
  if (delivery.employeeId !== FINANCE_EMPLOYEE_ID) {
    return false;
  }
  if (!Array.isArray(delivery.evidence) || delivery.evidence.length < 2) {
    return false;
  }
  if (!toolExecutions || toolExecutions.length === 0) {
    return false;
  }

  if (!validateFinanceToolExecutions(toolExecutions)) {
    return false;
  }

  for (const item of delivery.evidence) {
    const artifactPath = item.data.artifactPath ?? item.data.path;
    if (typeof artifactPath === "string" && !isAllowedFinancePath(artifactPath)) {
      return false;
    }
    if (isFinanceToolSource(item.source) && !isValidFinanceEvidenceItem(item)) {
      if (isIgnorableOptionalFinanceEvidenceError(item, delivery)) {
        continue;
      }
      return false;
    }
    if (scanValueForFinanceSecurityIssues(item.data)) {
      return false;
    }
  }

  const financeEvidence = delivery.evidence.filter((item) =>
    isValidFinanceEvidenceItem(item),
  );
  if (financeEvidence.length < 2) {
    return false;
  }

  const hasOverview = delivery.evidence.some(
    (item) =>
      item.source === "readFile" &&
      item.data.artifactPath === FINANCE_MANDATORY_OVERVIEW &&
      !("error" in item.data) &&
      hasOverviewFinancialIndicator(item.data),
  );
  if (!hasOverview) {
    return false;
  }

  const hasListDirectory = delivery.evidence.some(
    (item) =>
      item.source === "listDirectory" &&
      item.data.artifactPath === "finance" &&
      !("error" in item.data),
  );
  if (!hasListDirectory) {
    return false;
  }

  return true;
}

export function isValidFinancialResultJson(resultJson: unknown): boolean {
  if (!resultJson || typeof resultJson !== "object") {
    return true;
  }
  const serialized = JSON.stringify(resultJson);
  if (containsResidualFinancePii(serialized)) {
    return false;
  }
  const lower = serialized.toLowerCase();
  if (/\bsk-live\b|"client_secret"\s*:|"password"\s*:/.test(lower)) {
    return false;
  }

  const root = resultJson as Record<string, unknown>;
  const delivery = root.delivery ?? extractNestedDelivery(root);
  if (delivery && typeof delivery === "object") {
    const evidence = (delivery as FinancialDeliveryLike).evidence ?? [];
    for (const item of evidence) {
      if (scanValueForFinanceSecurityIssues(item.data)) {
        return false;
      }
      for (const forbidden of FORBIDDEN_CONTENT_KEYS) {
        if (forbidden in item.data) {
          return false;
        }
      }
    }
  }
  return true;
}

function extractNestedDelivery(
  root: Record<string, unknown>,
): FinancialDeliveryLike | null {
  const employeeResult = root.employeeResult;
  if (!employeeResult || typeof employeeResult !== "object") {
    return null;
  }
  const output = (employeeResult as Record<string, unknown>).output;
  if (!output || typeof output !== "object") {
    return null;
  }
  const decision = (output as Record<string, unknown>).decision;
  if (!decision || typeof decision !== "object") {
    return null;
  }
  const delivery = (decision as Record<string, unknown>).delivery;
  if (!delivery || typeof delivery !== "object") {
    return null;
  }
  return delivery as FinancialDeliveryLike;
}

export function extractFinancialToolExecutions(
  resultJson: unknown,
): readonly FinancialToolExecutionLike[] {
  if (!resultJson || typeof resultJson !== "object") {
    return [];
  }
  const root = resultJson as Record<string, unknown>;
  if (Array.isArray(root.toolExecutions)) {
    return root.toolExecutions as readonly FinancialToolExecutionLike[];
  }
  const employeeResult = root.employeeResult;
  if (!employeeResult || typeof employeeResult !== "object") {
    return [];
  }
  const output = (employeeResult as Record<string, unknown>).output;
  if (!output || typeof output !== "object") {
    return [];
  }
  const decision = (output as Record<string, unknown>).decision;
  if (!decision || typeof decision !== "object") {
    return [];
  }
  const toolExecutions = (decision as Record<string, unknown>).toolExecutions;
  if (!Array.isArray(toolExecutions)) {
    return [];
  }
  return toolExecutions as readonly FinancialToolExecutionLike[];
}
