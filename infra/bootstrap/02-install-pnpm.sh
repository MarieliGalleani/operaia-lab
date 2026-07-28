#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# 02-install-pnpm.sh
# Instala a versão de pnpm declarada no monorepo (packageManager).
# Preferência: Corepack (vem com Node). Fallback: npm -g.
# Idempotente. Requer Node.js já instalado (01-install-node.sh).
# -----------------------------------------------------------------------------
set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
# Alinhado a package.json → "packageManager": "pnpm@11.11.0"
PNPM_VERSION="${PNPM_VERSION:-11.11.0}"

log()  { printf '[%s] %s\n' "$SCRIPT_NAME" "$*"; }
ok()   { printf '[%s] OK  %s\n' "$SCRIPT_NAME" "$*"; }
warn() { printf '[%s] WARN %s\n' "$SCRIPT_NAME" "$*" >&2; }
die()  { printf '[%s] ERR %s\n' "$SCRIPT_NAME" "$*" >&2; exit 1; }

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "Execute como root (sudo)."
  fi
}

pnpm_matches() {
  if ! command -v pnpm >/dev/null 2>&1; then
    return 1
  fi
  local current
  current="$(pnpm -v 2>/dev/null || true)"
  [[ "$current" == "$PNPM_VERSION" ]]
}

install_via_corepack() {
  log "Ativando pnpm@${PNPM_VERSION} via Corepack…"
  if ! command -v corepack >/dev/null 2>&1; then
    warn "corepack ausente."
    return 1
  fi
  corepack enable || return 1
  corepack prepare "pnpm@${PNPM_VERSION}" --activate || return 1
  return 0
}

install_via_npm() {
  log "Fallback: npm install -g pnpm@${PNPM_VERSION}…"
  npm install -g "pnpm@${PNPM_VERSION}"
}

validate_pnpm() {
  command -v pnpm >/dev/null 2>&1 || die "pnpm não encontrado após instalação."
  local current
  current="$(pnpm -v)"
  log "pnpm=${current}"
  if [[ "$current" != "$PNPM_VERSION" ]]; then
    die "Esperado pnpm@${PNPM_VERSION}, obtido ${current}."
  fi
  ok "pnpm validado."
}

main() {
  require_root

  if ! command -v node >/dev/null 2>&1; then
    die "Node.js não instalado. Execute 01-install-node.sh antes."
  fi

  if pnpm_matches; then
    ok "pnpm@${PNPM_VERSION} já ativo. Nada a fazer."
    validate_pnpm
    exit 0
  fi

  if command -v pnpm >/dev/null 2>&1; then
    warn "pnpm $(pnpm -v) ≠ ${PNPM_VERSION}. Atualizando…"
  fi

  if ! install_via_corepack; then
    warn "Corepack falhou; tentando npm -g."
    install_via_npm
  fi

  # Garante binário no PATH para todos os usuários.
  hash -r 2>/dev/null || true
  validate_pnpm
  ok "Concluído."
}

main "$@"
