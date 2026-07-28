#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# 04-create-directories.sh
# Cria a árvore de produção em /opt/operaia-lab (layout releases/shared).
# Idempotente (mkdir -p). Não clona código e não cria .env.
# -----------------------------------------------------------------------------
set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
ROOT="${OPERAIA_ROOT:-/opt/operaia-lab}"
OPERAIA_USER="${OPERAIA_USER:-operaia}"
OPERAIA_GROUP="${OPERAIA_GROUP:-$OPERAIA_USER}"

DIRS=(
  "$ROOT"
  "$ROOT/releases"
  "$ROOT/shared"
  "$ROOT/logs"
  "$ROOT/backups"
  "$ROOT/runtime"
)

log()  { printf '[%s] %s\n' "$SCRIPT_NAME" "$*"; }
ok()   { printf '[%s] OK  %s\n' "$SCRIPT_NAME" "$*"; }
warn() { printf '[%s] WARN %s\n' "$SCRIPT_NAME" "$*" >&2; }
die()  { printf '[%s] ERR %s\n' "$SCRIPT_NAME" "$*" >&2; exit 1; }

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "Execute como root (sudo)."
  fi
}

create_dirs() {
  local d
  for d in "${DIRS[@]}"; do
    if [[ -e "$d" && ! -d "$d" ]]; then
      die "Caminho existe e não é diretório: $d"
    fi
    mkdir -p "$d"
    log "dir: $d"
  done
}

apply_ownership() {
  if id "$OPERAIA_USER" >/dev/null 2>&1; then
    chown -R "${OPERAIA_USER}:${OPERAIA_GROUP}" "$ROOT"
    ok "Ownership ${OPERAIA_USER}:${OPERAIA_GROUP} em ${ROOT}"
  else
    warn "Usuário ${OPERAIA_USER} ainda não existe. Execute 05-create-production-user.sh e reexecute este script (ou bootstrap.sh)."
  fi
}

apply_permissions() {
  # Root do app: 755; backups/logs um pouco mais restritos.
  chmod 755 "$ROOT" "$ROOT/releases" "$ROOT/shared" "$ROOT/runtime"
  chmod 750 "$ROOT/logs" "$ROOT/backups"
}

validate_dirs() {
  local d
  for d in "${DIRS[@]}"; do
    [[ -d "$d" ]] || die "Diretório ausente: $d"
  done
  ok "Árvore de produção validada em ${ROOT}"
}

main() {
  require_root
  create_dirs
  apply_ownership
  apply_permissions
  validate_dirs
  ok "Concluído."
}

main "$@"
