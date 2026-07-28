#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# audit-vm.sh — Fase 1 da Missão 3 (auditoria). Só leitura.
# Executar NA VM: sudo bash scripts/audit-vm.sh | tee /tmp/operaia-audit.txt
# -----------------------------------------------------------------------------
set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
log() { printf '[%s] %s\n' "$SCRIPT_NAME" "$*"; }

log "=== host ==="
hostnamectl 2>/dev/null || hostname
uname -a
date -u +%Y-%m-%dT%H:%M:%SZ

log "=== usuarios ==="
id ubuntu 2>/dev/null || true
id operaia 2>/dev/null || log "usuario operaia: AUSENTE"

log "=== disco / memoria ==="
df -h /
free -h

log "=== docker ==="
docker --version 2>/dev/null || log "docker: AUSENTE"
docker compose version 2>/dev/null || docker-compose --version 2>/dev/null || log "compose: AUSENTE"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || true

log "=== portas em escuta (resumo) ==="
ss -tulpn 2>/dev/null | head -n 80 || netstat -tulpn 2>/dev/null | head -n 80 || true

log "=== systemd relevantes ==="
systemctl is-active caddy 2>/dev/null || true
systemctl is-active docker 2>/dev/null || true
systemctl is-active operaia-api 2>/dev/null || log "operaia-api: nao instalado"
systemctl list-units --type=service --state=running --no-pager 2>/dev/null | head -n 40 || true

log "=== node/pnpm (se existirem) ==="
command -v node >/dev/null && node -v || log "node: AUSENTE"
command -v pnpm >/dev/null && pnpm -v || log "pnpm: AUSENTE"

log "=== /opt/operaia-lab ==="
ls -la /opt/operaia-lab 2>/dev/null || log "/opt/operaia-lab: AUSENTE"

log "Auditoria concluida (somente leitura)."
