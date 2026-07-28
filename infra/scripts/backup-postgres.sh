#!/usr/bin/env bash
# Backup diario do PostgreSQL (OperaIA.lab).
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/operaia-lab}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL ausente" >&2
  exit 1
fi

OUT="$BACKUP_DIR/operaia_lab_${STAMP}.sql.gz"
echo "Backup → $OUT"

# pg_dump via URL (requer cliente postgres na VM)
pg_dump "$DATABASE_URL" --no-owner --format=plain | gzip -c > "$OUT"
chmod 600 "$OUT"

find "$BACKUP_DIR" -type f -name 'operaia_lab_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
echo "Backup concluido."
