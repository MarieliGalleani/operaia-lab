#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# restore-db.sh — restore PostgreSQL a partir de .sql.gz (FUTURO)
#
# NÃO executar nesta missão.
# Travas: OPERAIA_ALLOW_DEPLOY=1 e CONFIRM_RESTORE=yes
# Uso: restore-db.sh /opt/operaia-lab/shared/backups/operaia_lab_….sql.gz
# -----------------------------------------------------------------------------
set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
ROOT="${OPERAIA_ROOT:-/opt/operaia-lab}"
SHARED="${OPERAIA_SHARED:-$ROOT/shared}"

log()  { printf '[%s] %s\n' "$SCRIPT_NAME" "$*"; }
ok()   { printf '[%s] OK  %s\n' "$SCRIPT_NAME" "$*"; }
die()  { printf '[%s] ERR %s\n' "$SCRIPT_NAME" "$*" >&2; exit 1; }

require_gates() {
  if [[ "${OPERAIA_ALLOW_DEPLOY:-}" != "1" ]]; then
    die "Trava ativa. Defina OPERAIA_ALLOW_DEPLOY=1."
  fi
  if [[ "${CONFIRM_RESTORE:-}" != "yes" ]]; then
    die "Confirmação ausente. Exporte CONFIRM_RESTORE=yes para prosseguir."
  fi
}

load_database_url() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    return 0
  fi
  if [[ -f "${SHARED}/.env" ]]; then
    # shellcheck disable=SC1091
    set -a
    source "${SHARED}/.env"
    set +a
  fi
  [[ -n "${DATABASE_URL:-}" ]] || die "DATABASE_URL ausente."
}

main() {
  require_gates
  local file="${1:-}"
  [[ -n "$file" ]] || die "Uso: $SCRIPT_NAME <arquivo.sql.gz>"
  [[ -f "$file" ]] || die "Arquivo não encontrado: $file"

  command -v psql >/dev/null 2>&1 || die "psql não encontrado."
  load_database_url

  log "ATENÇÃO: restore irá aplicar SQL em DATABASE_URL."
  log "Arquivo: $file"

  if systemctl list-unit-files operaia-api.service >/dev/null 2>&1; then
    log "Parando operaia-api…"
    systemctl stop operaia-api || true
  fi

  gunzip -c "$file" | psql "$DATABASE_URL"
  ok "Restore aplicado."

  if systemctl list-unit-files operaia-api.service >/dev/null 2>&1; then
    systemctl start operaia-api || true
  fi
}

main "$@"
