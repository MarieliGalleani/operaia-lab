# Arquitetura de produção — OperaIA.lab (App Provisioning)

**Escopo deste documento:** layout e contratos para deploy futuro.  
**Não cobre:** go-live, DNS, SSL, execução na VM.

**ADR:** convenção oficial de paths na VM — [ADR-006-production-layout.md](../architecture/adr/ADR-006-production-layout.md) (`/home/ubuntu` admin vs `/opt` apps).

Pipeline planejado:

```text
Bootstrap SO  →  App Provisioning  →  Deploy  →  Go Live  →  Operação 24×7
                     (esta missão)
```

---

## Layout em disco (`/opt/operaia-lab`)

Convenção oficial (ADR-006): **aplicações implantadas em `/opt`**; `/home/ubuntu` só infra/admin (n8n, operaia-infra, operaia-deploy, scripts).

Modelo **releases + current** (estilo Capistrano), com estado compartilhado fora do código versionado:

```text
/opt/operaia-lab/
├── current                  → symlink para releases/<id>
├── releases/
│   └── <timestamp-or-sha>/  → checkout/build imutável de uma versão
├── shared/
│   ├── .env                 → segredos (NÃO versionado; criado na missão Deploy)
│   ├── logs/                → logs persistentes entre releases
│   ├── runtime/             → pid, socket, cache, tmp, uploads
│   └── backups/             → dumps PostgreSQL
└── scripts/                 → cópia operacional dos scripts de deploy/backup
                              (espelho de scripts/ do repositório)
```

| Path | Responsabilidade |
|------|------------------|
| `releases/<id>` | Artefato imutável (código + dependências/build daquele release) |
| `current` | Ponteiro atômico para o release ativo |
| `shared/.env` | Única fonte de verdade de configuração/secrets |
| `shared/logs` | Sobrevive a rollback |
| `shared/runtime` | Estado efêmero do processo |
| `shared/backups` | Backups de banco |
| `scripts/` | Operação na VM sem depender do path interno do release |

**Regra:** nunca colocar secrets dentro de `releases/`. O processo lê `EnvironmentFile` de `shared/.env` (ou symlink `.env` → `shared/.env` em `current`).

---

## Processos (estado atual vs. templates)

**Estado atual do monorepo:** um único processo Node (`@operaia/api`) concentra:

- HTTP API (Fastify)
- Continuous Runtime
- WorkerManager (workers lógicos da Equipe Digital)
- Mission Scheduler
- Recovery / readiness

**Templates systemd** em `deploy/systemd/` antecipam decomposição futura:

| Unit | Papel pretendido |
|------|------------------|
| `operaia-api.service` | HTTP API |
| `operaia-runtime.service` | Orquestração contínua / recovery |
| `operaia-worker.service` | Workers de missão |
| `operaia-scheduler.service` | Enfileiramento periódico |

Até existir split real por `OPERAIA_PROCESS_ROLE`, **somente** `operaia-api.service` (com `CONTINUOUS_RUNTIME_ENABLED=true` e `OPERAIA_PROCESS_ROLE=all`) deve ser considerado o caminho de produção. As demais units são **preparação** — não instalar/habilitar na missão Deploy sem decisão explícita.

---

## Fronteira de rede (referência)

```text
Internet :80/:443
    → Caddy (já existente na VM; fora do escopo deste provisioning)
        → api.*  → 127.0.0.1:3333
        → lab.*  → static/SPA do release
        → …      → outros hosts (ex.: n8n) intactos
```

PostgreSQL: privado (localhost ou rede Docker interna). Decisão Docker vs. sistema: ver [database-decision.md](./database-decision.md).

---

## Relação com Bootstrap SO

O Bootstrap (`infra/bootstrap/`) prepara SO: Node, pnpm, usuário `operaia`, PostgreSQL (opcional), dirs base.

O App Provisioning define **como** a aplicação habita `/opt/operaia-lab` e quais scripts/units/docs o Deploy usará.

Não há overlap de execução: Bootstrap ≠ Deploy ≠ Go Live.
