#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# 06-prepare-runtime.sh
# Prepara subdiretórios de runtime sob /opt/operaia-lab/runtime:
#   logs, pid, socket, uploads, cache, tmp
# Também garante shared/ e logs/ de topo.
# NÃO cria .env, NÃO inicia processos, NÃO abre sockets.
# Idempotente.
# -----------------------------------------------------------------------------
set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
ROOT="${OPERAIA_ROOT:-/opt/operaia-lab}"
OPERAIA_USER="${OPERAIA_USER:-operaia}"
OPERAIA_GROUP="${OPERAIA_GROUP:-$OPERAIA_USER}"
RUNTIME="${ROOT}/runtime"

RUNTIME_DIRS=(
  "${RUNTIME}/logs"
  "${RUNTIME}/pid"
  "${RUNTIME}/socket"
  "${RUNTIME}/uploads"
  "${RUNTIME}/cache"
  "${RUNTIME}/tmp"
)

EXTRA_DIRS=(
  "${ROOT}/shared"
  "${ROOT}/logs"
  "${ROOT}/backups"
)

log()  { printf '[%s] %s\n' "$SCRIPT_NAME" "$*"; }
ok()   { printf '[%s] OK  %s\n' "$SCRIPT_NAME" "$*"; }
warn() { printf '[%s] WARN %s\n' "$SCRIPT_NAME" "$*" >&2; }
die()  { printf '[%s] ERR %s\n' "$SCRIPT_NAME" "$*" >&2; exit 1; }

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "Execute como root (sudo)."
  fi
}

ensure_base() {
  [[ -d "$ROOT" ]] || die "${ROOT} ausente. Execute 04-create-directories.sh antes."
  mkdir -p "$RUNTIME"
}

create_runtime_tree() {
  local d
  for d in "${EXTRA_DIRS[@]}" "${RUNTIME_DIRS[@]}"; do
    mkdir -p "$d"
    log "dir: $d"
  done
}

# tmp/cache: sticky bit opcional não necessário; permissões restritas.
apply_permissions() {
  chmod 755 "$RUNTIME"
  local d
  for d in "${RUNTIME_DIRS[@]}"; do
    case "$d" in
      */tmp|*/cache)
        chmod 750 "$d"
        ;;
      */socket|*/pid)
        chmod 750 "$d"
        ;;
      *)
        chmod 750 "$d"
        ;;
    esac
  done
  # tmp limpo em reexecuções não apaga conteúdo (idempotente seguro).
  chmod 750 "${ROOT}/logs" "${ROOT}/backups" 2>/dev/null || true
}

apply_ownership() {
  if ! id "$OPERAIA_USER" >/dev/null 2>&1; then
    die "Usuário ${OPERAIA_USER} ausente. Execute 05-create-production-user.sh."
  fi
  chown -R "${OPERAIA_USER}:${OPERAIA_GROUP}" "$ROOT"
  ok "Ownership ${OPERAIA_USER}:${OPERAIA_GROUP}"
}

# Placeholder README local (sem secrets) — só se não existir.
write_runtime_readme() {
  local readme="${RUNTIME}/README"
  if [[ -f "$readme" ]]; then
    return 0
  fi
  cat >"$readme" <<'EOF'
OperaIA.lab — runtime (produção)

Subdirs:
  logs/     — logs do processo / workers
  pid/      — arquivos PID (se usados fora do systemd)
  socket/   — sockets Unix (se necessários)
  uploads/  — uploads temporários da app
  cache/    — cache local
  tmp/      — temporários

NÃO colocar secrets aqui. Secrets ficam em shared/ (próxima missão: .env).
EOF
  chown "${OPERAIA_USER}:${OPERAIA_GROUP}" "$readme"
  chmod 644 "$readme"
}

validate() {
  local d
  for d in "${RUNTIME_DIRS[@]}"; do
    [[ -d "$d" ]] || die "Ausente: $d"
    [[ -w "$d" ]] || warn "Sem escrita para root em $d (inesperado)."
  done

  # Confirma ownership do usuário de produção.
  local owner
  owner="$(stat -c '%U' "$RUNTIME" 2>/dev/null || true)"
  if [[ -n "$owner" && "$owner" != "$OPERAIA_USER" ]]; then
    die "Owner de ${RUNTIME} é ${owner}, esperado ${OPERAIA_USER}."
  fi

  ok "Runtime preparado em ${RUNTIME}"
}

main() {
  require_root
  ensure_base
  create_runtime_tree
  apply_permissions
  apply_ownership
  write_runtime_readme
  validate
  ok "Concluído."
}

main "$@"
