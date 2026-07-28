# Arquitetura de Produção — OperaIA.lab (Oracle Cloud VM)

**Ambiente oficial:** Oracle Cloud VM  
**Domínio:** `operaia.com.br`  
**Princípio:** um processo Node (API + Continuous Runtime + Scheduler + WorkerManager + 9 Workers) atrás do Caddy (HTTPS).

> **Limitação desta sessão de desenvolvimento:** deploy DNS/SSH na VM real depende de credenciais e acesso à Oracle Cloud. Os artefatos abaixo estão prontos no repositório para aplicação na VM.

---

## 1. Arquitetura final

```
Internet (80/443)
        │
        ▼
┌───────────────────┐
│  Caddy (systemd)  │  HTTPS automático (Let's Encrypt)
│  /etc/caddy/…     │  HTTP → HTTPS, gzip, headers
└─────────┬─────────┘
          │
    ┌─────┴──────┬──────────────┬────────────────┐
    ▼            ▼              ▼                ▼
operaia.com.br  lab.…        api.…           status.…
 (estático)   (web/dist)   127.0.0.1:3333   rewrite →
                                           /api/v1/production-readiness
                                               │
                                               ▼
                                    ┌─────────────────────┐
                                    │ operaia-lab-api     │
                                    │ (systemd)           │
                                    │ API + Workers +     │
                                    │ Scheduler + Runtime │
                                    └──────────┬──────────┘
                                               │
                                               ▼
                                         PostgreSQL
                                    (local ou gerenciado)
                                               │
                                               ▼
                                    backup timer (pg_dump)
```

### Serviços em execução (esperados)

| Serviço systemd | Função |
|---|---|
| `operaia-lab-api` | API + Continuous Runtime + Scheduler + Workers |
| `caddy` | Reverse proxy + TLS |
| `operaia-backup.timer` | Backup diário Postgres |
| `postgresql` **ou** Docker Postgres | Banco |

### Portas

| Porta | Binding | Exposição |
|---|---|---|
| 80 | Caddy | Pública (redirect → HTTPS) |
| 443 | Caddy | Pública (HTTPS) |
| 3333 | API (`127.0.0.1`) | **Somente localhost** |
| 5432 | PostgreSQL | **Somente rede privada / localhost** |

Oracle Security List / NSG: liberar **apenas 22, 80, 443** (e ICMP se necessário).

---

## 2. Domínios

| Host | Destino |
|---|---|
| `operaia.com.br` | `infra/www` (página institucional mínima) |
| `www.operaia.com.br` | redirect → apex |
| `lab.operaia.com.br` | `apps/web/dist` (OperaIA.lab) |
| `api.operaia.com.br` | reverse_proxy → `127.0.0.1:3333` |
| `status.operaia.com.br` | proxy → `/api/v1/production-readiness` (JSON) |

### DNS (aplicar no registrador)

Registros **A** (e **AAAA** se IPv6) apontando para o IP público da VM:

- `operaia.com.br`
- `www.operaia.com.br`
- `lab.operaia.com.br`
- `api.operaia.com.br`
- `status.operaia.com.br`

Caddy emite certificados Let's Encrypt automaticamente após o DNS propagar.

### Limitações técnicas (justificadas)

1. **Sem acesso SSH/DNS nesta sessão** — configs versionadas; aplicação na VM é passo humano/ops.
2. **Site institucional** — não há app de marketing no monorepo; `infra/www` é placeholder mínimo (não é tela do Lab). Substituível depois sem mudar API.
3. **status.*** — deliberadamente JSON da API (sem nova UI), alinhado à regra “não criar novas telas”.
4. **API bind `127.0.0.1`** — evita exposição direta da 3333; só Caddy fala com a internet.

---

## 3. Proxy (Caddy)

Arquivo fonte: `infra/caddy/Caddyfile`  
Instalação: `/etc/caddy/Caddyfile`

Recursos:

