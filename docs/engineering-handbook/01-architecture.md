# 01 — Architecture

> Parte 2 do [OperaIA Engineering Handbook](./README.md)

Este documento registra oficialmente a arquitetura do **OperaIA.lab**: sua visão estrutural, a organização do monorepo, o fluxo operacional oficial e os princípios que governam a evolução do sistema.

---

## 1. Visão Arquitetural

### Infraestrutura operacional digital

O **OperaIA.lab** é uma infraestrutura de operação digital. Não é uma coleção de chatbots isolados — é um sistema coordenado onde agentes especializados executam missões sob orquestração, com memória persistente, execução controlada e rastreabilidade completa.

A arquitetura foi desenhada para suportar crescimento contínuo: novos funcionários digitais, novos domínios operacionais e novas capacidades de execução podem ser incorporados sem comprometer a estabilidade do núcleo.

### Arquitetura modular

O sistema adota um **Modular Monolith** em monorepo (pnpm workspaces). Um único artefato deployável concentra a orquestração, enquanto pacotes internos definem fronteiras explícitas de responsabilidade.

A modularidade garante que:

- cada domínio evolui de forma independente;
- dependências seguem direção controlada;
- extração futura para serviços separados permanece viável sem reescrita de domínio.

### Separação entre domínio, runtime e infraestrutura

O OperaIA.lab organiza responsabilidades em três planos distintos:

| Plano | Responsabilidade | Exemplos no monorepo |
|---|---|---|
| **Domínio** | Regras de negócio, contratos, identidade e capacidades dos agentes | `packages/employee-framework`, `packages/agents`, `packages/employees/*` |
| **Runtime** | Orquestração, delegação, execução e composição operacional | `packages/employee-runtime`, `packages/agent-runtime`, `packages/workspace-runtime`, `packages/execution-engine`, `packages/orchestration-engine` |
| **Infraestrutura** | Persistência, contratos transversais, provedores externos | `packages/database`, `packages/memory`, `packages/ai-core`, `packages/shared` |

O **domínio** define *o que* o sistema representa e *quais decisões* são válidas. O **runtime** define *como* missões fluem e ações são executadas. A **infraestrutura** provê *onde* e *com quais recursos* o sistema persiste dados e se conecta ao mundo externo.

A aplicação `apps/api` atua como **composition root** do Digital Office — monta domínio, runtime e infraestrutura no fluxo operacional da Equipe Digital. O pacote `packages/workspace-runtime` atua como camada de composição entre o contexto do Workspace, Agent Runtime, Execution Engine e Orchestration Engine.

---

## 2. Estrutura do Monorepo

O monorepo do OperaIA.lab é organizado em `apps/` (aplicações deployáveis) e `packages/` (módulos de capacidade). Funcionários digitais residem em `packages/employees/`, cada um como pacote independente.

```
operaia-lab/
├── apps/
│   ├── api/                        # Digital Office API (composition root)
│   └── web/                        # Interface do escritório digital
├── packages/
│   ├── shared/                     # Tipos, enums e erros transversais
│   ├── database/                   # Prisma schema, client e migrations
│   ├── ai-core/                    # Contrato e provedores LLM
│   ├── memory/                     # Contrato MemoryStore
│   ├── agents/                     # Opera CEO e definições de agentes
│   ├── agent-runtime/              # Runtime base para execução de agentes
│   ├── workspace-runtime/          # Composição Workspace + Agent/Execution/Orchestration
│   ├── employee-framework/         # Contratos e factory de funcionários
│   ├── employee-runtime/           # Ativação, delegação e mapeamento de ações
│   ├── execution-engine/           # Execução controlada de planos
│   ├── orchestration-engine/       # Orquestração de missões
│   └── employees/                  # Funcionários digitais especializados
│       ├── cto-mag/
│       ├── atlas/
│       ├── aurora/
│       └── ...
└── docs/
    └── engineering-handbook/
```

### `apps/api`

Aplicação Fastify que expõe a **Digital Office API**. É o ponto de entrada HTTP do sistema e o composition root do fluxo operacional da Equipe Digital.

Responsabilidades:

