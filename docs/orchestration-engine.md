# Orchestration Engine — O Sistema Nervoso do OperaIA.lab

O `@operaia/orchestration-engine` coordena o ciclo de vida de um **objetivo**. Ele aciona o Runtime, extrai o plano, envia à Execution, atualiza o estado e decide se roda um novo ciclo — até concluir, falhar, atingir um limite ou ser cancelado.

Ele **não pensa** (não fala com LLM), **não executa** ações e **não conhece implementações concretas** nem agentes específicos.

## Decisão arquitetural central (desacoplamento total)

O Orchestration Engine tem **zero dependências** de outros pacotes do OperaIA.lab (nem `agent-runtime`, nem `execution-engine`, nem `shared`). Ele define **ports próprios** e trafega um **plano opaco**:

- `RuntimePort.run(request)` → `RuntimeOutcome { plan: ProposedPlan, objectiveCompleted }`
- `ExecutionEnginePort.execute(plan)` → `ExecutionSummary { status, executed, failed, durationMs }`

O campo `ProposedPlan.payload` é **`unknown`**: o orquestrador o repassa do Runtime para a Execution **sem inspecioná-lo**. Assim:

- A colisão de nomes `ExecutionPlan` (runtime = trilha de pipeline × engine = ações executáveis) fica **irrelevante** aqui.
- A conversão real (`RuntimeResponse.actions → ExecutionPlan`, o `PlanMapper`) vive em um **adapter externo** (fora deste pacote), preservando o núcleo limpo.
- O orquestrador coordena **qualquer agente**, presente ou futuro.

## Responsabilidades

Receber objetivo → acionar Runtime → extrair plano → enviar à Execution → receber resultado → atualizar estado → decidir conclusão → repetir. Encerra em: objetivo concluído, erro fatal, limite de ciclos/tempo/falhas ou cancelamento.

## Pipeline / Loop

```
Objetivo
   │  (LOOP_STARTED)
   ▼
┌─────────────── ciclo ───────────────┐
│ (cancelado? → CANCELLED)             │
│ CYCLE_STARTED [+ REPLANNING se >1]   │
│   Runtime.run  ──► RuntimeOutcome    │  (com retry/backoff)
│   extrair ProposedPlan (opaco)       │
│   Execution.execute ──► Summary      │  (com retry/backoff)
│   EXECUTION_COMPLETED                │
│   objetivo concluído? OBJECTIVE_...  │
│   registrar CycleRecord no history   │
│   StopPolicy.evaluate(...)           │
└──────────────────────────────────────┘
   │ stop?  não → novo ciclo
   │        sim → status terminal
   ▼  (LOOP_FINISHED)
OrchestrationResult
```

## Estado

`OrchestrationState`: `id`, `objective`, `currentCycle`, `status`, `startedAt`, `finishedAt`, `lastExecution`, `history` (lista de `CycleRecord`).

**Status:** `CREATED → RUNNING → (WAITING durante backoff) → (REPLANNING em novos ciclos) → COMPLETED | FAILED | CANCELLED`.

## Eventos

`LOOP_STARTED`, `CYCLE_STARTED`, `REPLANNING`, `EXECUTION_COMPLETED`, `CYCLE_FAILED`, `OBJECTIVE_COMPLETED`, `LOOP_FINISHED`. Publicados via `EventPublisher` (port), a serem consumidos por dashboard, logs, n8n e monitoramento.

## Políticas (plugáveis)

- **LoopPolicy** (dados): `maxCycles`, `maxDurationMs`, `maxFailures`, `autoReplan`.
- **RetryPolicy** (estratégia): `NoRetryPolicy` (default) e `ExponentialBackoffRetryPolicy` (`shouldRetry`/`delayMs`).
- **StopPolicy** (estratégia): `DefaultStopPolicy` avalia, em ordem, cancelamento → fatal → objetivo concluído → máx. falhas → máx. tempo → máx. ciclos. Substituível por injeção.

`statusFromStopReason` traduz o motivo em status terminal.

## Resultado

`OrchestrationResult`: `id`, `status`, `cycles`, `history`, `startedAt`, `finishedAt`, `duration`, `objectiveCompleted`, `executionSummary`.

## Ports & Defaults

| Port                  | Default              | Responsabilidade                        |
| --------------------- | -------------------- | --------------------------------------- |
| `RuntimePort`         | — (injetado)         | Planejar dado o objetivo/estado         |
| `ExecutionEnginePort` | — (injetado)         | Executar o plano opaco                  |
| `StateStore`          | `InMemoryStateStore` | Persistir o estado                      |
| `EventPublisher`      | `NoopEventPublisher` | Publicar eventos                        |
| `Clock`               | `systemClock`        | Fonte de tempo (determinismo em teste)  |

## Cancelamento

Feito via `AbortSignal` (padrão da plataforma) passado em `run({ signal })`. O loop verifica o sinal no início de cada ciclo e ao avaliar a parada.

## Exemplo de uso

```ts
import { OrchestrationEngine } from "@operaia/orchestration-engine";

const engine = new OrchestrationEngine({
  runtime: myRuntimeAdapter,          // implementa RuntimePort (envolve o Agent Runtime)
  executionEngine: myExecutionAdapter // implementa ExecutionEnginePort (envolve o Execution Engine)
});

const result = await engine.run({ objective: "Organizar o backlog do NEXO" });
// result.status: COMPLETED | FAILED | CANCELLED
```

> Os adapters `myRuntimeAdapter`/`myExecutionAdapter` (incluindo o `PlanMapper`) são a ponte entre este núcleo e os pacotes concretos — implementados fora deste pacote, na próxima sprint.

## Decisões arquiteturais (resumo)

- **Neutralidade por ports + plano opaco** → desacoplamento total e coordenação de qualquer agente.
- **Políticas plugáveis** (loop/retry/stop) → comportamento evolutivo sem alterar o motor.
- **Eventos + StateStore** → observabilidade e persistência prontas para dashboard/n8n, sempre por interface.
- **DI por construtor, sem singletons globais**; `Clock` injetável para testes determinísticos.
