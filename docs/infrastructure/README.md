# Padrões da Infraestrutura da OperaIA

**Status:** documento oficial de convenções  
**Audiência:** desenvolvedores, operadores, futuros colaboradores, agentes da Equipe Digital, automações de deploy  
**Última atualização:** 2026-07-28

Este é a **fonte oficial** das convenções de infraestrutura da OperaIA. Em caso de dúvida operacional, consulte este documento antes de alterar hosts, paths, serviços ou processos de deploy.

**Documentos relacionados:**

- [ADR-006 — Layout de produção na VM](../architecture/adr/ADR-006-production-layout.md)
- [Arquitetura de produção (OperaIA.lab)](../production/architecture.md)
- [Variáveis de ambiente](../production/environment.md)
- [Bootstrap SO](../../infra/bootstrap/README.md)

---

## 1. Objetivo

Toda infraestrutura da OperaIA segue padrões definidos para garantir:

| Meta | Como o padrão ajuda |
|------|---------------------|
| **Previsibilidade** | Mesmos paths, pipeline e responsabilidades em cada VM |
| **Automação** | Scripts versionados, idempotentes, com gates explícitos |
| **Segurança** | Secrets fora do git, bind local, least privilege (`operaia`) |
| **Escalabilidade** | Layout `releases/current`, multi-app em `/opt` |
| **Facilidade de manutenção** | ADRs, rollback documentado, health checks padronizados |

Nenhuma implantação “ad hoc” no home do administrador ou sem rollback planejado é considerada conforme com estes padrões.

---

## 2. Estrutura da VM

A VM Oracle Cloud (e hosts similares) organiza-se em **duas zonas** com papéis distintos.

### `/home/ubuntu` — área do administrador

Utilizado para:

- `operaia-infra` — repositórios e playbooks de infraestrutura
- `operaia-deploy` — ferramentas e orquestração de deploy do operador
- **n8n** e stacks auxiliares já existentes
- scripts administrativos
- ferramentas auxiliares e experimentos

**Nunca** utilizar para **aplicações implantadas em produção** (runtime gerenciado por systemd, releases, `.env` de app, artefato que reinicia após deploy).

O home do `ubuntu` é a bancada do operador humano — não o destino do processo que a Equipe Digital executa 24×7.

### `/opt` — aplicações implantadas

Utilizado para aplicações que:

- sobem via **systemd** (ou contrato equivalente);
- seguem layout **releases + current**;
- persistem estado em `shared/` entre deploys.

**Exemplo oficial — OperaIA.lab:**

```text
/opt/operaia-lab/
├── current      → symlink ao release ativo (imutável por switch)
├── releases/    → uma pasta por versão (timestamp ou SHA)
├── shared/      → .env, logs, backups, runtime (não versionado)
└── scripts/     → deploy, rollback, backup (espelho operacional)
```

Futuras apps OperaIA no mesmo host devem seguir o mesmo princípio, por exemplo `/opt/outra-app`, sem misturar código com `/home/ubuntu`.

**Usuário de serviço:** aplicações em `/opt` rodam preferencialmente como `operaia` (não como `ubuntu`). Ver [ADR-006](../architecture/adr/ADR-006-production-layout.md).

---

## 3. Princípios

Princípios **oficiais** da infraestrutura OperaIA:

1. **Toda aplicação implantada deve residir em `/opt`.**

2. **Infraestrutura administrativa permanece em `/home/ubuntu`.**

3. **Infraestrutura é definida como código** — scripts em `infra/`, `scripts/`, units em `deploy/systemd/`, compose em `infra/production/`.

4. **Nenhum segredo pode ser versionado** — apenas templates (`.env.example`); produção em `shared/.env`.

5. **Todo deploy deve possuir rollback** — switch de `current` + script `rollback.sh`; migrations destrutivas exigem backup prévio.

6. **Todo serviço deve possuir health check** — HTTP local ou `pg_isready`/healthcheck Docker antes de considerar “up”.