- receber objetivos e missões do usuário;
- montar e injetar dependências entre pacotes;
- expor endpoints de saúde, projetos, tarefas, agentes e operações;
- coordenar o fluxo completo: CEO → orquestração → especialistas → execução → memória.

Cada módulo interno (`src/modules/*`) segue Clean Architecture com camadas `domain`, `application`, `infrastructure` e `routes`.

### `apps/web`

Aplicação de interface do OperaIA.lab (`@operaia/web`). É o front-end do monorepo — camada de experiência do usuário sobre o escritório digital.

Responsabilidades:

- apresentar a interface do escritório digital ao usuário;
- navegar salas, workspaces e superfícies de interação do produto;
- consumir a API quando a experiência exigir dados ou missões do backend.

`apps/web` não é composition root do domínio nem da execução. Não concentra regras de decisão, orquestração ou persistência — essas responsabilidades permanecem em `apps/api` e nos pacotes de runtime/domínio.

### `packages/database`

Camada de persistência baseada em **Prisma**. Isola o acesso ao banco de dados do restante do sistema.

Responsabilidades:

- schema e migrations do banco operacional;
- client singleton reutilizável;
- re-exportação de tipos gerados.

Nenhum pacote de domínio deve importar Prisma diretamente — o acesso passa por repositórios definidos no domínio e implementados na infraestrutura.

### `packages/ai-core`

Contrato e implementações de provedores **LLM** (Large Language Model).

Responsabilidades:

- interface `LLMProvider` como abstração de modelos de linguagem;
- provedores concretos (Gemini, determinístico, fallback);
- stack de observabilidade e composição de provedores.

Agentes e funcionários consomem `ai-core` sem acoplamento a um provedor específico.

### `packages/agents`

Definições de agentes de alto nível, incluindo o **Opera CEO**.

Responsabilidades:

- lógica de análise estratégica e consolidação de resultados;
- gate de delegação e resolução de especialização;
- definições declarativas de agentes (`AgentDefinition`, registry).

O Opera CEO é o agente central: recebe objetivos, decide delegações e consolida resultados finais das missões.

### `packages/agent-runtime`

Runtime base para execução de agentes (`@operaia/agent-runtime`). Orquestra o pipeline de um agente dependendo apenas de contratos (ports) — sem conhecer provedores concretos de LLM, banco ou ferramentas.

Responsabilidades:

- carregar a definição do agente (`AgentLoader`);
- montar contexto e recuperar memória (`MemoryStore`);
- descobrir ferramentas (`ToolProvider`) e construir prompt (`PromptBuilder`);
- selecionar LLM (`LLMSelector`) e gerar resposta;
- propor `actions` a partir da saída do modelo (`ActionParser`).

Posicionamento arquitetural:

```
packages/agents          → define o agente
        ↓
packages/agent-runtime   → executa o pipeline do agente (propõe, não executa ações)
        ↓
packages/execution-engine → executa ações concretas (quando compostas)
```

O Agent Runtime **propõe, não executa**. Devolve `RuntimeResponse` com `output`, plano de raciocínio e `actions` propostas. A execução concreta de ações permanece no Execution Engine, tipicamente composta via `workspace-runtime`.

Dependências do pacote: `@operaia/agents`, `@operaia/ai-core`, `@operaia/memory`.

### `packages/workspace-runtime`

Camada de composição do workspace operacional (`@operaia/workspace-runtime`). É o local autorizado a conhecer implementações concretas do Agent Runtime, do Execution Engine e do Orchestration Engine, conectando-os por adapters.

Responsabilidades:

- representar `Workspace` e `WorkspaceSession` (unidade de trabalho de um agente dentro de um workspace);
- compor Agent Runtime + Execution Engine + Orchestration Engine (`createWorkspaceRuntime`);
- gerenciar workspaces e sessões (`WorkspaceManager`, stores);
- mapear planos entre o pipeline de raciocínio do Agent Runtime e o trabalho executável do Execution Engine.

A partir desta camada, o agente trabalha **dentro de um Workspace** — não sobre um prompt solto. O workspace é o ponto de convergência do contexto operacional; memória, tarefas e documentação ricas continuam em suas camadas respectivas.

