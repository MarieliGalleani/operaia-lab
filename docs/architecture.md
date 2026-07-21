# Arquitetura — OperaIA.lab

## Estilo arquitetural

**Modular Monolith** em um **monorepo** (pnpm workspaces). Um único artefato deployável (`apps/api`), com fronteiras internas explícitas entre módulos de negócio e pacotes de capacidade transversal.

A escolha equilibra simplicidade operacional (um deploy, um banco) com organização de código que permite, no futuro, extrair um módulo para serviço independente sem reescrever o domínio.

## Estrutura de diretórios

```
apps/
  api/                    # Aplicação Fastify (composition root + módulos de negócio)
    src/
      config/             # Validação de ambiente (fail-fast)
      modules/
        projects/         # domain / application / infrastructure / routes
        tasks/
        agents/
        health/
      shared/             # error handler HTTP
      app.ts              # montagem do Fastify
      server.ts           # bootstrap + graceful shutdown

packages/
  shared/                 # enums, erros de domínio, tipos utilitários
  database/               # Prisma (schema, client singleton, seed)
  ai-core/                # contrato LLMProvider (sem implementação)
  memory/                 # contrato MemoryStore / RAG (sem implementação)
  agents/                 # AgentDefinition, registry, OperaIA CEO

infra/
  docker-compose.yml      # PostgreSQL

docs/
```

## Camadas por módulo de negócio (Clean Architecture)

Cada módulo em `apps/api/src/modules/*` segue quatro camadas com dependências apontando para dentro:

1. **domain** — entidade (POJO) + interface de repositório. Zero dependência de framework/ORM.
2. **application** — casos de uso (`*.service.ts`). Orquestra o domínio; lança erros de domínio.
3. **infrastructure** — implementação do repositório com Prisma. Mapeia linhas do banco para entidades de domínio.
4. **routes** — camada HTTP (Fastify + Zod). Traduz requisições em chamadas de caso de uso.

> **Inversão de dependência:** o repositório é uma **interface** definida no domínio e **implementada** na infraestrutura. Trocar Prisma por outra tecnologia não afeta domínio nem aplicação.

## Direção de dependências entre pacotes

```
shared  ←  ai-core  ←  agents
  ↑          ↑           ↑
memory ──────┘           │
database                 │
   └──────── apps/api ───┘
```

- `shared` não depende de ninguém.
- `database` isola o Prisma; expõe um client singleton e re-exporta tipos gerados.
- `ai-core` / `memory` são **apenas contratos** — preparam integração futura sem acoplá-la agora.
- `agents` combina contratos (`ai-core`, `memory`) com definições declarativas de agentes.
- `apps/api` é o único orquestrador.

## Modelo de dados

Enums (`ProjectStatus`, `TaskStatus`, `Priority`) são a fonte única da verdade em `@operaia/shared` e espelhados no `schema.prisma`.

- `Project 1—N Task` (ao deletar projeto, tarefas caem em cascata).
- `Agent 1—N Task` via `assignedAgentId` (ao deletar agente, a atribuição vira `null` — `SetNull`).

## Validação e tratamento de erros

- **Zod** valida entrada e serializa saída de ponta a ponta (`fastify-type-provider-zod`), garantindo tipos derivados dos schemas.
- Um **error handler central** traduz erros de domínio, de validação e conhecidos do Prisma (P2025→404, P2003→422, P2002→409) em respostas HTTP consistentes, sem vazar infraestrutura.

## Preparação para o futuro (sem implementação nesta versão)

- **LLMs:** implementar `LLMProvider` (`@operaia/ai-core`) para um provedor concreto.
- **Memória RAG:** implementar `MemoryStore` (`@operaia/memory`), provavelmente PostgreSQL + `pgvector`.
- **n8n:** a API REST já é o ponto de integração; `/health` e `/health/ready` suportam orquestração e healthchecks.

## Decisões notáveis

- **pnpm workspaces + tsx:** dev roda TypeScript direto, resolvendo pacotes do workspace por `main` apontando para `src`.
- **`strict` no TypeScript** (com `noUncheckedIndexedAccess`). `exactOptionalPropertyTypes` foi omitido por gerar atrito com Prisma/Fastify sem ganho real de segurança.
- **Módulos de negócio ficam em `apps/api`, não em `packages`:** regras específicas da aplicação não pertencem a bibliotecas transversais reutilizáveis.
