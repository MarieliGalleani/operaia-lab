# 03 — Mission Orchestration

> Parte 4 do [OperaIA Engineering Handbook](./README.md)

Este documento registra oficialmente como missões são criadas, analisadas, delegadas, executadas e consolidadas dentro do **OperaIA.lab**.

**ADR oficial:** [`ADR-007 — Consolidação do Mission System`](../architecture/adr/ADR-007-mission-system-consolidation.md).

---

## 0. Mission System oficial (Fase 0 — ADR-007)

### Fonte da verdade

O **Mission System oficial** do OperaIA.lab é baseado em **`MissionQueue`** (persistência Prisma + Continuous Runtime + `QueuedMissionExecutor`).

Uma **Mission oficial** segue:

```
COORDINATE
    ↓
Opera
    ↓
Delegation
    ↓
Matcher
    ↓
EXECUTE
    ↓
CONSOLIDATE
    ↓
Execution
    ↓
Memory
```

| Kind | Regra |
|---|---|
| **COORDINATE** | Entrada oficial; `ownerEmployeeId` = Opera (`operaia-ceo`) |
| **EXECUTE** | Só nasce **após** delegação da Opera; tem `parentMissionId` |
| **CONSOLIDATE** | Criado pela fila após filhos terminarem; owner Opera |

### Assisted Execution (não é Mission oficial)

O fluxo síncrono `OperationalMissionService` + `MissionOrchestrator` + `OperationalRun` é **Assisted Execution legado** (Path A). **Não** define o contrato de Mission do produto.

**Unified Mission Gateway (Fase 1):** com `ASSISTED_QUEUE_MODE=true` (default de produto), `POST /employees/:id/ask` e `POST /operations/missions` usam a **Mission Queue** (`runViaQueue`). Path A permanece apenas como **kill-switch** (`ASSISTED_QUEUE_MODE=false`) e testes isolados sem fila.

| Modo | Flag | Motor |
|------|------|-------|
| Oficial (default) | `ASSISTED_QUEUE_MODE=true` | MissionQueue → workers → projector |
| Legado temporário | `ASSISTED_QUEUE_MODE=false` | MissionOrchestrator sync |

**Prova operacional do ciclo oficial:** [`operational-cycle-proof.md`](../architecture/operational-cycle-proof.md) (`ops:operational-cycle-proof`). Valida boot do Continuous Runtime, workers, Supervisor, eventos, `resultJson` e COMPLETED via `POST /employees/:id/ask` e `POST /operations/missions`. Memória permanece fora de escopo dessa prova.

### Produtores autorizados de COORDINATE

- Operational Supervisor (sinais operacionais);
- HTTP Runtime (`POST` missions na fila), com owner forçado Opera;
- Planejamento sob demanda da Opera (não como fallback do Supervisor).

HTTP **externo** não cria `EXECUTE` nem `CONSOLIDATE`.

---

## 1. Visão Geral

**Mission Orchestration** é o fluxo central que transforma objetivos humanos em operações executáveis. É o mecanismo que conecta intenção, análise, delegação, execução e resultado em um ciclo rastreável e auditável.

O OperaIA.lab **não executa diretamente uma intenção**. Antes de qualquer ação concreta, o sistema passa por etapas obrigatórias:

1. **análise** — interpretar o objetivo e o contexto do workspace;
2. **planejamento** — decidir se a missão requer especialista e qual especialização;
3. **delegação** — resolver especialidade para funcionário compatível;
4. **execução** — produzir e executar plano de ações dentro de limites;
5. **consolidação** — integrar resultados em resposta operacional;
6. **rastreabilidade** — registrar decisões, ações e resultados em histórico auditável.

Essa sequência garante que toda operação seja previsível, supervisionável e reversível em auditoria — não uma resposta ad hoc de um modelo de linguagem.

---

## 2. Conceito de Missão

Uma **missão** é a unidade operacional fundamental do OperaIA.lab. Representa um ciclo completo desde o objetivo do usuário até o resultado consolidado.

### Componentes de uma missão

| Componente | Descrição |
|---|---|
| **objetivo** | Intenção declarada pelo usuário — o que deve ser alcançado |
| **contexto** | Estado operacional no momento da missão (tarefas, prioridades, pendências) |
| **workspace** | Ambiente de trabalho associado — identificador, nome e snapshot de tarefas |
| **participantes** | Funcionários digitais envolvidos (CEO, especialistas) |
| **decisões** | Análises e escolhas produzidas em cada etapa (`EmployeeDecision`, delegações) |
| **ações** | Unidades executáveis mapeadas no Execution Engine (`Action`, `ExecutionPlan`) |
| **resultado** | Output consolidado entregue ao usuário (`OperationalResult`, `usableResult`) |
| **histórico** | Registro temporal de eventos, ciclos e transições de status |

