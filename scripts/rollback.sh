#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# rollback.sh — volta current para um release anterior (FUTURO)
#
# NÃO executar nesta missão.
# Trava: OPERAIA_ALLOW_DEPLOY=1
# -----------------------------------------------------------------------------
set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
ROOT="${OPERAIA_ROOT:-/opt/operaia-lab}"
CURRENT="${OPERAIA_CURRENT:-$ROOT/current}"
RELEASES="${ROOT}/releases"

log()  { printf '[%s] %s\n' "$SCRIPT_NAME" "$*"; }
ok()   { printf '[%s] OK  %s\n' "$SCRIPT_NAME" "$*"; }
die()  { printf '[%s] ERR %s\n' "$SCRIPT_NAME" "$*" >&2; exit 1; }

require_gate() {
  if [[ "${OPERAIA_ALLOW_DEPLOY:-}" != "1" ]]; then
    die "Trava ativa. Defina OPERAIA_ALLOW_DEPLOY=1 somente na missão Deploy/Rollback."
  fi
}

list_releases() {
  # shellcheck disable=SC2012
  ls -1dt "${RELEASES}"/* 2>/dev/null || true
}

resolve_target() {
  local target="${1:-}"
  if [[ -n "$target" ]]; then
    if [[ -d "$target" ]]; then
      echo "$target"
      return
    fi
    if [[ -d "${RELEASES}/${target}" ]]; then
      echo "${RELEASES}/${target}"
      return
    fi
    die "Release não encontrado: $target"
  fi

  local current_real previous=""
  current_real="$(readlink -f "$CURRENT" 2>/dev/null || true)"
  local r
  while IFS= read -r r; do
    [[ -z "$r" ]] && continue
    if [[ "$(readlink -f "$r")" == "$current_real" ]]; then
      continue
    fi
    previous="$r"
    break
  done < <(list_releases)

  [[ -n "$previous" ]] || die "Nenhum release anterior disponível."
  echo "$previous"
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
    systemctl restart operaia-api
  else
    log "Unit operaia-api não instalada — skip."
  fi
}

health_check() {
  local url="${HEALTH_URL:-http://127.0.0.1:3333/api/v1/health}"
  local i
  for i in $(seq 1 30); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      ok "Health OK"
      return 0
    fi
    sleep 2
  done
  die "Health check falhou após rollback."
}

main() {
  require_gate
  [[ -d "$RELEASES" ]] || die "releases/ ausente."

  local dest
  dest="$(resolve_target "${1:-}")"
  log "Rollback para: $dest"
  atomic_switch "$dest"
  restart_services
  health_check
  ok "Rollback concluído."
}

main "$@"
