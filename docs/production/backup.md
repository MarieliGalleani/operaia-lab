# Backup e restore — PostgreSQL (futuro)

**Status:** documentação de App Provisioning. **Não executar** nesta missão.

Scripts:

- [`scripts/backup-db.sh`](../../scripts/backup-db.sh)
- [`scripts/restore-db.sh`](../../scripts/restore-db.sh)

---

## Backup

- Fonte: `DATABASE_URL` (ou `POSTGRES_*`)
- Destino: `BACKUP_DIR` (default `/opt/operaia-lab/shared/backups`)
- Formato: `pg_dump` plain SQL comprimido (`.sql.gz`)
- Retenção: `RETENTION_DAYS` (default 14)

Recomendação operacional: timer systemd (`operaia-backup.timer` já esboçado em `infra/systemd/`) na missão Deploy.

---

## Restore

1. Parar API/runtime (`systemctl stop operaia-api` — quando instalado)
2. Confirmar arquivo `.sql.gz`
3. `restore-db.sh <arquivo>`
4. Subir serviço e validar readiness

**Riscos:** restore sobrescreve dados; sempre validar ambiente (`NODE_ENV`, host) antes. Script exige `OPERAIA_ALLOW_DEPLOY=1` e confirmação explícita `CONFIRM_RESTORE=yes`.

---

## O que não está no escopo agora

- Backup de volumes Docker não relacionados (n8n)
- Backup offsite (S3/OCI Object Storage) — próxima evolução
- PITR / WAL archiving — avaliar após escolha em [database-decision.md](./database-decision.md)
