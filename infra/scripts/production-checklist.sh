#!/usr/bin/env bash
# Checklist de producao — executa na VM apos deploy.
set -euo pipefail

API_LOCAL="${API_LOCAL:-http://127.0.0.1:3333}"
FAIL=0

ok() { echo "[OK] $*"; }
fail() { echo "[FAIL] $*"; FAIL=1; }
warn() { echo "[WARN] $*"; }

echo "=== Checklist producao OperaIA.lab ==="

# 1. Postgres
if command -v psql >/dev/null 2>&1 && [[ -n "${DATABASE_URL:-}" ]]; then
  if psql "$DATABASE_URL" -c 'SELECT 1' >/dev/null 2>&1; then
    ok "PostgreSQL conectavel"
  else
    fail "PostgreSQL inacessivel"
  fi
else
  warn "psql/DATABASE_URL ausente — pulei check Postgres direto"
fi

# 2. API local
if curl -fsS "$API_LOCAL/api/v1/health" >/tmp/operaia-health.json 2>/dev/null; then
  ok "API /health local"
else
  fail "API /health local"
fi

if curl -fsS "$API_LOCAL/api/v1/production-readiness" >/tmp/operaia-ready.json 2>/dev/null; then
  ok "API /production-readiness"
  if grep -q '"canStartWorkers":true' /tmp/operaia-ready.json; then
    ok "canStartWorkers=true"
  else
    fail "canStartWorkers != true"
  fi
else
  fail "API /production-readiness"
fi

# 3. Workers
if curl -fsS "$API_LOCAL/api/v1/workers" >/tmp/operaia-workers.json 2>/dev/null; then
  ALIVE=$(grep -o '"alive":[0-9]*' /tmp/operaia-workers.json | head -1 | cut -d: -f2 || echo 0)
  if [[ "${ALIVE:-0}" -ge 9 ]]; then
    ok "Workers alive=$ALIVE"
  else
    fail "Workers alive=$ALIVE (esperado 9)"
  fi
else
  fail "API /workers"
fi

# 4. systemd
if systemctl is-active operaia-lab-api >/dev/null 2>&1; then
  ok "systemd operaia-lab-api active"
else
  fail "systemd operaia-lab-api inactive"
fi

if systemctl is-enabled operaia-lab-api >/dev/null 2>&1; then
  ok "systemd operaia-lab-api enabled (boot)"
else
  fail "systemd operaia-lab-api nao enabled"
fi

if systemctl is-active caddy >/dev/null 2>&1; then
  ok "systemd caddy active"
else
  warn "caddy inactive (HTTPS pode estar offline)"
fi

# 5. Dominios publicos (opcional se DNS ainda nao propagou)
for host in api.operaia.com.br lab.operaia.com.br status.operaia.com.br operaia.com.br; do
  if curl -fsSI --max-time 10 "https://$host" >/dev/null 2>&1; then
    ok "HTTPS $host"
  else
    warn "HTTPS $host inacessivel (DNS/SSL/firewall?)"
  fi
done

echo "=== Fim checklist (exit=$FAIL) ==="
exit "$FAIL"
