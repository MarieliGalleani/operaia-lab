# Variáveis de ambiente — produção

Template canônico: [`.env.example`](../../.env.example) na raiz do monorepo.  
Em produção o arquivo real será `/opt/operaia-lab/shared/.env` (criado na missão **Deploy**, nunca commitado).

**Regras:** sem valores reais neste repositório; sem chaves de API preenchidas; falhar cedo via `apps/api/src/config/env.ts`.

---

## Ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `NODE_ENV` | sim | `development` \| `test` \| `production`. Em produção: `production`. |

---

## API

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `API_HOST` | não (default) | Bind. Produção recomendada: `127.0.0.1` (só Caddy acessa). |
| `API_PORT` | não (default `3333`) | Porta HTTP local. |
| `LOG_LEVEL` | não | `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace`. |

---

## Banco de dados

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | **sim** | URL Prisma/Postgres (`postgresql://…`). |
| `POSTGRES_USER` | ops | Usado por compose/scripts de provisionamento de DB. |
| `POSTGRES_PASSWORD` | ops | Nunca no git; só no `.env` real. |
| `POSTGRES_DB` | ops | Nome lógico do banco da aplicação. |

---

## Runtime / workers / scheduler

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `CONTINUOUS_RUNTIME_ENABLED` | não (default `true`) | Liga Continuous Runtime no processo. |
| `WORKER_POLL_INTERVAL_MS` | não | Intervalo de poll da fila pelos workers. |
| `WORKER_HEARTBEAT_INTERVAL_MS` | não | Heartbeat persistido dos workers. |
| `SCHEDULER_INTERVAL_MS` | não | Ciclo do Mission Scheduler. |
| `MISSION_STALE_RUNNING_MS` | não | Timeout para recovery de missões `RUNNING` órfãs. |
| `OPERAIA_PROCESS_ROLE` | contrato futuro | `all` \| `api` \| `runtime` \| `worker` \| `scheduler`. Hoje o código efetivo trata o processo como monolítico (`all`). |
| `MEMORY_STORE` | não (default `prisma`) | `prisma` = índice M1 persistente (`OperationalMemoryNote`). `inmemory` = kill-switch volátil (rollback sem drop). |
| `MEMORY_M1_LEARNING_FALLBACK` | não (default `false`) | Se `true` e o índice M1 não tiver learnings, lê `MissionLearning` (só migração). |

---

## LLM / Gemini

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `LLM_PROVIDER` | não | `gemini` \| `openai` \| `anthropic` \| `openrouter` \| `deterministic`. |
| `LLM_MODEL` | não | Modelo padrão do provedor. |
| `LLM_FALLBACK_PROVIDERS` | não | CSV de fallbacks (ex.: `deterministic` ou `openai,deterministic`). `deterministic` é anexado automaticamente como última rede de segurança se o primário não for ele. |
| `LLM_MAX_TOKENS_CLAMP` | não | Teto técnico de tokens. |
| `LLM_OBSERVABILITY` | não | `true`/`false` — logs de chamadas LLM. |
| `GEMINI_API_KEY` | prod se provider=gemini | Chave Gemini; **vazia no template**. |
| `OPENAI_API_KEY` | opcional | Reservado. |
| `ANTHROPIC_API_KEY` | opcional | Reservado. |
| `OPENROUTER_API_KEY` | opcional | Reservado. |

---

## Observabilidade / metadados

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `VPS_NAME` | não | Label do painel/infra. |
| `VPS_PROVIDER` | não | Ex.: `oracle`. |
| `VPS_REGION` | não | Ex.: `sa-saopaulo-1`. |
| `VPS_MONTHLY_COST_BRL` | não | Custo estimado (0 = free tier). |
| `VPS_COST_CURRENCY` | não | Moeda do painel. |

Health/readiness de runtime vêm dos endpoints da API (`/api/v1/health`, `/api/v1/production-readiness`, `/api/v1/workers`) — não há stack APM obrigatória nesta fase.

---

## Paths e backup (operação)

| Variável | Descrição |
|----------|-----------|
| `OPERAIA_ROOT` | `/opt/operaia-lab` |
| `OPERAIA_CURRENT` | Symlink do release ativo |
| `OPERAIA_SHARED` | Estado compartilhado |
| `OPERAIA_LOG_DIR` | Logs persistentes |
| `OPERAIA_RUNTIME_DIR` | pid/socket/cache/tmp |
| `VITE_API_URL` | Base da API no build do web (`lab.*`) |
| `BACKUP_DIR` | Destino dos dumps |
| `RETENTION_DAYS` | Retenção de backups |

---

## Onde o processo carrega o `.env`

1. Systemd: `EnvironmentFile=-/opt/operaia-lab/shared/.env`
2. Deploy: garantir que `current` não embute secrets
3. Validação: schema Zod em `apps/api/src/config/env.ts` — boot falha se `DATABASE_URL` inválida
