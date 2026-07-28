# Operações 24×7 — visão futura

**Status:** App Provisioning. Nada disto está ativo na VM nesta missão.

---

## Dia a dia (após Go Live)

| Ação | Como |
|------|------|
| Status API | `systemctl status operaia-api` |
| Logs | `journalctl -u operaia-api -f` |
| Health | `curl -s http://127.0.0.1:3333/api/v1/health` |
| Readiness | `curl -s http://127.0.0.1:3333/api/v1/production-readiness` |
| Workers | `curl -s http://127.0.0.1:3333/api/v1/workers` |
| Deploy | `OPERAIA_ALLOW_DEPLOY=1 /opt/operaia-lab/scripts/deploy.sh` |
| Rollback | `OPERAIA_ALLOW_DEPLOY=1 /opt/operaia-lab/scripts/rollback.sh` |
| Backup | `OPERAIA_ALLOW_DEPLOY=1 /opt/operaia-lab/scripts/backup-db.sh` |

---

## Critério “Equipe Digital 24×7”

1. `operaia-api` enabled + active após reboot  
2. `production-readiness.canStartWorkers == true`  
3. `workers.alive == 9` (roster atual)  
4. Scheduler running  
5. Heartbeats recentes  
6. Caddy/n8n não degradados  

---

## Incidentes comuns (runbook curto)

| Sintoma | Checagem |
|---------|----------|
| API down | `systemctl status`, journal, `.env` presente |
| Workers 0 | readiness FAIL, `DATABASE_URL`, LLM key |
| Disco cheio | `shared/logs`, `shared/backups`, `docker system df` |
| Após deploy ruim | [rollback.md](./rollback.md) |

---

## O que permanece fora até Go Live

- DNS / SSL novos hosts  
- Alteração do Caddyfile de produção  
- Enable das units `operaia-runtime|worker|scheduler` (split ainda não existe no código)
