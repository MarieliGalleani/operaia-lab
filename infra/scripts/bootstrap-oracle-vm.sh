#!/usr/bin/env bash
# Bootstrap inicial da Oracle Cloud VM (Ubuntu/Debian).
# Executar como root uma vez.
set -euo pipefail

REPO_URL="${REPO_URL:-}"
OPERAIA_USER="${OPERAIA_USER:-operaia}"
ROOT="/opt/operaia-lab"

echo "==> Pacotes base"
apt-get update
apt-get install -y curl ca-certificates gnupg ufw postgresql-client

echo "==> Node 20"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "==> pnpm"
corepack enable
corepack prepare pnpm@9 --activate || npm install -g pnpm@9

echo "==> Caddy"
if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi

echo "==> Usuario $OPERAIA_USER"
id "$OPERAIA_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$OPERAIA_USER"
mkdir -p "$ROOT" /var/log/caddy /var/backups/operaia-lab
chown -R "$OPERAIA_USER:$OPERAIA_USER" "$ROOT" /var/backups/operaia-lab
chown -R caddy:caddy /var/log/caddy || true

if [[ -n "$REPO_URL" && ! -d "$ROOT/.git" ]]; then
  echo "==> Clone $REPO_URL"
  sudo -u "$OPERAIA_USER" git clone "$REPO_URL" "$ROOT"
fi

echo "==> Caddyfile"
cp "$ROOT/infra/caddy/Caddyfile" /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile

echo "==> systemd units"
cp "$ROOT/infra/systemd/operaia-lab-api.service" /etc/systemd/system/
cp "$ROOT/infra/systemd/operaia-backup.service" /etc/systemd/system/
cp "$ROOT/infra/systemd/operaia-backup.timer" /etc/systemd/system/
systemctl daemon-reload

echo "==> Firewall"
ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw --force enable || true

echo "==> Bootstrap concluido."
echo "Proximos passos:"
echo "  1. Criar $ROOT/.env a partir de infra/production/env.production.example"
echo "  2. Garantir PostgreSQL (local ou gerenciado) e DATABASE_URL"
echo "  3. DNS A/AAAA dos subdominios → IP da VM"
echo "  4. sudo -u $OPERAIA_USER bash $ROOT/infra/scripts/deploy-production.sh"
echo "  5. systemctl enable --now operaia-lab-api caddy operaia-backup.timer"
echo "  6. bash $ROOT/infra/scripts/production-checklist.sh"