```
createWorkspaceRuntime()
        ↓
Agent Runtime  ←→  Orchestration Engine  ←→  Execution Engine
        ↓
Workspace / Session
```

### `packages/employee-framework`

Framework base para funcionários digitais. Define os contratos que todo funcionário deve implementar.

Responsabilidades:

- contrato `Employee` e interface `EmployeeBrain`;
- perfil, briefing, tarefas, decisões e políticas;
- factory e registry para registro de funcionários;
- validação de briefing e modelo de delegação.

É a fundação sobre a qual todos os pacotes em `packages/employees/*` são construídos.

### `packages/employees`

Diretório de funcionários digitais especializados. Cada subdiretório é um pacote independente.

Exemplos atuais:

| Pacote | Papel |
|---|---|
| `cto-mag` | CTO — decisões técnicas e arquiteturais |
| `atlas` | Especialista em domínio específico |
| `aurora`, `luna`, `mercurio`, `nexus`, `orion`, `themis` | Especialistas operacionais |
| `digital-team` | Roster e composição do time digital |
| `specialist-kit` | Kit base para criação de novos especialistas |

Cada funcionário encapsula identidade, perfil, especialização, capacidades e limites — sem dependência direta de outros funcionários.

### `packages/employee-runtime`

Runtime de ativação e delegação de funcionários digitais.

Responsabilidades:

- `EmployeeRunner` — ativa um funcionário dentro de um workspace;
- `DelegationService` — resolve especialidade para funcionário compatível;
- `EmployeeActionMapper` — traduz tarefas de funcionário em ações do Execution Engine;
- `WorkspaceBriefingAdapter` — adapta snapshot do workspace para briefing do funcionário.

É a ponte entre o domínio dos funcionários e a camada de execução.

### `packages/memory`

Contrato de memória operacional (`MemoryStore`).

Responsabilidades:

- interface para registro e consulta de memória (`MemoryRecord`, `MemoryQuery`);
- abstração de busca semântica e RAG;
- desacoplamento entre agentes e implementação de persistência de memória.

Implementações concretas (in-memory, PostgreSQL + pgvector) residem fora deste pacote de contrato.

### `packages/shared`

Tipos, enums e erros compartilhados por todo o monorepo.

Responsabilidades:

- enums de domínio (`ProjectStatus`, `TaskStatus`, `Priority`);
- erros de domínio padronizados;
- tipos utilitários transversais.

`shared` não depende de nenhum outro pacote — é a base da pirâmide de dependências.

---

## 3. Fluxo Arquitetural Oficial

O fluxo completo de uma missão operacional no OperaIA.lab:

```
User
↓
Digital Office API
↓
Opera CEO
↓
Mission Orchestrator
↓
Specialist Employee
↓
Execution Engine
↓
Memory System
↓
Operational Result
```

### User

Define o objetivo operacional. Mantém supervisão sobre missões em andamento e resultados produzidos.

### Digital Office API

Recebe a requisição do usuário, valida entrada e inicia o ciclo de missão. Traduz intenção humana em comando estruturado para o sistema interno.

### Opera CEO

Analisa o objetivo recebido, avalia complexidade e contexto, e decide se a missão deve ser delegada a um especialista. Ao final do ciclo, consolida o resultado em resposta operacional.

### Mission Orchestrator

Coordena a execução da missão delegada. Gerencia fila, contexto, políticas de retry e eventos de orquestração. Garante que cada etapa ocorra na ordem correta com rastreabilidade.

### Specialist Employee

Funcionário digital especializado que recebe a tarefa delegada. Aplica conhecimento de domínio, produz plano de execução e gera ações concretas dentro de seus limites operacionais.

### Execution Engine

Executa o plano produzido pelo especialista. Realiza ações registradas no registry de executores, respeitando políticas e limites definidos.

### Memory System

Persiste contexto, decisões, ações e resultados da missão. Garante continuidade operacional e disponibilidade de histórico para consultas futuras.

### Operational Result