### Ciclo de vida

#### Mission oficial (`MissionQueue`)

Estados da fila persistente:

```
QUEUED → RUNNING → [WAITING] → COMPLETED | FAILED
```

Kinds: `COORDINATE` | `EXECUTE` | `CONSOLIDATE`. Readiness: `READY` | `BLOCKED`.

(`CREATED` / `CANCELLED` existem no schema; o fluxo oficial cria entradas em `QUEUED`.)

#### Assisted Execution / motores genéricos

O `OrchestrationEngine` (package) e o `OperationalRun` (Assisted) possuem ciclos próprios — **não** substituem o ciclo da `MissionQueue`.

---

## 3. Mission Orchestrator e fila oficial

### Mission System oficial — fila

No Digital Office contínuo, a coordenação concreta é:

- **`MissionQueue`** — persistência e estados;
- **`QueuedMissionExecutor`** — fases COORDINATE / EXECUTE / CONSOLIDATE;
- **Workers** — claim por owner (Opera) ou `requiredSpecialization`.

O pacote `packages/orchestration-engine` fornece um motor de loop **genérico**; ele **não** é a fonte da verdade da Mission oficial.

### Assisted Execution — `MissionOrchestrator`

O **`MissionOrchestrator`** (`apps/api`) coordena o fluxo **síncrono** assistido: Opera → `DelegationService` → plan → engine → consolidação. Útil para lab/operations HTTP; **não** substitui a `MissionQueue` como Mission oficial (ADR-007).

### Papel do `packages/orchestration-engine`

O `OrchestrationEngine` é descrito como o **sistema nervoso** do OperaIA.lab. Coordena o ciclo de vida de um objetivo acionando Runtime e Execution Engine através de ports — sem conhecer implementações concretas nem agentes específicos.

### Responsabilidades

- **coordenar fluxo da missão** — executar o loop de orquestração (`OrchestrationLoop`) do objetivo ao resultado;
- **controlar etapas** — gerenciar transições de status (`CREATED`, `RUNNING`, `COMPLETED`, `FAILED`, etc.);
- **manter contexto** — preservar `OrchestrationContext` (objetivo, metadata, signal) ao longo dos ciclos;
- **registrar eventos** — publicar eventos de orquestração (`LOOP_STARTED`, `CYCLE_STARTED`, `EXECUTION_COMPLETED`, `OBJECTIVE_COMPLETED`, etc.);
- **garantir ordem operacional** — aplicar políticas de loop, retry e stop antes de avançar etapas.

### O que o orchestrator não faz

O orchestrator **não decide estratégia**. Ele coordena — aciona runtime, aguarda execução, persiste estado e emite eventos. Decisões de análise, delegação e consolidação pertencem ao Opera CEO e aos especialistas, não ao motor de orquestração.

```
OrchestrationEngine: coordena
Opera CEO: decide
Specialist Employee: especializa
Execution Engine: executa
```

---

## 4. CEO Gate

O **CEO Gate** (`ceo-delegation-gate`) é o mecanismo de decisão da Opera que determina se uma missão exige delegação a um especialista ou pode ser respondida diretamente pelo CEO.

### Responsabilidades

- **analisar objetivo** — interpretar a intenção do usuário e classificar o tipo de pedido;
- **verificar contexto** — considerar tarefas pendentes, estado do workspace e plano estratégico;
- **avaliar necessidade de especialista** — identificar se o objetivo requer execução técnica, operacional ou de domínio especializado;
- **decidir delegação** — retornar `true` (delegar via Matcher) ou `false` (resposta imediata da Opera).

### Fluxo de decisão

```
Objetivo recebido
↓
CEO Analysis
↓
Delegar ou responder diretamente
```

### Critérios de delegação

O gate aplica heurísticas determinísticas para classificar o objetivo:

| Tipo | Comportamento |
|---|---|
| **Consultivo** | Status, resumo, overview — Opera responde diretamente |
| **Técnico** | Implementação, código, API, deploy — delega a especialista |
| **Execução** | Finalizar, entregar, avançar, construir — delega a especialista |
| **Lançamento amplo** | Go-live, release, publicação — delegação multi-especialidade |

Pedidos consultivos sem componente de execução seguem o **caminho rápido** — Opera responde sem acionar especialista nem consolidação adicional.

---

## 5. Delegation Flow

A delegação é o mecanismo que conecta a decisão estratégica do CEO à execução especializada. Ocorre exclusivamente por **especialização** — nunca por chamada direta entre agentes.

