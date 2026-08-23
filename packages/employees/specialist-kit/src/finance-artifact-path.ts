import { normalizeRelativePath } from "@operaia/tool-runtime";

export const FINANCE_ARTIFACT_ROOTS = ["finance", "billing"] as const;
export const FINANCE_MANDATORY_OVERVIEW = "finance/overview.md";
export const FINANCE_OPTIONAL_FILES = [
  "finance/budget.md",
  "finance/costs.md",
  "billing/summary.md",
] as const;
export const FINANCE_SEARCH_QUERIES = ["overview", "budget", "costs"] as const;
export const FINANCE_MAX_DEPTH_BELOW_ROOT = 4;

export type FinancePathValidation =
  | { readonly ok: true; readonly normalized: string }
  | {
      readonly ok: false;
      readonly code: "PATH_INVALID" | "PATH_FORBIDDEN" | "PATH_TOO_DEEP";
      readonly message: string;
    };

function rootOf(normalized: string): string {
  return normalized.split("/")[0] ?? "";
}

function segmentsBelowRoot(normalized: string): readonly string[] {
  const parts = normalized.split("/");
  return parts.slice(1);
}

function isAllowedRoot(root: string): boolean {
  return (FINANCE_ARTIFACT_ROOTS as readonly string[]).includes(root);
}

function depthWithinLimit(normalized: string): boolean {
  return segmentsBelowRoot(normalized).length <= FINANCE_MAX_DEPTH_BELOW_ROOT;
}

/** listDirectory: somente `finance` ou `billing`. */
export function validateFinanceListDirectoryPath(
  input: string,
): FinancePathValidation {
  const normalized = normalizeRelativePath(input);
  if (!normalized) {
    return {
      ok: false,
      code: "PATH_INVALID",
      message: `Path de listDirectory invalido: ${input}`,
    };
  }
  if (!isAllowedRoot(normalized) || normalized.includes("/")) {
    return {
      ok: false,
      code: "PATH_FORBIDDEN",
      message: `listDirectory fora do boundary financeiro: ${input}`,
    };
  }
  return { ok: true, normalized };
}

/** readFile: somente sob finance/ ou billing/, profundidade limitada. */
export function validateFinanceReadFilePath(input: string): FinancePathValidation {
  const normalized = normalizeRelativePath(input);
  if (!normalized) {
    return {
      ok: false,
      code: "PATH_INVALID",
      message: `Path de readFile invalido: ${input}`,
    };
  }
  const root = rootOf(normalized);
  if (!isAllowedRoot(root)) {
    return {
      ok: false,
      code: "PATH_FORBIDDEN",
      message: `readFile fora do boundary financeiro: ${input}`,
    };
  }
  if (segmentsBelowRoot(normalized).length === 0) {
    return {
      ok: false,
      code: "PATH_INVALID",
      message: `readFile exige arquivo, nao diretorio: ${input}`,
    };
  }
  if (!depthWithinLimit(normalized)) {
    return {
      ok: false,
      code: "PATH_TOO_DEEP",
      message: `Path excede profundidade maxima (${FINANCE_MAX_DEPTH_BELOW_ROOT}): ${input}`,
    };
  }
  return { ok: true, normalized };
}

/** searchFiles: pathPrefix obrigatorio sob finance/ ou billing/. */
export function validateFinanceSearchPrefix(
  input: string | undefined,
): FinancePathValidation {
  if (!input?.trim()) {
    return {
      ok: false,
      code: "PATH_FORBIDDEN",
      message: "searchFiles exige pathPrefix financeiro allowlisted",
    };
  }
  const trimmed = input.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  const normalized = normalizeRelativePath(trimmed);
  if (!normalized) {
    return {
      ok: false,
      code: "PATH_INVALID",
      message: `pathPrefix invalido: ${input}`,
    };
  }
  const root = rootOf(normalized);
  if (!isAllowedRoot(root)) {
    return {
      ok: false,
      code: "PATH_FORBIDDEN",
      message: `pathPrefix fora do boundary financeiro: ${input}`,
    };
  }
  const prefix = `${normalized}/`;
  return { ok: true, normalized: prefix };
}

export function validateFinanceSearchQuery(query: string): FinancePathValidation {
  const q = query.trim().toLowerCase();
  if (!(FINANCE_SEARCH_QUERIES as readonly string[]).includes(q)) {
    return {
      ok: false,
      code: "PATH_FORBIDDEN",
      message: `query financeira nao allowlisted: ${query}`,
    };
  }
  return { ok: true, normalized: q };
}

/** Bloqueia paths conhecidos invalidos antes da normalizacao (tests + defesa). */
export function isBlockedFinancePathInput(input: string): boolean {
  const raw = input.trim();
  if (!raw || raw.startsWith("/")) {
    return true;
  }
  if (raw.includes("..")) {
    return true;
  }
  const lower = raw.toLowerCase();
  if (
    lower === "readme.md" ||
    lower.startsWith("docs/") ||
    lower.startsWith("packages/") ||
    lower.startsWith("apps/") ||
    lower.startsWith(".env") ||
    lower.startsWith(".github/")
  ) {
    return true;
  }
  return false;
}
