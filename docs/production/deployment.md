# Deploy — OperaIA.lab (futuro)

**Status:** documentação de App Provisioning. **Não executar** nesta missão.

Script: [`scripts/deploy.sh`](../../scripts/deploy.sh)

---

## Pré-requisitos (missões anteriores / Deploy)

- Bootstrap SO concluído (Node, pnpm, usuário `operaia`, dirs)
- Layout `/opt/operaia-lab/{current,releases,shared,scripts}`
- `/opt/operaia-lab/shared/.env` preenchido (fora do git)
- Decisão de PostgreSQL documentada e instância acessível via `DATABASE_URL`
- Caddy/n8n **intocados** até go-live controlado

---

## Fluxo pretendido

```text
1. Criar releases/<id> (clone ou artifact)
2. Instalar deps (pnpm) + build API/web no release
3. Migrations (somente na missão Deploy, com backup prévio)
4. Apontar shared/.env (symlink se necessário)
5. Atomic switch: current → releases/<id>
6. systemctl restart operaia-api (e units extras só se split aprovado)
7. Health check local (127.0.0.1:3333)
```

O script `deploy.sh` implementa esse esqueleto com `set -euo pipefail`, logs e exit codes — **abortando** se `OPERAIA_ALLOW_DEPLOY=1` não estiver definido (trava de segurança nesta fase).

---

## Idempotência e segurança

- Nunca sobrescrever `shared/.env`
- Nunca deletar o release anterior antes do health check
- Manter N releases antigos para rollback
- Não alterar DNS/Caddy neste script

---

## Ver também

- [architecture.md](./architecture.md)
- [rollback.md](./rollback.md)
- [operations.md](./operations.md)
