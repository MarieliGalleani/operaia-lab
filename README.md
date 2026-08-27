# OperaIA.lab

**Escritório Digital Autônomo baseado em agentes de IA.**

A OperaIA.lab é o ambiente operacional do ecossistema OperaIA: uma organização digital composta por agentes especializados, coordenada por uma camada operacional persistente e executada continuamente.

O sistema não é apenas um conjunto de agentes de IA. O objetivo é criar uma **organização digital capaz de receber demandas, coordenar especialistas, executar missões, registrar evidências e manter seu próprio estado operacional**.

> **Princípio central:** primeiro construir o cérebro operacional; depois expandir as interfaces e capacidades de produto.

---

## Estado atual

A OperaIA.lab encontra-se na fase de consolidação do **CORE operacional autônomo**.

O sistema já possui infraestrutura para:

* organização digital de agentes especializados;
* Employee Framework;
* Digital Office;
* execução de missões;
* Mission Queue persistente;
* Workers permanentes;
* Supervisor Operacional contínuo;
* heartbeat e health checks;
* recuperação operacional;
* memória operacional;
* Domain Signal Layer;
* Source Bridge;
* GitHub Source Bridge;
* persistência em PostgreSQL;
* execução contínua em ambiente de produção;
* auditorias operacionais read-only;
* mecanismos de deduplicação e controle de sinais.

A prioridade atual é **estabilizar, validar e consolidar a autonomia operacional antes de adicionar novas capacidades ou camadas de interface**.

---

# Visão arquitetural

A OperaIA.lab segue uma arquitetura de **Modular Monolith**, organizada por responsabilidades de domínio.

```text
                         ┌───────────────────────┐
                         │      OperaIA.lab      │
                         │   Digital Office      │
                         └───────────┬───────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
             Mission System                    Employee Framework
                    │                                 │
             ┌──────┴──────┐                  ┌──────┴──────┐
             │             │                  │             │
        Mission Queue   Orchestrator       Workers     Specialists
             │             │                  │             │
             └─────────────┴──────────┬───────┴─────────────┘
                                      │
                              Operational Supervisor
                                      │
                         ┌────────────┴────────────┐
                         │                         │
                 Operational Memory        Domain Signal Layer
                                                   │
                                           ┌───────┴────────┐
                                           │                │
                                      Source Bridge   GitHub Bridge
                                           │
                                           ▼
                                      External Sources

                              PostgreSQL
                         Persistent Operational State
```

A arquitetura deve permanecer modular, explícita e orientada a domínio.

---

# Princípios arquiteturais

A OperaIA.lab segue alguns princípios fundamentais.

### 1. CORE antes de interface

A inteligência operacional deve existir independentemente de uma interface gráfica.

Frontend, dashboards e outras interfaces são consumidores do CORE não o contrário.

### 2. Persistência antes de memória efêmera

Estado operacional importante deve ser persistido.

Missões, eventos, sinais, heartbeats e memória operacional não devem depender exclusivamente do processo em memória.

### 3. Agentes não são o sistema

Os agentes são especialistas dentro da organização.

A coordenação, persistência, execução e supervisão pertencem às camadas operacionais.

### 4. Supervisor não toma decisões de negócio

O Supervisor Operacional é responsável por manter o ambiente funcionando.

Ele pode detectar condições operacionais, recuperar componentes e iniciar mecanismos de execução, mas não deve substituir decisões de negócio ou assumir o papel dos especialistas.

### 5. Eventos devem possuir controle operacional

Sinais e eventos precisam de mecanismos de deduplicação, controle de estado e rastreabilidade.

Isso evita loops operacionais, duplicação de missões e crescimento descontrolado da fila.

### 6. Evidência antes de conclusão

Uma operação só deve ser considerada concluída quando houver evidência suficiente de que a transição ou execução realmente ocorreu.

---

# Stack

## Runtime

* TypeScript
* Node.js
* Fastify
* Zod

## Persistência

* PostgreSQL
* Prisma ORM

## IA

* LLM Provider abstraction
* Integração com provedores de modelos
* `@google/genai` / Gemini

## Monorepo

* pnpm Workspaces
* Modular Monolith

## Infraestrutura

* Docker
* Docker Compose
* Linux / Ubuntu
* systemd
* Caddy
* Oracle Cloud

---

# Organização Digital

A OperaIA.lab possui uma organização de especialistas digitais.

Atualmente o roster inclui:

```text
Opera
Mag
Luna
Nexus
Atlas
Aurora
Themis
Mercúrio
Orion
```

Cada especialista possui responsabilidades próprias dentro da organização.

A composição dos agentes não deve ser confundida com a arquitetura operacional: **agentes executam responsabilidades; o CORE coordena a operação.**

