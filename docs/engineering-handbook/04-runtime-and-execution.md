# 04 — Runtime and Execution

> Parte 5 do [OperaIA Engineering Handbook](./README.md)

Este documento registra oficialmente a camada de **runtime e execução** do OperaIA.lab — como decisões dos funcionários digitais são transformadas em ações controladas, auditáveis e dentro de limites explícitos.

---

## 1. Visão Geral

**Runtime** e **Execution** são as camadas responsáveis por transformar decisões em operações executáveis. Enquanto funcionários digitais analisam contexto e produzem planos, o runtime prepara a execução e o Execution Engine realiza o trabalho concreto sob controle.

### Separação de responsabilidades

| Camada | Pergunta que responde |
|---|---|
| **Employee** | *O que* deve acontecer? |
| **Runtime** | *Como* preparar e coordenar? |
| **Execution Engine** | *Como* executar? |
| **Infraestrutura** | *Como* persistir e registrar? |

### Princípio fundamental

Agentes **não executam ações diretamente**. Um funcionário digital produz `EmployeeDecision` com tarefas e recomendações — nunca invoca banco de dados, APIs externas ou infraestrutura. A tradução de decisão em ação ocorre em camadas dedicadas, com validação, políticas e registro obrigatório.

```
EmployeeDecision  →  Runtime (adapta)  →  ExecutionPlan  →  Engine (executa)  →  Result (persiste)
```

Essa separação garante que decisões estratégicas e execução operacional permaneçam desacopladas — auditáveis, substituíveis e controláveis independentemente.

---

## 2. Employee Runtime

O pacote `packages/employee-runtime` é a ponte entre o domínio dos funcionários digitais e a camada de execução. Ativa funcionários, adapta contexto e traduz decisões de negócio em trabalho executável.

### Responsabilidades

- **ativação de funcionários** — colocar um employee para trabalhar dentro de um workspace via `EmployeeRunner`;
- **criação de contexto operacional** — montar `EmployeeContext` com workspace, objetivo, notas de memória e resultados de delegação;
- **delegação** — orquestrar pedidos de especialidade via `DelegationService` + `EmployeeMatcher`;
- **adaptação de workspace** — converter snapshot de negócio em `EmployeeBriefing` via `WorkspaceBriefingAdapter`;
- **tradução entre domínio e execução** — mapear `EmployeeTask` em `Action` via `EmployeeActionMapper`.

### Componentes

| Componente | Responsabilidade |
|---|---|
| **EmployeeRunner** | Fluxo `Workspace → EmployeeBriefing → Employee.work() → EmployeeResult`. Injeta memória, outcomes de delegação e resumos de execução no briefing antes de ativar o funcionário. |
| **DelegationService** | Para cada `DelegationRequest`, resolve especialista via Matcher, constrói briefing focado e ativa via Runner. Retorna `DelegationOutcome[]` para quem delegou. |
| **WorkspaceBriefingAdapter** | Único ponto de adaptação `WorkspaceSnapshot → EmployeeBriefing`. Funcionários recebem apenas briefing — nunca snapshot de infraestrutura. |
| **EmployeeActionMapper** | Fronteira `EmployeeTask → Action`. Traduz tarefas de negócio em ações executáveis com prioridade derivada de impacto e urgência. O funcionário nunca conhece `Action`. |

### Fluxo de ativação

```
EmployeeContext (workspace, objective, memoryNotes)
        ↓
WorkspaceBriefingAdapter.toBriefing()
        ↓
attachMemoryNotes() + attachDelegationOutcomes() + attachExecutionSummaries()
        ↓
employee.work({ briefing })
        ↓
EmployeeResult (profile, briefing, output)
```

O runtime é **transporte e adaptação** — não interpreta decisões nem executa ações. Toda lógica de domínio permanece no `EmployeeBrain`.

---

## 3. Execution Engine

O pacote `packages/execution-engine` é a camada de **controle operacional** do OperaIA.lab. Descrito como o "braço" dos agentes, transforma `ExecutionPlan` em trabalho executável sem pensar, sem falar com LLM e sem conhecer agentes específicos.

