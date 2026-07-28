# 06 — Digital Office

> Parte 7 do [OperaIA Engineering Handbook](./README.md)

Este documento registra oficialmente o conceito de **Digital Office** do OperaIA.lab — sua composição, responsabilidades, ciclo operacional e relação com projetos executados no escritório digital.

---

## 1. Visão Geral

O **Digital Office** é a camada organizacional do OperaIA.lab. Não é apenas uma interface — é uma **estrutura operacional** onde funcionários digitais, missões, memória e execução trabalham de forma integrada sob supervisão humana.

O usuário não interage com engines isolados. Interage com um escritório digital que recebe objetivos, ativa a equipe, orquestra operações e devolve resultados rastreáveis.

### Visão do fluxo

```
Usuário
↓
Digital Office
↓
Funcionários Digitais
↓
Operações
↓
Resultados
```

### Papel na arquitetura

| Camada | Responsabilidade |
|---|---|
| **Digital Office** | Organização, composição e entrada operacional |
| **Funcionários Digitais** | Análise, especialização e decisão |
| **Operações** | Orquestração, execução e memória |
| **Resultados** | Consolidação auditável para o usuário |

O Digital Office é o ponto onde a infraestrutura técnica se manifesta como **empresa digital operacional**.

---

## 2. Conceito de Escritório Digital

O Digital Office representa o ambiente no qual a equipe digital trabalha. Consolida cinco dimensões:

| Dimensão | Descrição |
|---|---|
| **ambiente operacional** | Espaço onde objetivos viram missões e missões viram resultados |
| **composição de equipe** | Roster de funcionários registrados e disponíveis |
| **contexto de trabalho** | Workspaces com projetos, tarefas e memória relacionada |
| **acompanhamento de missões** | Registro operacional (`OperationalRun`) e status do ciclo |
| **supervisão humana** | Direção estratégica e responsabilidade final do usuário |

### Aplicativo tradicional vs escritório digital inteligente

| Aplicativo tradicional | Escritório digital inteligente |
|---|---|
| Usuário aciona features isoladas | Usuário define objetivos operacionais |
| Fluxos rígidos pré-programados | Análise, delegação e execução orquestradas |
| Dados sem continuidade decisória | Memória operacional entre missões |
| Automações pontuais | Organização digital com papéis e limites |
| Interface = produto | Interface + equipe + runtime = produto |

No OperaIA.lab, a experiência correta não é "usar um chatbot". É **operar um escritório onde a IA trabalha** — com identidade, especialização, rastreabilidade e consolidação.

---

## 3. Digital Office API

A aplicação `apps/api` expõe a **Digital Office API** e atua como **composition root** do sistema.

### Responsabilidades

- **entrada de solicitações** — receber objetivos e perguntas do usuário via HTTP;
- **criação de missões** — iniciar ciclos operacionais assistidos (`OperationalMissionService`);
- **consulta de funcionários** — listar perfis e status a partir do registry;
- **acompanhamento operacional** — consultar `OperationalRun`, workflow e resultados;
- **composição do runtime** — montar `DigitalOffice` (registry, runner, matcher, delegation) e ligar memória, execução e workspaces.

### Composition Root

```
createDigitalOffice({ llm })
        ↓
registry (digital-team) + runner + matcher + delegation
        ↓
MissionOrchestrator + OperationalMissionService
        ↓
Digital Office API (endpoints)
```

`createDigitalOffice` é o único lugar autorizado na API a montar o `EmployeeRegistry` e ligar `EmployeeRunner`, `EmployeeMatcher` e `DelegationService`.

Contratar um novo funcionário = pacote + entrada no roster (`@operaia/digital-team`). O composition root **não muda**.

A API não decide estratégia — ela **compõe** o escritório e **expõe** o ciclo operacional.

---

## 4. Workspace

Um **Workspace** é o contexto operacional no qual missões acontecem. Toda operação no Digital Office ocorre dentro de um workspace.

### O que um workspace representa

| Elemento | Descrição |
|---|---|
| **contexto operacional** | Identidade, objetivo e status do ambiente de trabalho |
| **projetos** | Iniciativas vinculadas (`projectId` no domínio de persistência) |
| **tarefas** | Pendências e progresso (`EmployeeTask[]`) |
| **memória relacionada** | Registros filtráveis por `workspaceId` |
| **funcionários disponíveis** | Time associado (`teamIds`) a partir do roster |

### Modelo na API

```
OfficeWorkspaceRecord
├── id (público: slug ou UUID)
├── projectId (id real no domínio)
├── name, objective, status, progress
├── teamIds
└── tasks
```

A porta `WorkspaceSource` carrega workspaces reais (Project + Task) e produz `WorkspaceSnapshot` para briefing. O `MissionOrchestrator` não conhece a porta — recebe apenas o snapshot.

### Regra de contexto

Operações **sempre** acontecem dentro de um contexto. Missão sem workspace é inválida arquiteturalmente: não há briefing coerente, memória filtrável nem rastreabilidade de origem.

---

## 5. Composição do Escritório

A composição do Digital Office define quem está na equipe e como o runtime os ativa.

### Elementos da composição

| Elemento | Papel |
|---|---|
| **Employee Registry** | Catálogo oficial de funcionários ativos |
| **funcionários ativos** | Entradas do roster `DIGITAL_TEAM_EMPLOYEES` |
| **capacidades disponíveis** | `capabilities` e `permissions` declaradas nos perfis |
| **especializações** | Rótulos de domínio usados pelo Matcher |

### Fluxo de composição

```
Workspace
↓
Digital Team
↓
Employee Registry
↓
Runtime Activation
```

