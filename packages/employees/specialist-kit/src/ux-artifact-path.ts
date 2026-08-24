/**
 * Paths UX READ-ONLY — denylist de sensíveis (não allowlist estreita como Finance).
 * README/docs/código de UI permanecem acessíveis.
 */
import { normalizeRelativePath } from "@operaia/tool-runtime";

export const UX_MANDATORY_README = "README.md";
export const UX_OPTIONAL_ROOTS = ["docs", "apps", "packages"] as const;
export const UX_SEARCH_QUERIES = ["ux", "ui", "design"] as const;
export const UX_MAX_PATH_DEPTH = 8;

export type UxPathValidation =
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

export function isUxSensitivePath(input: string): boolean {
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

/** listDirectory: raiz "" ou roots UX; nunca paths sensíveis. */
export function validateUxListDirectoryPath(input: string): UxPathValidation {
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
  if (isUxSensitivePath(normalized)) {
    return {
      ok: false,
      code: "PATH_FORBIDDEN",
      message: `listDirectory bloqueado (path sensivel): ${input}`,
    };
  }
  if (depthOf(normalized) > UX_MAX_PATH_DEPTH) {
    return {
      ok: false,
      code: "PATH_TOO_DEEP",
      message: `Path excede profundidade maxima (${UX_MAX_PATH_DEPTH}): ${input}`,
    };
  }
  return { ok: true, normalized };
}

/** readFile: permite docs/UI; bloqueia secrets/.env/chaves. */
export function validateUxReadFilePath(input: string): UxPathValidation {
  const normalized = normalizeRelativePath(input);
  if (!normalized) {
    return {
      ok: false,
      code: "PATH_INVALID",
      message: `Path de readFile invalido: ${input}`,
    };
  }
  if (isUxSensitivePath(normalized)) {
    return {
      ok: false,
      code: "PATH_FORBIDDEN",
      message: `readFile bloqueado (path sensivel): ${input}`,
    };
  }
  if (depthOf(normalized) > UX_MAX_PATH_DEPTH) {
    return {
      ok: false,
      code: "PATH_TOO_DEEP",
      message: `Path excede profundidade maxima (${UX_MAX_PATH_DEPTH}): ${input}`,
    };
  }
  return { ok: true, normalized };
}

/** searchFiles pathPrefix: raiz ou root UX. */
export function validateUxSearchPrefix(
  input: string | undefined,
): UxPathValidation {
  if (input === undefined || input.trim() === "" || input.trim() === ".") {
    return { ok: true, normalized: "" };
  }
  return validateUxListDirectoryPath(input);
}