7. **Toda mudança arquitetural relevante deve gerar um ADR** — em `docs/architecture/adr/`.

8. **Nenhuma alteração em produção ocorre sem aprovação humana** — automações e agentes preparam e validam; go-live e mudanças destrutivas exigem decisão explícita.

---

## 4. Organização de deploy

Pipeline oficial, em fases separadas e auditáveis:

```text
Bootstrap SO
    ↓
App Provisioning
    ↓
Deploy
    ↓
Go Live
    ↓
Operação Contínua
```

| Fase | O que faz | Artefatos típicos |
|------|-----------|-------------------|
| **Bootstrap SO** | Node, pnpm, usuário `operaia`, dirs base | `infra/bootstrap/` |
| **App Provisioning** | Layout, scripts, units, docs, `.env.example` | `scripts/`, `deploy/`, `docs/production/` |
| **Deploy** | Postgres, clone, build, migrations, systemd, health local | `scripts/deploy.sh`, compose Postgres |
| **Go Live** | DNS, SSL, Caddy da app, exposição pública, reboot test | `infra/caddy/`, checklist |
| **Operação Contínua** | 24×7, backup, monitoramento, incidentes | `docs/production/operations.md` |

Cada fase tem critérios de conclusão próprios. **Não pular fases** (ex.: Go Live sem Deploy validado em `127.0.0.1`).

---

## 5. Serviços

Responsabilidades oficiais na stack atual (Oracle Cloud VM):

### Docker

- Runtime de containers na VM.
- Usado para **PostgreSQL de produção** (Compose versionado) e stacks administrativos (ex.: n8n).
- **Não** substitui o processo Node da OperaIA.lab (API roda via systemd + pnpm, não em container de app nesta fase).

### Docker Compose

- Orquestra serviços com estado persistente (volumes nomeados).
- Postgres: `infra/production/docker-compose.postgres.yml` — bind `127.0.0.1:5432`, volume `operaia_lab_pgdata`.
- Stacks em `/home/ubuntu` (n8n) **não** devem ser alterados por deploy da OperaIA.lab sem aprovação.

### PostgreSQL

- Banco de dados da Equipe Digital e fila de missões (Prisma).
- Produção inicial: **container** com volume persistente; análise Docker vs. SO em [database-decision.md](../production/database-decision.md).
- **Nunca** expor `5432` publicamente; apenas localhost ou rede interna.

### Caddy

- Terminação HTTPS e reverse proxy na VM.
- Já existente para outros serviços; integração da OperaIA.lab (api/lab/status) é fase **Go Live**, não Deploy.
- Alterações no Caddyfile exigem aprovação e teste — não quebrar n8n.

### systemd

- Gerencia processos de produção em `/opt`.
- Unit atual da OperaIA.lab: `operaia-api.service` (`deploy/systemd/`).
- `EnvironmentFile=/opt/operaia-lab/shared/.env`, `WorkingDirectory=/opt/operaia-lab/current`.
- Units split (`runtime`, `worker`, `scheduler`) são **futuras** — ver [process-role-decision.md](../production/process-role-decision.md).

### Runtime (Continuous Runtime)

- Orquestração contínua da Equipe Digital dentro do processo API quando `CONTINUOUS_RUNTIME_ENABLED=true`.
- Recovery de missões órfãs, readiness no boot.
- Endpoint: `GET /api/v1/runtime` (via prefixo da API).

### Workers

- Workers lógicos (roster da Equipe Digital); heartbeats em Postgres.
- Hoje no **mesmo processo** que a API (`OPERAIA_PROCESS_ROLE=all`).
- Endpoint: `GET /api/v1/workers`.

### Scheduler

- Enfileira missões periódicas para a Opera (CEO).
- Hoje no **mesmo processo** que a API.
- Validado via `/api/v1/runtime` e `production-readiness`.

**Ordem de subida (Deploy):**

1. PostgreSQL (Compose healthy)  
2. `operaia-api` (API + Runtime + Workers + Scheduler monolítico)

---

## 6. Backups

