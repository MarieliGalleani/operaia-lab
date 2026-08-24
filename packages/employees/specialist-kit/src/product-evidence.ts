/**
 * Evidence Product READ-ONLY — proveniencia + sanitizacao (sem fullContent).
 */
import {
  isProductSensitivePath,
  validateProductListDirectoryPath,
  validateProductReadFilePath,
} from "./product-artifact-path.js";

export const PRODUCT_EVIDENCE_DOMAIN = "product_artifacts";
export const PRODUCT_EVIDENCE_PII_BLOCKED = "PRODUCT_EVIDENCE_PII_BLOCKED";

const FORBIDDEN_CONTENT_KEYS = new Set([
  "content",
  "body",
  "rawcontent",
  "fullcontent",
]);

const DENY_KEY_FRAGMENTS = [
  "password",
  "secret",
  "token",
  "api_key",
  "apikey",
  "client_secret",
  "authorization",
  "private_key",
  "privatekey",
] as const;

const CPF_RE = /\d{3}\.\d{3}\.\d{3}-\d{2}/g;
const CNPJ_RE = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g;
const CARD_RE = /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g;
const BEARER_RE = /bearer\s+[a-z0-9._\-]+/gi;
const REDACTED = "[REDACTED]";

export type ProductEvidenceBuildResult =
  | { readonly ok: true; readonly data: Readonly<Record<string, unknown>> }
  | { readonly ok: false; readonly code: string; readonly message: string };

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isProductDenyKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return DENY_KEY_FRAGMENTS.some((fragment) =>
    normalized.includes(fragment.replace(/[^a-z0-9]/g, "")),
  );
}

export function redactProductSensitiveText(text: string): string {
  return text
    .replace(CPF_RE, REDACTED)
    .replace(CNPJ_RE, REDACTED)
    .replace(CARD_RE, REDACTED)
    .replace(BEARER_RE, `Bearer ${REDACTED}`);
}

export function containsResidualProductSecrets(text: string): boolean {
  const lower = text.toLowerCase();
  if (/\d{3}\.\d{3}\.\d{3}-\d{2}/.test(text)) {
    return true;
  }
  if (/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/.test(text)) {
    return true;
  }
  if (/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/.test(text)) {
    return true;
  }
  if (/bearer\s+[a-z0-9._\-]{8,}/i.test(text)) {
    return true;
  }
  if (
    lower.includes("begin private key") ||
    lower.includes("aws_secret") ||
    lower.includes("api_key=")
  ) {
    return true;
  }
  return false;
}

function stripForbiddenKeys(value: unknown): unknown {
  if (typeof value === "string") {
    return redactProductSensitiveText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripForbiddenKeys(item));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (FORBIDDEN_CONTENT_KEYS.has(key.toLowerCase())) {
        continue;
      }
      if (isProductDenyKey(key)) {
        out[key] = REDACTED;
        continue;
      }
      out[key] = stripForbiddenKeys(child);
    }
    return out;
  }
  return value;
}

export function sanitizeProductEvidenceForResultJson(
  data: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return stripForbiddenKeys(data) as Readonly<Record<string, unknown>>;
}

function scanForUnsafe(value: unknown): boolean {
  if (typeof value === "string") {
    return containsResidualProductSecrets(value);
  }
  if (Array.isArray(value)) {
    return value.some((item) => scanForUnsafe(item));
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (FORBIDDEN_CONTENT_KEYS.has(key.toLowerCase())) {
        return true;
      }
      if (isProductDenyKey(key) && child !== REDACTED) {
        return true;
      }
      if (scanForUnsafe(child)) {
        return true;
      }
    }
  }
  return false;
}

export function validateSanitizedProductEvidence(
  data: Readonly<Record<string, unknown>>,
): ProductEvidenceBuildResult {
  if (typeof data.workspaceId !== "string" || !data.workspaceId.trim()) {
    return {
      ok: false,
      code: "WORKSPACE_REQUIRED",
      message: "Evidence Product exige workspaceId.",
    };
  }
  if (data.domain !== PRODUCT_EVIDENCE_DOMAIN) {
    return {
      ok: false,
      code: "DOMAIN_INVALID",
      message: "Evidence Product exige domain=product_artifacts.",
    };
  }
  if (typeof data.artifactPath !== "string") {
    return {
      ok: false,
      code: "ARTIFACT_REQUIRED",
      message: "Evidence Product exige artifactPath.",
    };
  }
  if (
    data.artifactPath !== "repository" &&
    data.artifactPath !== "" &&
    isProductSensitivePath(String(data.artifactPath))
  ) {
    return {
      ok: false,
      code: "PATH_FORBIDDEN",
      message: `artifactPath sensivel: ${String(data.artifactPath)}`,
    };
  }
  if (scanForUnsafe(data)) {
    return {
      ok: false,
      code: PRODUCT_EVIDENCE_PII_BLOCKED,
      message: "Evidence Product contem secrets/PII ou fullContent.",
    };
  }
  return { ok: true, data };
}

