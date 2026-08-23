import {
  validateFinanceListDirectoryPath,
  validateFinanceReadFilePath,
  validateFinanceSearchPrefix,
} from "./finance-artifact-path.js";

export const FINANCE_EVIDENCE_DOMAIN = "finance_artifacts";
export const EVIDENCE_PII_BLOCKED = "EVIDENCE_PII_BLOCKED";

const FINANCE_STRUCTURED_KEYS = [
  "schemaVersion",
  "period",
  "currency",
  "runwayMonths",
  "monthlyBurn",
  "monthlyRevenue",
  "riskLevel",
  "notes",
] as const;

const DENY_KEY_FRAGMENTS = [
  "password",
  "secret",
  "token",
  "api_key",
  "apikey",
  "account_number",
  "accountnumber",
  "iban",
  "cpf",
  "cnpj",
  "credit_card",
  "creditcard",
  "cvv",
  "bank_account",
  "bankaccount",
  "routing_number",
  "routingnumber",
  "client_secret",
  "clientsecret",
  "authorization",
] as const;

const FORBIDDEN_EVIDENCE_KEYS = new Set([
  "content",
  "body",
  "rawcontent",
  "fullcontent",
]);

const CPF_RE = /\d{3}\.\d{3}\.\d{3}-\d{2}/g;
const CNPJ_RE = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g;
const CARD_RE = /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g;

const REDACTED = "[REDACTED]";
const MAX_CONTENT_EXCERPT = 500;

export type FinanceEvidenceBuildResult =
  | { readonly ok: true; readonly data: Readonly<Record<string, unknown>> }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
    };

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isFinanceDenyKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return DENY_KEY_FRAGMENTS.some((fragment) =>
    normalized.includes(fragment.replace(/[^a-z0-9]/g, "")),
  );
}

export function redactFinancePiiInText(text: string): string {
  return text
    .replace(CPF_RE, REDACTED)
    .replace(CNPJ_RE, REDACTED)
    .replace(CARD_RE, REDACTED);
}

export function containsResidualFinancePii(text: string): boolean {
  CPF_RE.lastIndex = 0;
  CNPJ_RE.lastIndex = 0;
  CARD_RE.lastIndex = 0;
  return CPF_RE.test(text) || CNPJ_RE.test(text) || CARD_RE.test(text);
}

function scanObjectForResidualPii(value: unknown): boolean {
  if (typeof value === "string") {
    return containsResidualFinancePii(value);
  }
  if (Array.isArray(value)) {
    return value.some((item) => scanObjectForResidualPii(item));
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) =>
      scanObjectForResidualPii(item),
    );
  }
  return false;
}

export function sanitizeFinanceStructuredValue(
  key: string,
  value: unknown,
): unknown {
  if (isFinanceDenyKey(key)) {
    return REDACTED;
  }
  if (typeof value === "string") {
    return redactFinancePiiInText(value);
  }
  return value;
}

export function parseFinanceFrontmatter(
  content: string,
): Readonly<Record<string, unknown>> | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u.exec(content);
  if (!match) {
    return null;
  }
  const block = match[1] ?? "";
  const structured: Record<string, unknown> = {};
  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const sep = trimmed.indexOf(":");
    if (sep <= 0) {
      continue;
    }
    const key = trimmed.slice(0, sep).trim();
    if (!(FINANCE_STRUCTURED_KEYS as readonly string[]).includes(key)) {
      continue;
    }
    let raw = trimmed.slice(sep + 1).trim();
    if (
      (raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))
    ) {
      raw = raw.slice(1, -1);
    }
    if (/^-?\d+(\.\d+)?$/.test(raw)) {
      structured[key] = Number(raw);
    } else {
      structured[key] = sanitizeFinanceStructuredValue(key, raw);
    }
  }
  return Object.keys(structured).length > 0 ? structured : null;
}

function validateFinanceArtifactPathForEvidence(
  artifactPath: string,
  toolId: "listDirectory" | "readFile" | "searchFiles",
): FinanceEvidenceBuildResult {
  if (toolId === "listDirectory") {
    const validated = validateFinanceListDirectoryPath(artifactPath);
    if (!validated.ok) {
      return {
        ok: false,
        code: validated.code,
        message: validated.message,
      };
    }
    return { ok: true, data: { artifactPath: validated.normalized } };
  }
  if (toolId === "readFile") {
    const validated = validateFinanceReadFilePath(artifactPath);
    if (!validated.ok) {
      return {
        ok: false,
        code: validated.code,
        message: validated.message,
      };
    }
    return { ok: true, data: { artifactPath: validated.normalized } };
  }
  const validated = validateFinanceSearchPrefix(artifactPath.replace(/\/+$/, ""));
  if (!validated.ok) {
    return {
      ok: false,
      code: validated.code,
      message: validated.message,
    };
  }
  return { ok: true, data: { artifactPath: validated.normalized } };
}