### Fluxo oficial

```
Opera CEO
↓
Employee Matcher
↓
Specialization Resolution
↓
Specialist Employee
↓
Mission Execution
```

### Etapas

**Opera CEO** — Após análise, produz `DelegationRequest` com a `Specialization` necessária, tarefa e motivo. Nunca referencia outro funcionário por nome ou id.

**Employee Matcher** — Consulta o `EmployeeRegistry` e resolve a especialidade para o funcionário compatível. A resolução de "quem executa" vive fora do domínio dos funcionários.

**Specialization Resolution** — O matcher retorna `RegisteredEmployee` cujo `profile.specialization` corresponde ao pedido. Se nenhum compatível existir, a delegação é registrada como `matched: false`.

**Specialist Employee** — Ativado via `EmployeeRunner` com briefing focado na tarefa delegada. Seu `EmployeeBrain` processa o contexto e produz decisão com plano de execução.

**Mission Execution** — O plano é mapeado em ações, executado pelo Execution Engine e o resultado retorna ao fluxo de consolidação.

### Princípio de desacoplamento

A delegação ocorre por **especialização e capacidades**, não por chamada direta entre agentes. O CEO informa *o que precisa* (especialidade); o sistema resolve *quem faz* (matcher + registry). Funcionários não escolhem outros funcionários.

---

## 6. Employee Matcher

O `EmployeeMatcher` (`packages/employee-runtime`) resolve especialidades em funcionários concretos. Desacopla o CEO dos funcionários específicos — o CEO nunca precisa conhecer quem está disponível no roster.

### Critérios de resolução

| Critério | Descrição |
|---|---|
| **specialization** | Critério primário. O matcher filtra o registry por `profile.specialization === requestedSpecialization` |
| **capabilities** | Metadados declarados no perfil. Usados para documentação e validação de políticas — não para matching dinâmico |
| **disponibilidade** | Funcionário deve estar registrado no `EmployeeRegistry` e presente no roster ativo (`DIGITAL_TEAM_EMPLOYEES`) |
| **compatibilidade da missão** | O especialista recebe briefing focado na tarefa delegada; limites do perfil são respeitados pelo runtime |

### API de resolução

- `match(specialization)` — retorna o primeiro funcionário compatível;
- `matchAll(specialization)` — retorna todos os funcionários compatíveis.

### Desacoplamento

O matcher garante que adicionar ou remover funcionários do roster não exija alteração no CEO, no Orchestrator ou no Framework. Contratar um especialista = criar pacote + registrar no roster. O matcher passa a encontrá-lo automaticamente.

---

## 7. Execution Plan

Especialistas **não executam ações arbitrárias**. Eles produzem decisões estruturadas que são convertidas em planos de execução formais antes de qualquer ação concreta.

### Do domínio à execução

```
EmployeeDecision (especialista)
        ↓
EmployeeActionMapper
        ↓
ExecutionPlan (Execution Engine)
        ↓
Action[] → Executors
```

### Componentes de um plano

| Componente | Descrição |
|---|---|
| **ações** | Lista ordenada de unidades executáveis (`Action[]`) |
| **tipo de ação** | Identificador do executor (`CREATE_TASK`, `UPDATE_TASK`, `LOG`, etc.) — extensível sem alterar o núcleo |
| **contexto necessário** | Payload com dados requeridos pelo executor (`payload: Record<string, unknown>`) |
| **limites** | Restrições do especialista e políticas do Execution Engine aplicadas antes da execução |
| **resultado esperado** | Output normalizado por executor (`NormalizedActionResult`) |

### Contrato do ExecutionPlan

```typescript
interface ExecutionPlan {
  readonly id: UUID;
  readonly actions: readonly Action[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}
```

Cada `Action` possui `id`, `type`, `description`, `payload`, `priority` e `status`. O Engine processa ações em ordem, respeitando o registry de executores e políticas de execução.

O plano do Execution Engine representa **trabalho executável** — distinto do plano de raciocínio do agent-runtime. A conversão entre os dois é responsabilidade da camada de orquestração.

---

## 8. Operational Run (Assisted Execution)

O **Operational Run** é o registro ponta a ponta da **execução assistida** síncrona — não a fonte da verdade da Mission oficial na fila. Implementado como `OperationalRun` em `apps/api`.

Na migração ADR-007, `OperationalRun` tende a tornar-se projeção/compat a partir da `MissionQueue`.

### Campos do registro