**Workspace** — define o contexto e o time associado (`teamIds`).

**Digital Team** — roster oficial em `@operaia/digital-team`. Fonte única de quem pode ser contratado/ativado.

**Employee Registry** — registro preenchido por `registerDigitalTeam()`. Discovery e matching consultam apenas o registry.

**Runtime Activation** — `EmployeeRunner` ativa funcionários com briefing do workspace; `DelegationService` resolve especialistas sob demanda.

A composição é **declarativa e centralizada**. Funcionários não se auto-registram em runtime ad hoc; entram pelo roster e são montados no composition root.

---

## 6. Ciclo Operacional

Ciclo oficial de uma operação no Digital Office:

1. **Usuário cria objetivo** — define o que precisa ser alcançado no workspace.
2. **Escritório recebe solicitação** — Digital Office API valida entrada e carrega contexto (`WorkspaceSource` + memória).
3. **Opera analisa** — CEO processa objetivo, contexto e aplica CEO Gate.
4. **Especialista é acionado** — Matcher resolve especialização; runtime ativa o funcionário compatível.
5. **Execução acontece** — plano de ações passa pelo Execution Engine sob políticas.
6. **Memória é atualizada** — resumo operacional e metadados são persistidos via `MemoryStore`.
7. **Resultado retorna** — Opera consolida; usuário recebe resposta utilizável e registro auditável.

```
Objetivo → API → CEO → Delegação → Execução → Memória → Resultado
```

Esse ciclo é o mesmo fluxo documentado em Mission Orchestration e Runtime and Execution — aqui visto pela lente organizacional do escritório digital.

---

## 7. Supervisão Humana

O Digital Office automatiza operação, mas **não remove responsabilidade humana**.

### Princípios de supervisão

- **decisões estratégicas permanecem supervisionadas** — o usuário define direção e objetivos;
- **sistema automatiza operações** — análise, delegação, execução e consolidação fluem sem intervenção manual em cada passo;
- **ações críticas precisam de rastreabilidade** — toda missão produz `OperationalRun` auditável;
- **humano permanece responsável pela direção** — o escritório executa sob mandato humano, não em autonomia absoluta.

### Human Oversight

```
Humano: "o que e por quê"
Digital Office: "como operar"
```

A supervisão humana é requisito arquitetural — alinhado ao princípio de Human Oversight do Handbook. Automação sem rastreabilidade e sem direção humana viola o modelo do OperaIA.lab.

---

## 8. Relação com NEXO

A **NEXO** é um projeto real executado pelo Digital Office — não um módulo paralelo nem um produto separado da infraestrutura.

### Papel do Digital Office

O Digital Office é a **infraestrutura operacional** que permite executar projetos como a NEXO. O projeto fornece contexto (workspace, tarefas, objetivo); o escritório fornece equipe, orquestração, execução e memória.

### Projetos como clientes internos

Projetos são **clientes internos** do escritório digital:

| Papel | Responsabilidade |
|---|---|
| **Projeto (ex.: NEXO)** | Demanda operacional, tarefas e progresso |
| **Digital Office** | Equipe, missões, execução e consolidação |
| **Usuário** | Direção estratégica e supervisão |

Missões de validação históricas do sistema usam o workspace NEXO (ex.: *"Quero adicionar autenticação ao NEXO."*) precisamente porque o escritório precisa operar sobre um contexto real — não sobre dados simulados em produção.

Novos projetos entram no mesmo modelo: workspace + equipe + missões. O Digital Office não é construído para um único projeto; NEXO valida e consome a infraestrutura.

---

## 9. Arquitetura Futura

Visão arquitetural futura do Digital Office (sem implementação neste documento):

### Múltiplos workspaces

Operação simultânea de vários contextos (projetos) no mesmo escritório, com isolamento de memória e tarefas por `workspaceId`.

### Múltiplas organizações

Composição de equipes e regras por organização — roster e políticas parametrizados além do tenant único atual.

### Ambientes isolados

Separação explícita entre ambientes (dev, test, prod) e, futuramente, sandboxes por workspace ou cliente — sem contaminação de memória ou execução.

### Expansão multi-tenant

Evolução para multi-tenant completo: identidade organizacional, quotas, isolamento de dados e composição independente por tenant — preservando o mesmo modelo de Digital Office, Registry e Runtime.

```
Digital Office (núcleo estável)
        ↓
Workspaces N  →  Organizations M  →  Tenants T
```

Regra: expandir escopo **sem** quebrar composition root, contratos de employee nem fluxo de missão.

---

## 10. Regras Arquiteturais

### Todo trabalho deve possuir contexto

Missões exigem workspace. Objetivo sem contexto operacional não entra no ciclo do Digital Office.

### Funcionários operam dentro de workspaces

Ativação ocorre via briefing derivado do workspace. Employees não operam em vácuo nem com estado global implícito.

### Missões precisam ser rastreáveis

Toda operação produz registro (`OperationalRun`) com participantes, ações, resultado e timing. Trabalho invisível é inválido.

### Composição acontece via runtime

Registry, runner, matcher e delegation são montados no composition root (`createDigitalOffice`). Composição ad hoc fora desse ponto viola a arquitetura.

### Decisões estratégicas não ficam espalhadas pelo sistema

Análise, delegação e consolidação permanecem no Opera CEO. API, runtime e engine coordenam e executam — não substituem julgamento estratégico.

---

> **Referências:** [02 — Agent System](./02-agent-system.md) · [03 — Mission Orchestration](./03-mission-orchestration.md) · [05 — Memory System](./05-memory-system.md) · [01 — Architecture](./01-architecture.md)