- HTTPS automático + HTTP→HTTPS
- `encode gzip zstd`
- Headers: HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`
- Proxy API com `X-Forwarded-Proto` / `X-Real-IP`
- Logs em `/var/log/caddy/`

---

## 4. systemd

| Unit | Path no repo |
|---|---|
| API + Runtime | `infra/systemd/operaia-lab-api.service` |
| Backup oneshot | `infra/systemd/operaia-backup.service` |
| Backup diário 03:15 UTC | `infra/systemd/operaia-backup.timer` |
| Caddy (referência) | `infra/systemd/caddy-operaia.service` — preferir unit do pacote `caddy` |

Após reboot, `enable` garante:

1. rede  
2. Postgres  
3. `operaia-lab-api` (Production Readiness → recovery → workers → scheduler)  
4. `caddy`  
5. timer de backup  

---

## 5. Checklist de produção

Script: `infra/scripts/production-checklist.sh`

Validar manualmente também:

- [ ] DNS propagado
- [ ] `https://api.operaia.com.br/api/v1/health`
- [ ] `https://api.operaia.com.br/api/v1/production-readiness` → `canStartWorkers: true`
- [ ] `https://api.operaia.com.br/api/v1/workers` → `alive: 9`
- [ ] `https://status.operaia.com.br` → JSON readiness
- [ ] `https://lab.operaia.com.br` → SPA
- [ ] `https://operaia.com.br` → institucional
- [ ] Certificado TLS válido (cadeia Let's Encrypt)
- [ ] `systemctl is-enabled operaia-lab-api caddy`
- [ ] Reboot VM → serviços sobem sozinhos
- [ ] PC do usuário desligado → heartbeats continuam
- [ ] Backup em `/var/backups/operaia-lab`

---

## 6. Instalação inicial (uma vez)

```bash
# Na VM (root)
export REPO_URL='https://github.com/<org>/operaia-lab.git'  # ajuste
bash /opt/operaia-lab/infra/scripts/bootstrap-oracle-vm.sh
# ou, se repo ainda nao clonado:
# curl ... | bash  — preferir clone manual + bootstrap

# Usuario operaia
sudo -u operaia cp /opt/operaia-lab/infra/production/env.production.example /opt/operaia-lab/.env
sudo -u operaia nano /opt/operaia-lab/.env   # senhas + GEMINI_API_KEY + DATABASE_URL

# Postgres: docker compose ou apt install postgresql
# Exemplo docker (porta 5432 interna):
#   cd /opt/operaia-lab && ajustar compose para 5432:5432 em prod

sudo -u operaia bash /opt/operaia-lab/infra/scripts/deploy-production.sh
sudo systemctl enable --now operaia-lab-api caddy operaia-backup.timer
bash /opt/operaia-lab/infra/scripts/production-checklist.sh
```

---

## 7. Atualização (deploy de versões futuras)

```bash
cd /opt/operaia-lab
sudo -u operaia git pull
sudo -u operaia bash infra/scripts/deploy-production.sh
# migrate deploy + build web + restart API + reload Caddy
bash infra/scripts/production-checklist.sh
```

Rollback rápido:

```bash
cd /opt/operaia-lab
sudo -u operaia git checkout <tag-anterior>
sudo -u operaia bash infra/scripts/deploy-production.sh
```

Restore DB (emergência):

```bash
gunzip -c /var/backups/operaia-lab/operaia_lab_XXXX.sql.gz | psql "$DATABASE_URL"
```

---

## 8. Arquivos de referência

| Artefato | Caminho |
|---|---|
| Caddyfile | `infra/caddy/Caddyfile` |
| Env produção | `infra/production/env.production.example` |
| Bootstrap VM | `infra/scripts/bootstrap-oracle-vm.sh` |
| Deploy | `infra/scripts/deploy-production.sh` |
| Checklist | `infra/scripts/production-checklist.sh` |
| Backup | `infra/scripts/backup-postgres.sh` |
| Institucional | `infra/www/index.html` |
| Runbook operacional | `infra/oracle-vm-runbook.md` |
