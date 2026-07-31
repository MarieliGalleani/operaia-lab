/**
 * Whitelist de caminhos legiveis pelo LocalInfrastructureAdapter.
 * Qualquer path fora → PATH_FORBIDDEN.
 */

const DOCKERFILE_RE = /^Dockerfile(?:\..+)?$/;
const COMPOSE_RE = /^docker-compose(?:\..+)?\.(?:yml|yaml)$/;
const CADDY_RE = /^Caddyfile(?:\..+)?$/;
const ALLOWED_ROOT_DIRS = new Set(["infra", "config", "systemd"]);

/**
 * Normaliza path relativo (posix) e rejeita escape (`..`).
 * Retorna null se invalido.
 */
export function normalizeRelativePath(input: string): string | null {
  const trimmed = input.trim().replace(/\\/g, "/");
  if (!trimmed || trimmed.startsWith("/")) {
    return null;
  }
  const parts: string[] = [];
  for (const part of trimmed.split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      return null;
    }
    parts.push(part);
  }
  return parts.join("/");
}

export function basenameOf(relativePath: string): string {
  const idx = relativePath.lastIndexOf("/");
  return idx >= 0 ? relativePath.slice(idx + 1) : relativePath;
}

/**
 * Verifica se o path relativo (ja normalizado) esta na whitelist.
 */
export function isWhitelistedRelativePath(relativePath: string): boolean {
  const base = basenameOf(relativePath);
  const root = relativePath.split("/")[0] ?? "";

  if (DOCKERFILE_RE.test(base)) {
    return true;
  }
  if (COMPOSE_RE.test(base)) {
    return true;
  }
  if (CADDY_RE.test(base)) {
    return true;
  }
  if (
    relativePath === ".github/workflows" ||
    relativePath.startsWith(".github/workflows/")
  ) {
    return true;
  }
  if (base.endsWith(".log")) {
    return true;
  }
  if (ALLOWED_ROOT_DIRS.has(root)) {
    return true;
  }
  return false;
}

export function isDockerComposeName(name: string): boolean {
  return COMPOSE_RE.test(name);
}

export function isDockerfileName(name: string): boolean {
  return DOCKERFILE_RE.test(name);
}

export function isCaddyfileName(name: string): boolean {
  return CADDY_RE.test(name);
}

export function isWorkflowRelativePath(relativePath: string): boolean {
  return (
    relativePath === ".github/workflows" ||
    relativePath.startsWith(".github/workflows/")
  );
}

/** Diretorios sob os quais o inventory pode descer. */
export function isAllowedWalkDir(relativeDir: string): boolean {
  if (!relativeDir) {
    return true;
  }
  if (
    relativeDir === ".github" ||
    relativeDir.startsWith(".github/") ||
    isWorkflowRelativePath(relativeDir)
  ) {
    return true;
  }
  const root = relativeDir.split("/")[0] ?? "";
  return ALLOWED_ROOT_DIRS.has(root);
}
