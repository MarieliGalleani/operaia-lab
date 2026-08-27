#!/usr/bin/env bash
# Backup diario do PostgreSQL (OperaIA.lab).
# Autentica via PGPASSWORD + parâmetros separados — evita falha do pg_dump
# ao interpretar '%' literal na senha dentro de DATABASE_URL (URI).
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/operaia-lab}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL ausente" >&2
  exit 1
fi

# Extrai user/password/host/port/db sem percent-decode da senha.
# Formato: postgresql://USER:PASSWORD@HOST:PORT/DB?...
# (senha pode conter '%' e outros caracteres, exceto '@' não escapado)
eval "$(
  DATABASE_URL="$DATABASE_URL" python3 - <<'PY'
import os
import re
import shlex
import sys

url = os.environ.get("DATABASE_URL", "")
m = re.match(
    r"^postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/([^?\s]+)",
    url,
)
if not m:
    print("DATABASE_URL em formato nao suportado para backup", file=sys.stderr)
    sys.exit(2)

user, password, host, port, database = m.groups()
port = port or "5432"
database = database.rstrip("/")
print(f"export PGUSER={shlex.quote(user)}")
print(f"export PGPASSWORD={shlex.quote(password)}")
print(f"export PGHOST={shlex.quote(host)}")
print(f"export PGPORT={shlex.quote(port)}")
print(f"export PGDATABASE={shlex.quote(database)}")
PY
)" || {
  echo "Falha ao interpretar DATABASE_URL para backup" >&2
  exit 1
}

OUT="$BACKUP_DIR/operaia_lab_${STAMP}.sql.gz"
echo "Backup → $OUT (host=${PGHOST} port=${PGPORT} db=${PGDATABASE} user=${PGUSER})"

# Requer cliente postgres na VM. Senha via PGPASSWORD (nao via URI).
pg_dump \
  --no-owner \
  --format=plain \
  -h "$PGHOST" \
  -p "$PGPORT" \
  -U "$PGUSER" \
  -d "$PGDATABASE" \
  | gzip -c >"$OUT"

chmod 600 "$OUT"
unset PGPASSWORD

find "$BACKUP_DIR" -type f -name 'operaia_lab_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
echo "Backup concluido."