---

# Employee Framework

O `@operaia/employee-framework` fornece a base comum para representar e operar os colaboradores digitais.

Responsabilidades incluem conceitos como:

* identidade operacional;
* papel;
* capacidades;
* estado;
* execução;
* heartbeat;
* ciclo de vida do worker.

O framework permite que novos especialistas sejam incorporados sem alterar a estrutura central do sistema.

---

# Mission System

A missão é a unidade operacional de trabalho da OperaIA.lab.

Uma missão possui ciclo de vida próprio e pode gerar eventos, delegações e execuções.

Fluxo conceitual:

```text
Demand
  │
  ▼
Mission
  │
  ▼
Planning
  │
  ▼
Ready
  │
  ▼
Execution
  │
  ▼
Delivery
  │
  ▼
Evidence
```

O sistema deve evitar que uma etapa seja considerada concluída apenas pela intenção de execução.

---

# Mission Queue

A Mission Queue fornece persistência para o trabalho operacional.

Ela permite que missões aguardem execução independentemente do ciclo de vida de um processo individual.

Conceitos principais:

* fila persistente;
* estados de missão;
* eventos;
* workers;
* retry/recovery;
* controle de execução;
* rastreabilidade.

A fila é persistida no PostgreSQL.

---

# Workers Permanentes

Os especialistas digitais são executados por workers persistentes.

Os workers possuem mecanismos de:

* heartbeat;
* health check;
* graceful shutdown;
* recuperação;
* identificação de estado;
* execução de trabalho operacional.

O objetivo é que a organização permaneça disponível continuamente, e não apenas enquanto uma execução manual estiver acontecendo.

---

# Operational Supervisor

O Supervisor Operacional mantém o Digital Office funcionando continuamente.

Responsabilidades:

```text
Supervisor
   │
   ├── verifica estado operacional
   ├── monitora workers
   ├── verifica condições de recuperação
   ├── observa sinais
   ├── aciona mecanismos de execução
   └── mantém o runtime operacional
```

O Supervisor **não é um CEO de negócio**.

Ele é uma camada de infraestrutura operacional.

Decisões de negócio permanecem nas camadas responsáveis pela coordenação e pelos especialistas.

---

# Operational Memory

A memória operacional registra informações derivadas da operação da organização.

A memória possui ciclo de vida controlado:

```text
Active
  │
  ▼
Expired
  │
  ▼
Archived
```

A memória não deve crescer indefinidamente.

Por isso existem mecanismos de:

* TTL;
* quota;
* expiração;
* arquivamento;
* derivação a partir do histórico operacional.

---

# Domain Signal Layer

A Domain Signal Layer permite transformar mudanças relevantes do domínio em sinais operacionais.

Fluxo conceitual:

```text
Domain Change
      │
      ▼
Domain Signal
      │
      ▼
Source Bridge
      │
      ▼
Operational Decision
      │
      ▼
Mission
```

O objetivo é desacoplar a origem de uma mudança da forma como a organização reage a ela.

---

# Source Bridge

O Source Bridge fornece um contrato para integração com fontes externas.

A arquitetura permite que diferentes fontes sejam conectadas ao CORE sem acoplar a lógica de negócio diretamente ao provedor.

Atualmente existe implementação para:

```text
SourceBridge
      │
      └── GitHub Source Bridge
```

A expansão para outras fontes deve respeitar o mesmo contrato arquitetural.

---

# GitHub Bridge

O GitHub Source Bridge conecta o CORE operacional às informações relevantes provenientes do GitHub.

A responsabilidade do Bridge é traduzir informações da fonte externa para o modelo de sinais utilizado pela OperaIA.lab.

Ele não deve conter regras de negócio que pertençam ao CORE.

---

# Persistência

O PostgreSQL é a fonte persistente do estado operacional.

Entre os principais conceitos persistidos estão:

* missions;
* mission events;
* worker heartbeats;
* schedule rules;
* operational memory;
* domain signals;
* workspace/source bindings.

O banco é parte fundamental da continuidade operacional do sistema.

---

# Estrutura do monorepo

A estrutura pode evoluir conforme o CORE amadurece, mas segue a separação por responsabilidade:

```text
apps/
  api/                         # API e runtime operacional

packages/
  shared/                      # contratos e conceitos compartilhados
  database/                    # Prisma, schema e migrations
  employee-framework/          # framework dos colaboradores digitais
  digital-team/                # roster da organização
  ai-core/                     # abstração de provedores de IA
  agents/                      # agentes e responsabilidades
  memory/                      # abstrações de memória
  ...

infra/
  ...                          # infraestrutura e deployment

docs/
  ...                          # documentação arquitetural e operacional
```

