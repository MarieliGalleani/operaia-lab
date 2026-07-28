#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# deploy.sh — deploy de release para /opt/operaia-lab (FUTURO)
#
# NÃO executar nesta missão de App Provisioning.
# Trava: exige OPERAIA_ALLOW_DEPLOY=1
#
# Fluxo:
#   releases/<id> → build → switch atômico de current → restart API
# -----------------------------------------------------------------------------
set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
ROOT="${OPERAIA_ROOT:-/opt/operaia-lab}"
CURRENT="${OPERAIA_CURRENT:-$ROOT/current}"
RELEASES="${ROOT}/releases"
SHARED="${OPERAIA_SHARED:-$ROOT/shared}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"

log()  { printf '[%s] %s\n' "$SCRIPT_NAME" "$*"; }
ok()   { printf '[%s] OK  %s\n' "$SCRIPT_NAME" "$*"; }
die()  { printf '[%s] ERR %s\n' "$SCRIPT_NAME" "$*" >&2; exit 1; }

require_gate() {
  if [[ "${OPERAIA_ALLOW_DEPLOY:-}" != "1" ]]; then
    die "Trava ativa. Defina OPERAIA_ALLOW_DEPLOY=1 somente na missão Deploy (não agora)."
  fi
}

require_root_or_operaia() {
  if [[ "${EUID}" -ne 0 ]] && [[ "$(id -un)" != "operaia" ]]; then
    die "Execute como root ou usuário operaia."
  fi
}

validate_preflight() {
  [[ -d "$ROOT" ]] || die "ROOT ausente: $ROOT"
  [[ -d "$RELEASES" ]] || die "releases/ ausente: $RELEASES"
  [[ -d "$SHARED" ]] || die "shared/ ausente: $SHARED"
  [[ -f "$SHARED/.env" ]] || die "shared/.env ausente — crie antes do deploy."
  command -v pnpm >/dev/null 2>&1 || die "pnpm não encontrado."
  command -v node >/dev/null 2>&1 || die "node não encontrado."
}

create_release_dir() {
  local id
  id="${RELEASE_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"
  local dest="${RELEASES}/${id}"
  if [[ -e "$dest" ]]; then
    die "Release já existe: $dest"
  fi
  mkdir -p "$dest"
  echo "$dest"
}

# Placeholder: na missão Deploy, preencher clone/rsync/artifact.
populate_release() {
  local dest="$1"
  if [[ -z "${DEPLOY_SOURCE:-}" ]]; then
    die "Defina DEPLOY_SOURCE (path do monorepo ou artifact) na missão Deploy."
  fi
  log "Sincronizando ${DEPLOY_SOURCE} → ${dest}"
  rsync -a --delete \
    --exclude .git \
    --exclude node_modules \
    --exclude .env \
    "${DEPLOY_SOURCE}/" "${dest}/"
}

build_release() {
  local dest="$1"
  log "Install + build em ${dest}"
  (
    cd "$dest"
    # shellcheck disable=SC1091
    set -a
    # carrega env sem imprimir
    source "${SHARED}/.env"
    set +a
    pnpm install --frozen-lockfile
    pnpm --filter @operaia/database generate
    # migrate fica explícito e opcional
    if [[ "${RUN_MIGRATIONS:-0}" == "1" ]]; then
      log "RUN_MIGRATIONS=1 — aplicando migrations…"
      pnpm --filter @operaia/database migrate
    else
      log "Migrations NÃO executadas (defina RUN_MIGRATIONS=1 para aplicar)."
    fi
    pnpm --filter @operaia/api build || true
    if [[ -d apps/web ]]; then
      export VITE_API_URL="${VITE_API_URL:-}"
      pnpm --filter @operaia/web build || true
    fi
  )
}

link_shared_env() {
  local dest="$1"
  ln -sfn "${SHARED}/.env" "${dest}/.env"
}

atomic_switch() {
  local dest="$1"
  local tmp_link="${ROOT}/.current.new"
  ln -sfn "$dest" "$tmp_link"
  mv -Tf "$tmp_link" "$CURRENT"
  ok "current → ${dest}"
}

restart_services() {
  if systemctl list-unit-files operaia-api.service >/dev/null 2>&1; then
    log "Restart operaia-api…"
    systemctl restart operaia-api
  else
    log "Unit operaia-api ainda não instalada — skip restart."
  fi
}

prune_old_releases() {
  local count
  count="$(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
  if [[ "$count" -le "$KEEP_RELEASES" ]]; then
    return 0
  fi
  log "Podando releases antigos (keep=${KEEP_RELEASES})…"
  # shellcheck disable=SC2012
  ls -1dt "${RELEASES}"/* | tail -n +"$((KEEP_RELEASES + 1))" | while read -r old; do
    # não apagar o current
    if [[ "$(readlink -f "$CURRENT" 2>/dev/null || true)" == "$(readlink -f "$old")" ]]; then
      continue
    fi
    log "Removendo $old"
    rm -rf "$old"
  done
}

health_check() {
  local url="${HEALTH_URL:-http://127.0.0.1:3333/api/v1/health}"
  local i
  for i in $(seq 1 30); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      ok "Health OK: $url"
      return 0
    fi
    sleep 2
  done
  die "Health check falhou: $url"
}

main() {
  require_gate
  require_root_or_operaia
  validate_preflight

  local dest
  dest="$(create_release_dir)"
  populate_release "$dest"
  link_shared_env "$dest"
  build_release "$dest"
  atomic_switch "$dest"
  restart_services
  health_check
  prune_old_releases
  ok "Deploy concluído: $(readlink -f "$CURRENT")"
}

main "$@"