Padrão oficial:

| Regra | Detalhe |
|-------|---------|
| **Automatização** | Timer systemd ou cron documentado; script `scripts/backup-db.sh` |
| **Destino** | `/opt/operaia-lab/shared/backups` (ou `BACKUP_DIR` no `.env`) |
| **Formato** | `pg_dump` → `.sql.gz`, retenção `RETENTION_DAYS` |
| **Restauração documentada** | [backup.md](../production/backup.md), `scripts/restore-db.sh` |
| **Testável** | Restore em ambiente de teste ou janela de manutenção antes de confiar no backup |

Backups de **volume Docker** (`operaia_lab_pgdata`) e dumps lógicos devem ser considerados na decisão final de banco. Todo backup de produção deve ser **verificado** (restore de prova) periodicamente.

**Não versionar** dumps nem `.env` nos repositórios.

---

## 7. Observabilidade

### Logs

- **Aplicação:** `journalctl -u operaia-api -f` (systemd).
- **Persistência opcional:** `/opt/operaia-lab/shared/logs`.
- **PostgreSQL / Docker:** logs do container com rotação (`json-file`, `max-size` no compose).
- **Caddy / n8n:** logs dos units/stacks existentes — não misturar com paths da app.

### Métricas

- Fase atual: endpoints JSON da API (`/api/v1/runtime`, `/workers`, métricas embutidas em readiness).
- Stack APM externa (Datadog, etc.) — evolução futura; mudança gera ADR.

### Health checks

| Check | Endpoint / comando | Uso |
|-------|-------------------|-----|
| API viva | `GET /api/v1/health` | Liveness |
| Prontidão produção | `GET /api/v1/production-readiness` | Workers, scheduler, checklist |
| Workers | `GET /api/v1/workers` | Contagem `alive` |
| Runtime | `GET /api/v1/runtime` | Scheduler, fila |
| Postgres | `pg_isready` / healthcheck Compose | Antes de subir API |

Deploy valida em **loopback** (`127.0.0.1:3333`) antes de Go Live público.

### Monitoramento

- Oracle Cloud Monitoring (agente na VM) — infra do host.
- Alertas de produção (uptime público, workers) — configurar na fase Go Live / Operação Contínua.

---

## 8. Evolução

Este documento é **evolutivo**.

- Toda decisão relevante de paths, serviços, banco ou processo deve **atualizar este README** ou gerar um **ADR** em `docs/architecture/adr/`.
- Scripts e templates no repositório devem refletir o documento — não divergir silenciosamente.
- Agentes da Equipe Digital e automações de deploy devem tratar este arquivo como contrato antes de propor mudanças na VM.

**Histórico de decisões já registradas:**

| ADR | Tema |
|-----|------|
| [ADR-006](../architecture/adr/ADR-006-production-layout.md) | `/home/ubuntu` admin vs `/opt` apps |

**Índice sugerido para novos ADRs:** `ADR-007-…`, `ADR-008-…`, etc.

---

## Referência rápida — paths e arquivos

| Item | Local |
|------|--------|
| Bootstrap SO | `infra/bootstrap/` |
| Postgres Compose (prod) | `infra/production/docker-compose.postgres.yml` |
| Deploy / rollback / backup | `scripts/deploy.sh`, `rollback.sh`, `backup-db.sh`, `restore-db.sh` |
| systemd (templates) | `deploy/systemd/` |
| Env template | `.env.example` → `shared/.env` na VM |
| Auditoria VM (leitura) | `scripts/audit-vm.sh` |
| Runbook produção | `docs/production/` |

---

## Conformidade

Uma implantação ou mudança é **conforme** com estes padrões quando:

- a app está em `/opt/<nome-app>` com `current/releases/shared`;
- secrets só em `shared/.env`;
- existe caminho de rollback documentado;
- health checks passam após deploy;
- n8n, Caddy e stacks admin em `/home/ubuntu` não foram alterados sem aprovação;
- mudanças arquiteturais têm ADR ou atualização neste documento.