export function buildProductEvidence(input: {
  readonly toolId: string;
  readonly workspaceId: string;
  readonly repository?: string;
  readonly operationalRef?: string;
  readonly branchRef?: string;
  readonly artifactPath: string;
  readonly analysisType?: string;
  readonly rawToolData: Readonly<Record<string, unknown>>;
}): ProductEvidenceBuildResult {
  const workspaceId = input.workspaceId.trim();
  if (!workspaceId) {
    return {
      ok: false,
      code: "WORKSPACE_REQUIRED",
      message: "workspaceId ausente no ToolContext.",
    };
  }

  if (input.toolId === "readFile") {
    const pathCheck = validateProductReadFilePath(input.artifactPath);
    if (!pathCheck.ok) {
      return { ok: false, code: pathCheck.code, message: pathCheck.message };
    }
  }
  if (input.toolId === "listDirectory") {
    const pathCheck = validateProductListDirectoryPath(input.artifactPath);
    if (!pathCheck.ok) {
      return { ok: false, code: pathCheck.code, message: pathCheck.message };
    }
  }

  const repository =
    input.repository?.trim() ||
    (typeof input.rawToolData.repository === "string"
      ? input.rawToolData.repository
      : "");
  const branchRef =
    input.branchRef?.trim() ||
    (typeof input.rawToolData.defaultBranch === "string"
      ? input.rawToolData.defaultBranch
      : typeof input.rawToolData.branchRef === "string"
        ? input.rawToolData.branchRef
        : "");
  const operationalRef = input.operationalRef?.trim() || "";

  let summary = `${input.toolId} ok`;
  const structured: Record<string, unknown> = {};

  if (input.toolId === "listDirectory") {
    const entries = input.rawToolData.entries;
    const count = Array.isArray(entries)
      ? entries.length
      : input.rawToolData.entryCount;
    summary = `Dir path=${input.artifactPath || "/"} entries=${String(count ?? "n/a")}`;
    structured.entryCount = count ?? null;
    if (Array.isArray(entries)) {
      structured.entryNames = entries
        .slice(0, 20)
        .map((item) =>
          item && typeof item === "object" && "name" in item
            ? String((item as { name: unknown }).name)
            : String(item),
        )
        .filter((name) => !isProductSensitivePath(name));
    }
  } else if (input.toolId === "readFile") {
    const content =
      typeof input.rawToolData.content === "string"
        ? input.rawToolData.content
        : "";
    summary = `File ${input.artifactPath} bytes=${content.length}`;
    structured.byteLength = content.length;
    structured.hasHeading = /^#\s+/m.test(content);
    structured.hasProductSignal =
      /\b(roadmap|backlog|epic|priorit|product|outcome)\b/i.test(content);
  } else if (input.toolId === "searchFiles") {
    const matches = input.rawToolData.matches ?? input.rawToolData.files;
    const n = Array.isArray(matches) ? matches.length : "n/a";
    summary = `search hits=${String(n)}`;
    structured.hitCount = n;
  }

  const data: Record<string, unknown> = {
    domain: PRODUCT_EVIDENCE_DOMAIN,
    workspaceId,
    artifactPath: input.artifactPath,
    analysisType: input.analysisType ?? "product_surface",
    summary: redactProductSensitiveText(summary),
    structured: stripForbiddenKeys(structured),
  };
  if (repository) {
    data.repository = repository;
  }
  if (branchRef) {
    data.branchRef = branchRef;
  }
  if (operationalRef) {
    data.operationalRef = operationalRef;
  }

  const sanitized = sanitizeProductEvidenceForResultJson(data);
  return validateSanitizedProductEvidence(sanitized);
}
