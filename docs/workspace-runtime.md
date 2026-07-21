# Workspace Runtime

O **Workspace Runtime** é o primeiro ambiente operacional do OperaIA.lab. A partir
dele, **todo agente trabalha dentro de um Workspace** — nunca diretamente sobre um
prompt solto.

Ele é a **camada de composição** do sistema: o único lugar autorizado a conhecer as
implementações concretas do Agent Runtime, do Execution Engine e do Orchestration
Engine, conectando-os por meio de _adapters_.

---

## O que é um Workspace

Um `Workspace` representa um **projeto vivo** (ex.: NEXO, MenuFlow, Plataforma,
Cliente XPTO, o próprio OperaIA.lab).

```ts
interface Workspace {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}
```

Aspectos ricos de um projeto (memória, documentação, tarefas) são fornecidos por
outras camadas (`@operaia/memory`, módulos de projeto/tarefa) e **não são
duplicados** aqui. O Workspace é o ponto de convergência, não um super-objeto.

---

## O que é uma Session

Uma `WorkspaceSession` é uma **unidade de trabalho** de um agente dentro de um
Workspace: um objetivo sendo perseguido através de ciclos de orquestração.

```ts
interface WorkspaceSession {
  id: string;
  workspaceId: string;
  objective: string;
  status: WorkspaceSessionStatus;
  currentCycle: number;
  startedAt: Date;
  finishedAt: Date | null;
  history: CycleRecord[];          // historico de ciclos da orquestracao
  executionSummary: ExecutionSummary | null; // resumo da ultima execucao
}
```

### Ciclo de vida (status)

```
CREATED → RUNNING → COMPLETED
                 ↘ WAITING
                 ↘ FAILED
                 ↘ CANCELLED
```

O status da sessão é derivado do status da orquestração
(`statusFromOrchestration`): `REPLANNING`/`CREATED`/`RUNNING` colapsam em
`RUNNING`; `COMPLETED`, `FAILED`, `CANCELLED` e `WAITING` são mapeados 1:1.

---

## Como funciona a composição

A regra de ouro: **nenhum engine conhece outro engine**. Toda comunicação passa
por adapters, montados no **Composition Root**.

```
                    ┌──────────────────────────────────────────┐
                    │            Composition Root               │
                    │        (createWorkspaceRuntime)           │
                    └──────────────────────────────────────────┘
                                       │ monta
        ┌──────────────┬──────────────┼───────────────┬──────────────┐
        ▼              ▼              ▼               ▼              ▼
  AgentRuntime   ExecutionEngine  RuntimeAdapter  ExecutionAdapter  Orchestration
  (@agent-       (@execution-     (RuntimePort)   (ExecutionEngine  Engine
   runtime)       engine)                          Port)            (@orchestration-
                                                                     engine)
                                       │                                │
                                       └──── PlanMapper ────────────────┘
                                       (RuntimeResponse → ExecutionPlan)
```

### PlanMapper — a fronteira anti-acoplamento

O maior risco arquitetural do núcleo era a **colisão de vocabulário** entre dois
tipos chamados `ExecutionPlan`:

- no **Agent Runtime**, `ExecutionPlan` descreve os _passos do pipeline de
  raciocínio_;
- no **Execution Engine**, `ExecutionPlan` descreve _trabalho executável_ (uma
  lista de `Action`).

O `PlanMapper` é a **única** camada que conhece os dois vocabulários. Ele traduz
`RuntimeResponse.actions` → `execution-engine.ExecutionPlan`, preenchendo `id`,
`description`, `priority` e `status` de cada ação. Isso impede que Runtime e
Execution Engine se conheçam.

### Payload opaco

O Orchestration Engine é **neutro**: para ele, o plano é um `ProposedPlan` com
`payload: unknown`. O `RuntimeAdapter` empacota o `ExecutionPlan` como payload
opaco; o `ExecutionAdapter` o reinterpreta ao executar. O orquestrador nunca
inspeciona o conteúdo do plano.

---

## Como Runtime, Orchestration e Execution trabalham juntos

Fluxo de uma sessão (`WorkspaceManager.startSession`):

