#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# 03-install-postgresql.sh
# Instala PostgreSQL de produção (servidor + client) via apt.
# Habilita e sobe o serviço systemd.
#
# NÃO cria banco da aplicação.
# NÃO cria role da aplicação.
# NÃO executa migrations.
# NÃO altera Caddy / DNS / Docker / n8n.
# Idempotente.
# -----------------------------------------------------------------------------
set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
# Pacotes Ubuntu 24.04 (ARM64/amd64). Versão vem do distro (PG 16 em noble).
PG_PACKAGES=(postgresql postgresql-contrib postgresql-client)

log()  { printf '[%s] %s\n' "$SCRIPT_NAME" "$*"; }
ok()   { printf '[%s] OK  %s\n' "$SCRIPT_NAME" "$*"; }
warn() { printf '[%s] WARN %s\n' "$SCRIPT_NAME" "$*" >&2; }
die()  { printf '[%s] ERR %s\n' "$SCRIPT_NAME" "$*" >&2; exit 1; }

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "Execute como root (sudo)."
  fi
}

packages_installed() {
  local pkg
  for pkg in "${PG_PACKAGES[@]}"; do
    if ! dpkg -s "$pkg" >/dev/null 2>&1; then
      return 1
    fi
  done
  return 0
}

install_packages() {
  log "Instalando pacotes: ${PG_PACKAGES[*]}…"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y --no-install-recommends "${PG_PACKAGES[@]}"
}

ensure_service() {
  local unit="postgresql"
  if ! systemctl list-unit-files "${unit}.service" >/dev/null 2>&1 \
    && ! systemctl cat "${unit}.service" >/dev/null 2>&1; then
    die "Unit ${unit}.service não encontrada após instalação."
  fi

  log "Habilitando ${unit}…"
  systemctl enable "${unit}"
  systemctl start "${unit}"

  # Aguarda cluster ficar pronto (idempotente).
  local i
  for i in $(seq 1 30); do
    if systemctl is-active --quiet "${unit}"; then
      break
    fi
    sleep 1
  done

  systemctl is-active --quiet "${unit}" \
    || die "PostgreSQL não está active após start."
  ok "systemd ${unit} = active (enabled)."
}

validate_postgres() {
  command -v psql >/dev/null 2>&1 || die "psql ausente."
  command -v pg_isready >/dev/null 2>&1 || die "pg_isready ausente."

  if ! pg_isready -q; then
    die "pg_isready reportou cluster indisponível."
  fi

  local ver
  ver="$(psql --version 2>/dev/null | head -n1)"
  log "${ver}"
  log "Listen padrão Ubuntu: localhost (não abrir 5432 publicamente neste script)."
  ok "PostgreSQL instalado e respondendo. Banco da app NÃO foi criado (próxima missão)."
}

main() {
  require_root

  if packages_installed && command -v pg_isready >/dev/null 2>&1 && pg_isready -q; then
    ok "PostgreSQL já instalado e pronto. Nada a instalar."
    ensure_service
    validate_postgres
    exit 0
  fi

  if ! packages_installed; then
    install_packages
  else
    log "Pacotes presentes; garantindo serviço…"
  fi

  ensure_service
  validate_postgres
  ok "Concluído."
}

main "$@"
