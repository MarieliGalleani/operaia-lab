# OperaIA.lab

Escritório virtual inteligente baseado em agentes de IA. Esta é a **primeira versão**, focada no **CORE operacional** — o cérebro inicial do sistema (sem frontend, sem autenticação, sem multi-tenant).

> Documentação: [`docs/product-overview.md`](docs/product-overview.md) · [`docs/architecture.md`](docs/architecture.md) · [`docs/roadmap.md`](docs/roadmap.md)

## Stack

- TypeScript (strict) · Node.js · Fastify · Zod
- Prisma · PostgreSQL
- Monorepo com pnpm workspaces (Modular Monolith)

## Estrutura

```
apps/api            # API Fastify + módulos de negócio (projects, tasks, agents)
packages/shared     # enums, erros de domínio, tipos
packages/database   # Prisma (schema, client, seed)
packages/ai-core    # contrato LLMProvider (futuro)
packages/memory     # contrato MemoryStore / RAG (futuro)
packages/agents     # definições de agentes + OperaIA CEO
infra/              # docker-compose (PostgreSQL)
docs/               # documentação
```

## Pré-requisitos

- Node.js >= 20
- pnpm >= 9
- Docker (para o PostgreSQL)

## Setup

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar ambiente
cp .env.example .env

# 3. Subir o PostgreSQL
pnpm infra:up

# 4. Gerar o client do Prisma e aplicar as migrations
pnpm db:generate
pnpm db:migrate

# 5. Popular dados iniciais (NEXO, MenuFlow, Plataforma + OperaIA CEO)
pnpm db:seed

# 6. Rodar a API em modo desenvolvimento
pnpm dev
```

A API sobe em `http://localhost:3333`.

## Endpoints

| Método | Rota                    | Descrição                     |
| ------ | ----------------------- | ----------------------------- |
| GET    | `/health`               | Liveness                      |
| GET    | `/health/ready`         | Readiness (checa o banco)     |
| CRUD   | `/api/v1/projects`      | Gestão de projetos            |
| CRUD   | `/api/v1/tasks`         | Gestão de tarefas             |
| CRUD   | `/api/v1/agents`        | Gestão de agentes             |

`tasks` aceita filtros via query: `projectId`, `status`, `assignedAgentId`, `skip`, `take`.

## Scripts úteis

```bash
pnpm typecheck      # checagem de tipos em todo o monorepo
pnpm db:studio      # Prisma Studio
pnpm infra:down     # derruba o PostgreSQL
```
