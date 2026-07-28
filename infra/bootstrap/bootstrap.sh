#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# bootstrap.sh — orquestrador do bootstrap de infraestrutura (Oracle Cloud VM)
#
# Objetivo desta missão: PREPARAR a VM (Node, pnpm, PostgreSQL, dirs, user,
# runtime). NÃO publica a aplicação.
#
# Explicitamente NÃO faz:
#   - clone do monorepo
#   - criação de .env
#   - build / migrations / start da API
#   - alteração de Caddy existente
#   - alteração de DNS
#
# Uso (na VM, como root):
#   sudo bash infra/bootstrap/bootstrap.sh
#
# Ou, a partir deste diretório:
#   sudo bash ./bootstrap.sh
# -----------------------------------------------------------------------------
set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log()  { printf '[%s] %s\n' "$SCRIPT_NAME" "$*"; }
ok()   { printf '[%s] OK  %s\n' "$SCRIPT_NAME" "$*"; }
die()  { printf '[%s] ERR %s\n' "$SCRIPT_NAME" "$*" >&2; exit 1; }

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "Execute como root: sudo bash ${SCRIPT_DIR}/bootstrap.sh"
  fi
}

run_step() {
  local script="$1"
  local path="${SCRIPT_DIR}/${script}"
  [[ -f "$path" ]] || die "Script ausente: ${path}"
  # Garante executável sem depender de git filemode no Windows checkout.
  chmod +x "$path" || true
  log "======== STEP: ${script} ========"
  # shellcheck disable=SC1090
  bash "$path"
  ok "STEP OK: ${script}"
}

main() {
  require_root

  log "OperaIA.lab — bootstrap de infraestrutura (idempotente)"
  log "Host: $(hostname) | arch: $(uname -m) | date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  log "NÃO altera Caddy/DNS; NÃO clona repo; NÃO cria .env; NÃO sobe API."

  # Ordem por dependência (não pela numeração pura):
  #   user → dirs → node → pnpm → postgres → runtime
  run_step "05-create-production-user.sh"
  run_step "04-create-directories.sh"
  run_step "01-install-node.sh"
  run_step "02-install-pnpm.sh"
  run_step "03-install-postgresql.sh"
  run_step "06-prepare-runtime.sh"

  echo
  ok "Bootstrap de infraestrutura concluído."
  echo
  cat <<'EOF'
Próximos passos (OUTRA missão — não executar agora):
  1. Clone do monorepo em /opt/operaia-lab (ou releases/)
  2. Criar .env de produção em shared/ (ou path definido no deploy)
  3. Criar role/banco PostgreSQL da aplicação
  4. pnpm install + build + migrations
  5. Unit systemd operaia-lab-api + enable
  6. Integração Caddy (sem quebrar n8n) + DNS dos subdomínios
  7. Checklist de go-live / workers 24/7

Validação rápida deste bootstrap:
  id operaia
  node -v && pnpm -v
  systemctl is-active postgresql
  ls -la /opt/operaia-lab /opt/operaia-lab/runtime
  # Caddy e n8n devem permanecer intactos:
  systemctl is-active caddy
EOF
}

main "$@"
