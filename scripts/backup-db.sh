#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# backup-db.sh — dump PostgreSQL (FUTURO)
#
# NÃO executar nesta missão.
# Trava: OPERAIA_ALLOW_DEPLOY=1
# -----------------------------------------------------------------------------
set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
ROOT="${OPERAIA_ROOT:-/opt/operaia-lab}"
SHARED="${OPERAIA_SHARED:-$ROOT/shared}"
BACKUP_DIR="${BACKUP_DIR:-$SHARED/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

log()  { printf '[%s] %s\n' "$SCRIPT_NAME" "$*"; }
ok()   { printf '[%s] OK  %s\n' "$SCRIPT_NAME" "$*"; }
die()  { printf '[%s] ERR %s\n' "$SCRIPT_NAME" "$*" >&2; exit 1; }

require_gate() {
  if [[ "${OPERAIA_ALLOW_DEPLOY:-}" != "1" ]]; then
    die "Trava ativa. Defina OPERAIA_ALLOW_DEPLOY=1 para backups reais."
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
  require_gate
  command -v pg_dump >/dev/null 2>&1 || die "pg_dump não encontrado."
  load_database_url
  mkdir -p "$BACKUP_DIR"

  local out="${BACKUP_DIR}/operaia_lab_${STAMP}.sql.gz"
  log "Backup → $out"
  pg_dump "$DATABASE_URL" --no-owner --format=plain | gzip -c >"$out"
  chmod 600 "$out"

  find "$BACKUP_DIR" -type f -name 'operaia_lab_*.sql.gz' -mtime +"${RETENTION_DAYS}" -delete
  ok "Backup concluído: $out"
}

main "$@"
