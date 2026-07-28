#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# 05-create-production-user.sh
# Cria usuário de sistema dedicado "operaia" para rodar a API/runtime.
# NÃO remove nem altera o usuário ubuntu (ou opc).
# Idempotente.
# -----------------------------------------------------------------------------
set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
OPERAIA_USER="${OPERAIA_USER:-operaia}"
OPERAIA_GROUP="${OPERAIA_GROUP:-$OPERAIA_USER}"
OPERAIA_HOME="${OPERAIA_HOME:-/home/${OPERAIA_USER}}"
OPERAIA_SHELL="${OPERAIA_SHELL:-/bin/bash}"
ROOT="${OPERAIA_ROOT:-/opt/operaia-lab}"

log()  { printf '[%s] %s\n' "$SCRIPT_NAME" "$*"; }
ok()   { printf '[%s] OK  %s\n' "$SCRIPT_NAME" "$*"; }
warn() { printf '[%s] WARN %s\n' "$SCRIPT_NAME" "$*" >&2; }
die()  { printf '[%s] ERR %s\n' "$SCRIPT_NAME" "$*" >&2; exit 1; }

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "Execute como root (sudo)."
  fi
}

ensure_group() {
  if getent group "$OPERAIA_GROUP" >/dev/null 2>&1; then
    ok "Grupo ${OPERAIA_GROUP} já existe."
  else
    log "Criando grupo ${OPERAIA_GROUP}…"
    groupadd --system "$OPERAIA_GROUP"
    ok "Grupo ${OPERAIA_GROUP} criado."
  fi
}

ensure_user() {
  if id "$OPERAIA_USER" >/dev/null 2>&1; then
    ok "Usuário ${OPERAIA_USER} já existe (uid=$(id -u "$OPERAIA_USER"))."
    return 0
  fi

  log "Criando usuário de sistema ${OPERAIA_USER}…"
  # --system: uid de serviço; home próprio para SSH keys futuras se necessário.
  useradd \
    --system \
    --create-home \
    --home-dir "$OPERAIA_HOME" \
    --shell "$OPERAIA_SHELL" \
    --gid "$OPERAIA_GROUP" \
    --comment "OperaIA.lab production runtime" \
    "$OPERAIA_USER"

  ok "Usuário ${OPERAIA_USER} criado."
}

protect_ubuntu() {
  if id ubuntu >/dev/null 2>&1; then
    ok "Usuário ubuntu preservado (nenhuma alteração)."
  else
    warn "Usuário ubuntu não encontrado neste host (ok se for imagem custom)."
  fi
}

ensure_opt_ownership() {
  if [[ -d "$ROOT" ]]; then
    chown -R "${OPERAIA_USER}:${OPERAIA_GROUP}" "$ROOT"
    ok "Ownership de ${ROOT} → ${OPERAIA_USER}:${OPERAIA_GROUP}"
  else
    warn "${ROOT} ainda não existe. Execute 04-create-directories.sh."
  fi
}

validate_user() {
  id "$OPERAIA_USER" >/dev/null 2>&1 || die "Usuário ${OPERAIA_USER} ausente após criação."
  getent group "$OPERAIA_GROUP" >/dev/null 2>&1 || die "Grupo ${OPERAIA_GROUP} ausente."
  # Não deve ter shell nologin se quisermos deploy interativo via sudo -u.
  local shell
  shell="$(getent passwd "$OPERAIA_USER" | cut -d: -f7)"
  log "user=${OPERAIA_USER} home=$(getent passwd "$OPERAIA_USER" | cut -d: -f6) shell=${shell}"
  ok "Usuário de produção validado."
}

main() {
  require_root
  protect_ubuntu
  ensure_group
  ensure_user
  ensure_opt_ownership
  validate_user
  ok "Concluído."
}

main "$@"