### Responsabilidades

- **receber planos** — validar estrutura do `ExecutionPlan` (ações, ids únicos, tipos presentes);
- **validar ações** — aplicar Policy Layer (`canExecute` → `validate`) antes de qualquer execução;
- **resolver executores** — consultar `ExecutorRegistry` / `ActionRegistry` por tipo de ação;
- **executar operações** — invocar executor compatível com `ExecutionContext` compartilhado;
- **registrar resultados** — produzir `ExecutionResult` com status, logs, timing e resultados normalizados.

### Fluxo por ação

```
Action recebida
        ↓
policy.canExecute()     → SKIPPED se negado
        ↓
policy.validate()       → SKIPPED se inválido
        ↓
registry.resolve()      → FAILED se executor ausente
        ↓
executor.execute()      → SUCCESS ou FAILED
        ↓
ActionResult registrado
```

### Características

- **sem dependência de LLM** — execução puramente determinística;
- **continue-on-error** — por padrão, falha em uma ação não interrompe as demais (`stopOnError` configurável);
- **logs estruturados** — cada fase produz `ExecutionLog` com nível, fase e metadata;
- **persistência opcional** — `ExecutionStore` salva resultado completo quando configurado.

O Execution Engine é a **única porta de entrada** para execução de ações no sistema. Nenhum componente deve executar operações contornando o engine.

---

## 4. Execution Plan

Um **Execution Plan** é a representação formal de trabalho executável — a ponte entre decisão do funcionário e execução controlada.

### Componentes de um plano

| Componente | Descrição |
|---|---|
| **objetivo** | Propósito da execução, transportado via `metadata` do plano |
| **ações** | Lista ordenada de unidades executáveis (`Action[]`) |
| **contexto** | Metadados compartilhados (`ExecutionContext.metadata`) repassados a todos os executores |
| **executor necessário** | Tipo de ação (`Action.type`) que determina qual executor do registry será invocado |
| **limites** | Políticas (`ActionPolicy`) aplicadas antes da execução — allowlist, validação de campos |
| **resultado esperado** | Output normalizado por executor (`ActionOutput`) agregado em `ExecutionResult` |

### Contrato

```typescript
interface ExecutionPlan {
  readonly id: UUID;
  readonly actions: readonly Action[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}
```

Cada `Action` possui:

```
id, type, description, payload, priority, status
```

### Auditoria antes da execução

Planos permitem **auditoria antes da execução** — o sistema pode inspecionar, validar e rejeitar um plano inteiro sem executar nenhuma ação. A validação estrutural (`validatePlan`) verifica:

- presença de lista de ações;
- ids únicos e não vazios;
- tipos presentes em cada ação.

Somente após validação o engine inicia execução, registrando `PLAN_VALIDATED` nos logs. Isso garante que decisões dos funcionários sejam revisáveis antes de produzir efeitos no sistema.

### Distinção arquitetural

O `ExecutionPlan` do Execution Engine representa **trabalho executável** — distinto do plano de raciocínio do `agent-runtime`. A conversão entre os dois é responsabilidade da camada de orquestração (`EmployeeActionMapper`, `buildMissionExecutionPlan`).

---

## 5. Action Registry

O **Action Registry** (`ActionRegistry`) é o catálogo oficial de ações disponíveis no sistema. Cada tipo de ação é associado a um executor compatível — o engine resolve via registry, sem switch no núcleo.

### Princípios

**Ações possuem tipos conhecidos.** Valores canônicos definidos em `ActionType`:

```
CREATE_TASK, UPDATE_TASK, COMPLETE_TASK, CREATE_NOTE,
UPDATE_PROJECT, REQUEST_REVIEW, GENERATE_PROMPT, LOG
```

`Action.type` é `string` (aberto a extensão) — adicionar novo tipo = declarar constante + registrar executor, sem alterar o núcleo do Engine (Open/Closed Principle).