> A estrutura exata dos pacotes deve ser considerada a fonte de verdade do repositório. Este README apresenta a visão arquitetural, não substitui a árvore real do código.

---

# Desenvolvimento

## Pré-requisitos

* Node.js >= 20
* pnpm >= 9
* Docker
* PostgreSQL

## Instalação

```bash
pnpm install
```

Configure o ambiente conforme o `.env.example` e as necessidades do ambiente.

## Banco de dados

```bash
pnpm db:generate
pnpm db:migrate
```

Quando aplicável:

```bash
pnpm db:seed
```

## Desenvolvimento

```bash
pnpm dev
```

---

# Validação

Antes de considerar uma alteração pronta, o projeto deve passar pelas validações apropriadas.

### TypeScript

```bash
pnpm typecheck
```

### Testes

```bash
pnpm test
```

### Prisma

```bash
pnpm prisma validate
pnpm prisma generate
```

As validações específicas de cada fase podem incluir auditorias read-only, testes de integração, verificações de runtime e validações de produção.

---

# Operação em produção

A OperaIA.lab foi projetada para execução contínua.

O ambiente de produção possui:

```text
Internet
   │
   ▼
Caddy
   │
   ▼
OperaIA.lab
   │
   ├── API
   ├── Supervisor
   ├── Workers
   └── Mission Runtime
            │
            ▼
       PostgreSQL
```

O runtime deve ser tratado como uma organização operacional contínua, e não como uma aplicação que precisa ser iniciada manualmente para cada tarefa.

---

# Observabilidade operacional

A operação deve ser verificável através de evidências.

Entre os sinais importantes estão:

* estado dos workers;
* heartbeats;
* estado das missões;
* eventos de missão;
* sinais de domínio;
* saúde da API;
* estado do banco;
* reinicializações do processo;
* falhas e retries;
* crescimento anormal da fila.

Quando houver divergência entre o comportamento esperado e o comportamento observado, a primeira etapa deve ser **diagnóstico read-only**.

---

# Segurança operacional

Alterações em produção devem ser controladas.

Princípios:

* não alterar produção durante diagnóstico read-only;
* não modificar migrations sem necessidade;
* não alterar `.env` sem justificativa;
* preservar evidências;
* validar antes de reiniciar;
* confirmar o commit efetivamente executado;
* verificar o estado do runtime após deploy;
* evitar mudanças estruturais fora do escopo da fase.

---

# O que NÃO faz parte do CORE neste momento

A existência de uma capacidade futura não significa que ela deva ser implementada imediatamente.

Enquanto o CORE estiver em consolidação, devem ser evitados:

* criação indiscriminada de novos agentes;
* novas abstrações sem necessidade;
* mudanças estruturais de arquitetura;
* criação de UI apenas para mascarar ausência de capacidade operacional;
* expansão prematura para novos domínios;
* funcionalidades sem necessidade operacional comprovada.

A prioridade é:

```text
Estabilidade
     ↓
Observabilidade
     ↓
Autonomia
     ↓
Confiabilidade
     ↓
Expansão
```

---

# Documentação

A documentação oficial deve ser organizada por responsabilidade.

Documentos fundamentais:

* `docs/product-overview.md` — visão do produto;
* `docs/architecture.md` — arquitetura;
* `docs/roadmap.md` — evolução planejada;
* ADRs — decisões arquiteturais;
* documentação operacional — procedimentos de runtime, deploy e auditoria.

> ADRs e documentação específica de cada subsistema têm precedência sobre descrições resumidas deste README.

---

# Filosofia do projeto

A OperaIA.lab não pretende ser apenas um chatbot com vários agentes.

A proposta é construir uma **organização digital operacional**.

```text
             HUMAN
               │
               ▼
             DEMAND
               │
               ▼
        DIGITAL OFFICE
               │
        ┌──────┴──────┐
        ▼             ▼
   COORDINATION    MEMORY
        │
        ▼
      MISSION
        │
        ▼
      WORKERS
        │
        ▼
    SPECIALISTS
        │
        ▼
     DELIVERY
        │
        ▼
      EVIDENCE
```

O valor do sistema está na capacidade de transformar intenção em trabalho coordenado, persistente e verificável.

---

# Status

**OperaIA.lab — CORE operacional em consolidação.**

A infraestrutura fundamental para execução autônoma já existe.

O foco atual é eliminar fragilidades operacionais, validar transições de estado, garantir rastreabilidade e consolidar o comportamento contínuo da organização antes de ampliar o escopo.

**Não estamos apenas construindo agentes. Estamos construindo o escritório onde eles trabalham.**