Resultado consolidado retornado ao usuário. Inclui output do especialista, resumo do CEO e registro auditável da missão completa.

---

## 4. Princípios Arquiteturais

### Modular Monolith

Artefato deployável da API (`apps/api`) com fronteiras internas explícitas, mais a aplicação de interface (`apps/web`). A simplicidade operacional (um banco, processo de API coeso) coexiste com organização de código que permite extração futura de módulos sem reescrita de domínio.

### Domain Driven Organization

Cada capacidade pertence a um domínio específico. A estrutura de diretórios reflete limites de negócio e operacionais — não convenções genéricas de framework. Módulos de negócio em `apps/api` e pacotes em `packages/` expressam bounded contexts distintos.

### Runtime Separation

Funcionários, orquestração, execução e infraestrutura possuem pacotes e responsabilidades separadas:

- funcionários e agentes definem *o que* decidir e *quais ações* propor;
- o `employee-runtime` define *como* ativar, delegar e mapear tarefas de employees;
- o `agent-runtime` define *como* executar o pipeline de um agente (contexto → LLM → ações propostas);
- o `workspace-runtime` compõe Agent Runtime, Orchestration e Execution no contexto de um Workspace;
- o execution engine define *como* executar ações;
- a infraestrutura define *onde* persistir e *como* conectar serviços externos.

### Employee Isolation

Cada funcionário digital é um pacote independente em `packages/employees/{employee-name}`. Funcionários não importam uns aos outros. Comunicação ocorre exclusivamente via orquestração e delegação do sistema — nunca por acoplamento direto entre pacotes de funcionários.

### Auditability

Toda operação produz registro rastreável: missão, agente responsável, decisões, ações e resultado. A auditabilidade é requisito de arquitetura, não feature opcional. Logs, eventos de orquestração e registros de memória compõem a trilha de auditoria operacional.

---

## 5. Regras para Novos Módulos

### Funcionários como pacotes independentes

Novos funcionários digitais devem ser criados em `packages/employees/{employee-name}` como pacotes autônomos. Cada pacote implementa os contratos de `@operaia/employee-framework` e é registrado via factory/registry — sem alterar o núcleo do sistema.

Estrutura mínima esperada:

```
packages/employees/{employee-name}/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts          # exports públicos
    ├── profile.ts        # EmployeeProfile
    └── {name}-brain.ts   # EmployeeBrain (opcional)
```

### Núcleo protegido

Alterações em pacotes centrais (`employee-framework`, `agents`, `employee-runtime`, `agent-runtime`, `workspace-runtime`, `execution-engine`, `orchestration-engine`) exigem decisão arquitetural documentada neste Handbook antes da implementação.

Mudanças no núcleo impactam todos os funcionários e o fluxo operacional — devem ser justificadas, revisadas e registradas.

### Respeito aos limites de domínio

Toda nova capacidade deve residir no pacote correto:

| Se a responsabilidade é... | O pacote é... |
|---|---|
| Contrato ou perfil de funcionário | `employee-framework` |
| Lógica de um funcionário específico | `packages/employees/{name}` |
| Ativação, delegação ou mapeamento de employees | `employee-runtime` |
| Pipeline de execução de agente (ports) | `agent-runtime` |
| Composição Workspace + Agent/Execution/Orchestration | `workspace-runtime` |
| Execução de ações | `execution-engine` |
| Orquestração de missões | `orchestration-engine` |
| Análise e consolidação estratégica | `agents` (Opera CEO) |
| Persistência de dados | `database` |
| Memória operacional | `memory` (contrato) |
| Provedores LLM | `ai-core` |
| Tipos e erros compartilhados | `shared` |
| Exposição HTTP e composição do Digital Office | `apps/api` |
| Interface do usuário / experiência do escritório | `apps/web` |

Adicionar lógica de domínio em pacotes de infraestrutura, ou lógica de infraestrutura em pacotes de domínio, viola os limites arquiteturais e deve ser rejeitado em revisão.

---

> **Próximo passo:** novas decisões arquiteturais devem ser registradas neste documento antes de serem implementadas. Consulte a [Development Rule](./README.md#6-development-rule) no README do Handbook.
