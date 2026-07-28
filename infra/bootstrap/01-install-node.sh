#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# 01-install-node.sh
# Instala Node.js LTS (major configurável) via NodeSource — Ubuntu 24.04 ARM64.
# Idempotente: não reinstala se a major já estiver presente.
# NÃO clona repo, NÃO cria .env, NÃO inicia a API.
# -----------------------------------------------------------------------------
set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
# Node 22 = Active LTS compatível com engines.node ">=20" do monorepo.
NODE_MAJOR="${NODE_MAJOR:-22}"

log()  { printf '[%s] %s\n' "$SCRIPT_NAME" "$*"; }
ok()   { printf '[%s] OK  %s\n' "$SCRIPT_NAME" "$*"; }
warn() { printf '[%s] WARN %s\n' "$SCRIPT_NAME" "$*" >&2; }
die()  { printf '[%s] ERR %s\n' "$SCRIPT_NAME" "$*" >&2; exit 1; }

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "Execute como root (sudo)."
  fi
}

node_major_installed() {
  if ! command -v node >/dev/null 2>&1; then
    return 1
  fi
  local ver major
  ver="$(node -v 2>/dev/null | sed 's/^v//')"
  major="${ver%%.*}"
  [[ "$major" == "$NODE_MAJOR" ]]
}

install_nodesource() {
  log "Instalando Node.js ${NODE_MAJOR}.x (NodeSource)…"
  export DEBIAN_FRONTEND=noninteractive

  if ! command -v curl >/dev/null 2>&1; then
    apt-get update -y
    apt-get install -y --no-install-recommends curl ca-certificates gnupg
  fi

  # Setup oficial NodeSource (amd64 + arm64).
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs

  command -v node >/dev/null 2>&1 || die "node não encontrado após instalação."
  command -v npm >/dev/null 2>&1 || die "npm não encontrado após instalação."
}

validate_node() {
  local ver arch
  ver="$(node -v)"
  arch="$(node -p "process.arch" 2>/dev/null || echo unknown)"
  log "node=${ver} arch=${arch} npm=$(npm -v)"

  local major
  major="$(node -v | sed 's/^v//' | cut -d. -f1)"
  if [[ "$major" -lt 20 ]]; then
    die "Node ${ver} incompatível com engines (>=20)."
  fi
  if [[ "$major" != "$NODE_MAJOR" ]]; then
    warn "Esperado major ${NODE_MAJOR}, encontrado ${major}."
  fi
  ok "Node.js validado."
}

main() {
  require_root

  if node_major_installed; then
    ok "Node.js ${NODE_MAJOR}.x já instalado ($(node -v)). Nada a fazer."
    validate_node
    exit 0
  fi

  if command -v node >/dev/null 2>&1; then
    warn "Node existente ($(node -v)) difere da major alvo ${NODE_MAJOR}. Prosseguindo com instalação NodeSource."
  fi

  install_nodesource
  validate_node
  ok "Concluído."
}

main "$@"
