#!/usr/bin/env bash
# Deploy de producao na Oracle Cloud VM.
# Uso (na VM): sudo -u operaia bash infra/scripts/deploy-production.sh
set -euo pipefail

ROOT="${OPERAIA_ROOT:-/opt/operaia-lab}"
cd "$ROOT"

echo "==> OperaIA.lab deploy ($(date -u +%Y-%m-%dT%H:%M:%SZ))"

if [[ ! -f "$ROOT/.env" ]]; then
  echo "ERRO: $ROOT/.env nao encontrado. Copie infra/production/env.production.example" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
source "$ROOT/.env"
set +a

echo "==> pnpm install"
pnpm install --frozen-lockfile

echo "==> Prisma generate + migrate"
pnpm db:generate
pnpm --filter @operaia/database exec prisma migrate deploy

echo "==> Build web (lab.operaia.com.br)"
export VITE_API_URL="${VITE_API_URL:-https://api.operaia.com.br/api/v1}"
pnpm --filter @operaia/web build

echo "==> Restart API (systemd)"
if systemctl is-enabled operaia-lab-api >/dev/null 2>&1; then
  sudo systemctl restart operaia-lab-api
  sudo systemctl --no-pager --full status operaia-lab-api || true
else
  echo "AVISO: operaia-lab-api nao esta enabled — inicie manualmente."
fi

if command -v caddy >/dev/null 2>&1; then
  echo "==> Reload Caddy"
  if [[ -f /etc/caddy/Caddyfile ]]; then
    sudo caddy validate --config /etc/caddy/Caddyfile
    sudo systemctl reload caddy || sudo caddy reload --config /etc/caddy/Caddyfile
  fi
fi

echo "==> Health local"
sleep 3
curl -fsS "http://127.0.0.1:${API_PORT:-3333}/api/v1/production-readiness" | head -c 400 || true
echo
echo "==> Deploy concluido."