**Executores são registrados.** Cada tipo mapeia para um `ActionExecutor` via `ActionRegistry.register(type, executor)`. O registry garante que o executor só atende o tipo registrado, mesmo se a implementação interna for mais ampla.

**Novas capacidades entram através de extensões controladas.** Para adicionar uma nova ação:

1. declarar constante em `ActionType` (ou string customizada);
2. implementar `ActionExecutor` com `supports()` e `execute()`;
3. registrar no `ActionRegistry`;
4. incluir tipo na `ActionPolicy` (allowlist, se aplicável).

Nenhuma alteração no núcleo do `ExecutionEngine` é necessária.

### API

| Método | Descrição |
|---|---|
| `register(type, executor)` | Associa tipo a executor |
| `registeredTypes()` | Lista tipos do catálogo |
| `has(type)` | Verifica se tipo está registrado |
| `resolve(action)` | Retorna executor compatível ou `undefined` |

---

## 6. Executors

**Executors** são implementações concretas de `ActionExecutor` — a unidade que realiza o trabalho de uma ação específica.

### Contrato

```typescript
interface ActionExecutor {
  readonly name: string;
  supports(action: Action): boolean;
  execute(action: Action, context: ExecutionContext): Promise<ActionOutput>;
}
```

### Comportamento

**Executor recebe uma ação válida.** Somente após passar por validação de plano e policy layer. Ações negadas ou inválidas são `SKIPPED` antes de chegar ao executor.

**Executa dentro de limites.** O executor opera sobre `action.payload` e `ExecutionContext` — sem acesso a decisões estratégicas, briefing de funcionários ou estado de orquestração. Escopo restrito ao tipo de ação registrado.

**Retorna resultado estruturado.** Output como `ActionOutput` (`Record<string, unknown>`), agregado em `ActionResult` com status, timing e nome do executor.

### O que executores não fazem

Executores **não tomam decisões estratégicas**. Não analisam objetivos, não delegam, não escolhem especialistas. Executam o que foi planejado — dentro do tipo e payload recebidos.

```
Executor: "faça X com estes dados"
Employee: "X deve acontecer porque Y"
```

Essa distinção é inegociável. Decisão pertence ao domínio; execução pertence ao engine.

---

## 7. Policies and Safety Boundaries

A **Policy Layer** (`ActionPolicy`) é a barreira de segurança entre plano e execução. Toda ação passa por autorização antes de invocar um executor.

### Regras

**Ações precisam ser autorizadas.** `canExecute(action, context)` é invocado antes de qualquer execução. Retorno `allowed: false` produz `ActionResult` com status `SKIPPED` e motivo registrado.

**Limites explícitos.** `AllowlistActionPolicy` restringe execução a tipos permitidos. Tipos fora da lista são negados sem chamar executor — fail-safe por design.

**Rastreabilidade obrigatória.** Toda ação produz `ActionResult` com `startedAt`, `finishedAt`, `durationMs`, `executor` e `status`. Logs estruturados registram cada fase (`ACTION_START`, `ACTION_FINISH`, `ACTION_ERROR`).

**Falhas devem ser registradas.** Exceções capturadas produzem `ActionResult` com status `FAILED`, mensagem de erro e log de nível `error`. Falhas não são silenciadas — permanecem no `ExecutionResult.failed`.

**Execução sem contexto deve ser rejeitada.** `validate()` verifica campos obrigatórios (`id`, `type`). Ações inválidas são `SKIPPED` com motivo explícito. Planos sem ações ou com ids duplicados lançam `InvalidExecutionPlanError` antes da execução.

### Fluxo oficial por ação

```
canExecute → validate → (Registry resolve) → execute → normalizeResult
```

### Políticas disponíveis

| Política | Comportamento |
|---|---|
| `AllowAllActionPolicy` | Default permissivo — autoriza todas as ações |
| `AllowlistActionPolicy` | Restringe a tipos explicitamente permitidos |

Em produção, `AllowlistActionPolicy` deve ser a configuração padrão — apenas tipos registrados e autorizados executam.