| Campo | Descrição |
|---|---|
| **missionId** | Identificador único da missão (`id`) |
| **status** | Estado final da operação (`completed`, etc.) |
| **histórico** | Sequência de eventos, decisões e transições |
| **agentes envolvidos** | CEO e especialistas que participaram (`employeeId`, `outcomes`) |
| **ações executadas** | Plano e resultados normalizados (`execution.audit`) |
| **resultados** | Resposta consolidada, workflow e texto utilizável (`usableResult`) |

### Estrutura do OperationalRun

```
OperationalRun
├── id, status, workspaceId, objective
├── startedAt, finishedAt
├── mission (MissionResult)
│   ├── initial (CEO)
│   ├── outcomes (delegações)
│   ├── final (consolidação)
│   ├── executionPlan + executionResult
│   └── timing (ceoMs, specialistMs, consolidationMs)
├── reply (EmployeeReplyPayload)
├── workflow (WorkflowPayload)
├── llmEvents (auditoria LLM)
├── gaps (lacunas operacionais)
├── execution (OperationalExecutionAudit)
└── usableResult (texto para o usuário)
```

### Importância da auditoria

O registro operacional não é log de debug — é **artefato de arquitetura**. Permite:

- reconstruir o que aconteceu em qualquer missão;
- identificar lacunas operacionais (`OperationalGap`);
- medir performance por fase (`timing`);
- validar conformidade com limites e políticas;
- alimentar memória operacional para missões futuras.

Toda missão concluída deve produzir um `OperationalRun` completo.

---

## 9. Memory Integration

A memória operacional participa do ciclo de missão em três momentos, através do contrato `MemoryStore` (`packages/memory`).

### Antes — recuperar contexto existente

Antes da análise do CEO, o sistema consulta memória por objetivo e workspace:

```
loadMissionMemoryNotes(memory, { workspaceId, objective })
```

Notas relevantes são injetadas no `EmployeeContext.memoryNotes`, enriquecendo o briefing dos funcionários com histórico operacional.

### Durante — fornecer informações relevantes

Contexto de memória acompanha o funcionário ao longo da execução. Decisões do CEO e especialistas consideram registros anteriores do mesmo workspace — continuidade operacional, não sessão isolada.

### Depois — persistir decisões e resultados

Ao concluir a missão, o resumo operacional é persistido:

```
persistMissionMemory(memory, { workspaceId, missionId, objective, summary })
```

O registro inclui workspace, objetivo, resumo e metadata (`kind: "operational-run-summary"`) — disponível para buscas futuras.

### Desacoplamento

Employees não acessam memória diretamente. A integração ocorre na camada de orquestração via portas (`loadMissionMemoryNotes`, `persistMissionMemory`), respeitando o contrato `MemoryStore` sem acoplar funcionários à infraestrutura.

---

## 10. Fluxo Completo

### Fluxo oficial (MissionQueue)

```
Mission (COORDINATE)
 ↓
Opera
 ↓
Delegation
 ↓
Employee Matcher / claim
 ↓
EXECUTE (Employee)
 ↓
CONSOLIDATE (Opera)
 ↓
Execution Engine
 ↓
Result + Memory
```

Entradas típicas: HTTP Runtime, Operational Supervisor, planning da Opera.

### Assisted Execution (legado / lab)

```
User / Operations API
 ↓
OperationalMissionService
 ↓
Mission Orchestrator (sync)
 ↓
Opera → Matcher → Specialist → Execution → OperationalRun + Memory
```

Não confundir Assisted Execution com Mission oficial.

---

## 11. Regras Arquiteturais

### Mission oficial passa pela MissionQueue

Toda Mission de produto é persistida na fila. Assisted Execution não redefine o contrato (ADR-007).

### COORDINATE sempre pertence à Opera

`ownerEmployeeId` de COORDINATE / CONSOLIDATE = Opera. Employee direto na raiz não é Mission oficial.

### EXECUTE só após delegação

HTTP externo e o Supervisor **não** criam EXECUTE/CONSOLIDATE. Filhos nascem no fluxo pós-decisão da Opera.

### Funcionários não chamam outros funcionários

Delegação via specialization + Matcher / claim. Sem peer-to-peer entre pacotes de employees.

### Execução e resultados são rastreáveis

Fila: `MissionEvent`, `resultJson`, learning/memory. Assisted: `OperationalRun` até convergência.

### Decisões estratégicas permanecem no CEO

Supervisor observa e agenda COORDINATE; Opera decide; specialists executam domínio; Execution Engine realiza actions.

---

> **Referências:** [01 — Architecture](./01-architecture.md) · [02 — Agent System](./02-agent-system.md) · [ADR-007 — Mission System](../architecture/adr/ADR-007-mission-system-consolidation.md) · [README](./README.md)