```
1. WorkspaceLoader.load(workspaceId)         → Workspace (ou WorkspaceNotFoundError)
2. monta WorkspaceContext (objetivo + metadados do workspace)
3. cria WorkspaceSession (CREATED) e persiste
4. status → RUNNING, persiste
5. SessionRunner.run({ objective, sessionId, metadata })   ← OrchestrationAdapter
      └─ OrchestrationEngine.run() executa o loop:
           ciclo N:
             RuntimeAdapter.run()  → AgentRuntime.run() → RuntimeResponse
                                   → PlanMapper → ProposedPlan (payload opaco)
             ExecutionAdapter.execute(ProposedPlan)
                                   → ExecutionEngine.execute() → ExecutionSummary
             StopPolicy avalia: objetivo concluído? erro? limite?
6. mapeia OrchestrationResult → WorkspaceSession (status, ciclos, history, summary)
7. persiste a sessão final e retorna
```

O `sessionId` é usado como `id` da orquestração — estado da sessão e estado da
orquestração ficam correlacionados.

---

## Como um novo agente utiliza esta arquitetura

Um novo agente **não precisa saber nada** sobre orquestração ou execução. Basta:

1. registrar sua `AgentDefinition` em `@operaia/agents`;
2. abrir uma sessão apontando para ele:

```ts
import { createWorkspaceRuntime } from "@operaia/workspace-runtime";

const { manager } = createWorkspaceRuntime({
  agentKey: "meu-novo-agente",       // default: "operaia-ceo"
  initialWorkspaces: [
    { id: "nexo", name: "NEXO", createdAt: new Date() },
  ],
});

const session = await manager.startSession({
  workspaceId: "nexo",
  objective: "Planejar a próxima release do NEXO",
});
```

Tudo é injetável via `WorkspaceRuntimeConfig`: `llmProvider`, `memoryStore`,
`toolProvider`, políticas (`loopPolicy`, `stopPolicy`, `retryPolicy`),
`stateStore`, `eventPublisher` e `clock`.

### Placeholders desta sprint

Como ainda **não há integração real** de LLM nem de banco, o Composition Root usa
placeholders **injetáveis** (substituíveis por DI):

- `PlaceholderLLMProvider` — resposta determinística, sem chamadas externas;
- `InMemoryMemoryStore` — memória em processo, sem busca semântica;
- `InMemoryWorkspaceStore` / `InMemorySessionStore` — persistência em memória.

Nenhum deles simula **dados de negócio**; são infraestrutura temporária para
fechar o circuito operacional.

---

## Endpoints (apps/api)

```
POST /api/v1/workspaces/{workspaceId}/sessions
  body:  { "objective": "..." }
  201:   { "sessionId", "status", "currentCycle" }

GET  /api/v1/workspaces/{workspaceId}/sessions/{sessionId}
  200:   { estado atual, histórico, última execução, ciclo atual }
```

Workspaces disponíveis nesta sprint: `nexo`, `menuflow`, `plataforma`.

---

## Decisões arquiteturais

| Decisão | Motivo |
| --- | --- |
| `PlanMapper` isolado | Resolve a colisão `ExecutionPlan` e mantém Runtime/Execution desacoplados |
| Payload opaco (`unknown`) | Mantém o Orchestration Engine neutro ao formato do plano |
| Porta `SessionRunner` | Desacopla o `WorkspaceManager` do `OrchestrationEngine` concreto (testável) |
| Composition Root único | Único ponto que conhece implementações concretas |
| Placeholders injetáveis | Fecham o circuito sem integrações reais; trocáveis por DI |
| Reuso de `CycleRecord`/`ExecutionSummary` | A camada de composição pode conhecer os tipos dos engines (evita duplicação) |
| Erros estendem `DomainError` | Integração limpa com o error handler HTTP da API |

---

## Testes

`packages/workspace-runtime/src/workspace-runtime.test.ts` cobre: PlanMapper,
adapters (runtime/execution + payload inválido), abertura de workspace/sessão,
composition root, ciclo completo end-to-end, persistência em memória e múltiplas
sessões.