---

## 8. Runtime Separation

A separação entre runtime e execução é um princípio arquitetural fundamental do OperaIA.lab. Cada camada responde a uma pergunta distinta:

### Funcionário — "o que deve acontecer"

O `EmployeeBrain` analisa briefing e produz `EmployeeDecision` com tarefas, delegações e recomendações. Opera no domínio de negócio — sem conhecer Actions, executores ou infraestrutura.

### Runtime — "como preparar"

O `employee-runtime` adapta contexto, ativa funcionários, orquestra delegações e traduz tarefas de negócio em ações executáveis. Prepara o terreno — não executa nem decide estratégia.

### Execution Engine — "como executar"

O `execution-engine` valida planos, aplica políticas, resolve executores e produz resultados. Executa trabalho concreto — sem pensar, sem LLM, sem julgamento.

### Infraestrutura — "como persistir"

`database`, `memory` e `ExecutionStore` registram resultados, persistem estado e disponibilizam histórico. Infraestrutura não decide nem executa — apenas armazena e recupera.

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Employee   │ →  │   Runtime   │ →  │   Engine    │ →  │    Infra    │
│  (decide)   │    │  (prepara)  │    │  (executa)  │    │ (persiste)  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

Violar essa separação — por exemplo, um funcionário escrevendo diretamente no banco — quebra auditabilidade, testabilidade e substituibilidade do sistema.

---

## 9. Fluxo Completo

Fluxo arquitetural da decisão à persistência:

```
Specialist Employee
↓
Execution Plan
↓
Employee Runtime
↓
Execution Engine
↓
Action Executor
↓
Result
↓
Memory System
```

### Specialist Employee

Processa briefing e produz `EmployeeDecision` com `EmployeeTask[]` — tarefas de negócio, não ações técnicas.

### Execution Plan

`EmployeeActionMapper` traduz tarefas em `ExecutionPlan` com `Action[]` ordenadas, prioridades e metadata de origem.

### Employee Runtime

Adapta contexto, valida fronteira domínio → execução. Garante que funcionário nunca produziu `Action` diretamente.

### Execution Engine

Valida plano, aplica policies, resolve executores, executa ações sequencialmente e agrega `ExecutionResult`.

### Action Executor

Executa ação individual dentro de limites. Retorna `ActionOutput` estruturado.

### Result

`ExecutionResult` com status agregado (`SUCCESS`, `PARTIAL`, `FAILED`), resultados normalizados e logs completos.

### Memory System

Resumo da execução persistido via `MemoryStore` — disponível para contexto de missões futuras.

---

## 10. Regras Arquiteturais

### Funcionários nunca executam infraestrutura diretamente

Employees operam exclusivamente sobre `EmployeeBriefing` e produzem `EmployeeDecision`. Acesso a banco, APIs, filesystem ou qualquer recurso de infraestrutura é proibido no domínio dos funcionários.

### Execução sempre passa pelo Execution Engine

Nenhum componente — runtime, orchestrator ou API — deve executar operações contornando o `ExecutionEngine`. Toda ação concreta transita por validação, policy e registry.

### Ações precisam ser registradas

Tipos de ação não registrados no `ActionRegistry` produzem `ExecutorNotFoundError` e `ActionResult` com status `FAILED`. Ações ad hoc ou dinâmicas sem registro são rejeitadas.

### Resultados precisam ser auditáveis

Toda execução produz `ExecutionResult` com logs, timing e resultados por ação. Execução sem registro é invisível para auditoria, memória operacional e consolidação do CEO.

### Runtime não decide estratégia

O `employee-runtime` adapta, transporta e traduz — nunca analisa objetivos, não delega por iniciativa própria e não consolida resultados. Decisão estratégica permanece no `EmployeeBrain` e na consolidação do Opera CEO.

---

> **Referências:** [02 — Agent System](./02-agent-system.md) · [03 — Mission Orchestration](./03-mission-orchestration.md) · [01 — Architecture](./01-architecture.md)