function buildSummary(
  toolId: string,
  artifactPath: string,
  structured: Readonly<Record<string, unknown>> | undefined,
  rawToolData: Readonly<Record<string, unknown>>,
): string {
  if (structured?.runwayMonths != null) {
    return `overview ${String(structured.runwayMonths)}m runway`;
  }
  if (structured?.monthlyBurn != null) {
    return "monthly cost overview";
  }
  if (structured?.monthlyRevenue != null) {
    return "monthly revenue overview";
  }
  if (artifactPath.startsWith("billing/")) {
    return "billing aggregate summary";
  }
  if (toolId === "listDirectory") {
    const entries = rawToolData.entries;
    const count = Array.isArray(entries) ? entries.length : 0;
    return `${artifactPath} directory ${count} entries`;
  }
  if (toolId === "searchFiles") {
    const hits = rawToolData.hits;
    const count = Array.isArray(hits) ? hits.length : 0;
    return `finance search ${count} hits`;
  }
  return `${artifactPath} finance artifact`;
}

function stripForbiddenKeys(
  data: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (FORBIDDEN_EVIDENCE_KEYS.has(key.toLowerCase())) {
      continue;
    }
    if (isFinanceDenyKey(key)) {
      continue;
    }
    out[key] = value;
  }
  return out;
}

export interface BuildFinanceEvidenceInput {
  readonly toolId: "listDirectory" | "readFile" | "searchFiles";
  readonly workspaceId: string;
  readonly repository: string;
  readonly artifactPath: string;
  readonly rawToolData: Readonly<Record<string, unknown>>;
}

export function buildFinanceEvidence(
  input: BuildFinanceEvidenceInput,
): FinanceEvidenceBuildResult {
  if (!input.workspaceId.trim()) {
    return {
      ok: false,
      code: "WORKSPACE_ID_ABSENT",
      message: "workspaceId ausente no ToolContext.",
    };
  }
  if (!input.repository.trim()) {
    return {
      ok: false,
      code: "REPOSITORY_ABSENT",
      message: "repository ausente no resultado da tool.",
    };
  }

  const pathCheck = validateFinanceArtifactPathForEvidence(
    input.artifactPath,
    input.toolId,
  );
  if (!pathCheck.ok) {
    return pathCheck;
  }
  const normalizedPath = String(pathCheck.data.artifactPath);

  let structured: Readonly<Record<string, unknown>> | undefined;
  let contentExcerpt: string | undefined;

  if (input.toolId === "readFile") {
    const rawContent =
      typeof input.rawToolData.content === "string"
        ? input.rawToolData.content
        : "";
    structured = parseFinanceFrontmatter(rawContent) ?? undefined;
    if (!structured) {
      const bodyMatch = /^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/u.exec(
        rawContent,
      );
      const body = bodyMatch?.[1]?.trim() ?? rawContent.trim();
      if (body) {
        const redacted = redactFinancePiiInText(body);
        contentExcerpt = redacted.slice(0, MAX_CONTENT_EXCERPT);
      }
    }
  }

  const summary = buildSummary(
    input.toolId,
    normalizedPath,
    structured,
    input.rawToolData,
  );

  const data: Record<string, unknown> = {
    domain: FINANCE_EVIDENCE_DOMAIN,
    workspaceId: input.workspaceId,
    repository: input.repository,
    artifactPath: normalizedPath,
    summary,
  };

  if (structured) {
    data.structured = structured;
  }
  if (contentExcerpt) {
    data.contentExcerpt = contentExcerpt;
  }

  if (input.toolId === "searchFiles") {
    data.query = input.rawToolData.query;
    data.hitCount = Array.isArray(input.rawToolData.hits)
      ? input.rawToolData.hits.length
      : 0;
  }

  const sanitized = stripForbiddenKeys(data);
  return validateSanitizedFinanceEvidence(sanitized);
}

export function validateSanitizedFinanceEvidence(
  sanitized: Readonly<Record<string, unknown>>,
): FinanceEvidenceBuildResult {
  if (scanObjectForResidualPii(sanitized)) {
    return {
      ok: false,
      code: EVIDENCE_PII_BLOCKED,
      message: "PII proibida detectada apos sanitizacao financeira.",
    };
  }

  for (const forbidden of FORBIDDEN_EVIDENCE_KEYS) {
    if (forbidden in sanitized) {
      return {
        ok: false,
        code: "FORBIDDEN_CONTENT_FIELD",
        message: `Campo proibido na evidence: ${forbidden}`,
      };
    }
  }

  return { ok: true, data: sanitized };
}

export function sanitizeFinanceEvidenceForResultJson(
  value: unknown,
): unknown {
  if (typeof value === "string") {
    const redacted = redactFinancePiiInText(value);
    if (containsResidualFinancePii(redacted)) {
      return REDACTED;
    }
    if (redacted.length > MAX_CONTENT_EXCERPT) {
      return `${redacted.slice(0, MAX_CONTENT_EXCERPT)}…`;
    }
    return redacted;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeFinanceEvidenceForResultJson(item));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_EVIDENCE_KEYS.has(key.toLowerCase())) {
        continue;
      }
      if (isFinanceDenyKey(key)) {
        out[key] = REDACTED;
        continue;
      }
      out[key] = sanitizeFinanceEvidenceForResultJson(child);
    }
    return out;
  }
  return value;
}
