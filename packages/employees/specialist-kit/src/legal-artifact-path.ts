/**
 * Paths Legal READ-ONLY — denylist de sensíveis + roots jurídicos.
 * README/docs/legal/compliance/contracts/policies/terms acessíveis; secrets bloqueados.
 * Sem hardcode de workspace/repository/branch.
 */
import { normalizeRelativePath } from "@operaia/tool-runtime";

export const LEGAL_MANDATORY_README = "README.md";
export const LEGAL_OPTIONAL_ROOTS = [
  "legal",
  "compliance",
  "contracts",
  "policies",
  "terms",
  "docs",
] as const;
export const LEGAL_SEARCH_QUERIES = [
  "lgpd",
  "compliance",
  "privacy",
] as const;
export const LEGAL_MAX_PATH_DEPTH = 8;

export type LegalPathValidation =
  | { readonly ok: true; readonly normalized: string }
  | {
      readonly ok: false;
      readonly code: "PATH_INVALID" | "PATH_FORBIDDEN" | "PATH_TOO_DEEP";
      readonly message: string;
    };

const SENSITIVE_BASENAME_RE =
  /^(\.env($|\.)|.*\.(pem|key|p12|pfx|jks)$|id_rsa.*|id_ed25519.*|credentials\.json|service-account\.json)$/i;

const SENSITIVE_FRAGMENT_RE =
  /(^|\/)(\.git|secrets?|credentials?)(\/|$)|(^|\/|-)(secret|token|password|private.?key)(-|$|\.)/i;

export function isLegalSensitivePath(input: string): boolean {
  const normalized = normalizeRelativePath(input);
  if (!normalized) {
    return true;
  }
  const base = normalized.split("/").pop() ?? normalized;
  if (SENSITIVE_BASENAME_RE.test(base)) {
    return true;
  }
  if (SENSITIVE_FRAGMENT_RE.test(normalized)) {
    return true;
  }
  return false;
}

function depthOf(normalized: string): number {
  return normalized.split("/").filter(Boolean).length;
}

/** listDirectory: raiz "" ou roots legal; nunca paths sensíveis. */
export function validateLegalListDirectoryPath(
  input: string,
): LegalPathValidation {
  const raw = input.trim();
  if (raw === "" || raw === ".") {
    return { ok: true, normalized: "" };
  }
  const normalized = normalizeRelativePath(raw);
  if (!normalized) {
    return {
      ok: false,
      code: "PATH_INVALID",
      message: `Path de listDirectory invalido: ${input}`,
    };
  }
  if (isLegalSensitivePath(normalized)) {
    return {
      ok: false,
      code: "PATH_FORBIDDEN",
      message: `listDirectory bloqueado (path sensivel): ${input}`,
    };
  }
  if (depthOf(normalized) > LEGAL_MAX_PATH_DEPTH) {
    return {
      ok: false,
      code: "PATH_TOO_DEEP",
      message: `Path excede profundidade maxima (${LEGAL_MAX_PATH_DEPTH}): ${input}`,
    };
  }
  return { ok: true, normalized };
}

/** readFile: permite docs/legal; bloqueia secrets/.env/chaves. */
export function validateLegalReadFilePath(input: string): LegalPathValidation {
  const normalized = normalizeRelativePath(input);
  if (!normalized) {
    return {
      ok: false,
      code: "PATH_INVALID",
      message: `Path de readFile invalido: ${input}`,
    };
  }
  if (isLegalSensitivePath(normalized)) {
    return {
      ok: false,
      code: "PATH_FORBIDDEN",
      message: `readFile bloqueado (path sensivel): ${input}`,
    };
  }
  if (depthOf(normalized) > LEGAL_MAX_PATH_DEPTH) {
    return {
      ok: false,
      code: "PATH_TOO_DEEP",
      message: `Path excede profundidade maxima (${LEGAL_MAX_PATH_DEPTH}): ${input}`,
    };
  }
  return { ok: true, normalized };
}

/** searchFiles pathPrefix: raiz ou root legal. */
export function validateLegalSearchPrefix(
  input: string | undefined,
): LegalPathValidation {
  if (input === undefined || input.trim() === "" || input.trim() === ".") {
    return { ok: true, normalized: "" };
  }
  return validateLegalListDirectoryPath(input);
}
