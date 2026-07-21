# Execution Engine — O Braço dos Agentes

O `@operaia/execution-engine` transforma um **ExecutionPlan** (lista de ações) em **trabalho executável**. Ele é o "braço" da plataforma: **não pensa, não fala com LLM, não conhece Runtime, Prompt nem Memory**. Recebe um plano, executa e devolve um `ExecutionResult`.

## Posição na arquitetura

```
Agent Runtime (cérebro)          Execution Engine (braço)
──────────────────────           ────────────────────────
pensa, consulta memória,   ┌──►  recebe ExecutionPlan
monta prompt, chama LLM,    │     valida, resolve executores,
propõe actions  ────────────┘     executa, registra logs,
                (adapter externo)  devolve ExecutionResult
```

> O Runtime e o Engine **não se conhecem**. A conversão de `RuntimeResponse.actions` (do Runtime) para o `ExecutionPlan` (do Engine) é responsabilidade de uma **camada de orquestração** externa (ex.: `apps/api` ou um futuro pacote `orchestration`). Isso preserva o desacoplamento.

## Responsabilidades

- Receber um `ExecutionPlan`.
- **Validar** o plano (estrutura, ids, duplicidade).
- Percorrer as `Action`s **na ordem do plano**.
- **Localizar** o executor correto via `Registry` + `supports(action)` (nunca com `switch`).
- **Executar** cada ação.
- **Registrar logs** (início, fim, erro, tempo, executor).
- **Controlar status** por ação e agregado.
- Retornar `ExecutionResult`.

O Engine **não** conhece: OpenAI, Claude, Gemini, Runtime, Prompt, Memory. Depende apenas de contratos (`ActionExecutor`, `ExecutionStore`, `Clock`) e de `@operaia/shared` (tipos puros `Priority`/`UUID`).

## Pipeline (sequência)

```
ExecutionPlan
   │
   ▼
Validar plano ─────────────► InvalidExecutionPlanError (se inválido)
   │
   ▼
Para cada Action (em ordem):
   │  Encontrar Executor (Registry.resolve)
   │      └─ não encontrado → ActionResult FAILED + log ACTION_ERROR
   │  Executar (executor.execute)
   │      ├─ sucesso → ActionResult SUCCESS + log ACTION_FINISH
   │      └─ exceção → ActionResult FAILED + log ACTION_ERROR
   │  Atualizar status / próxima ação
   ▼
Agregar status (SUCCESS | PARTIAL | FAILED)
   │
   ▼
Persistir (ExecutionStore.save, opcional)
   │
   ▼
ExecutionResult
```

Comportamento padrão: **continue-on-error** (coleta todas as falhas). Com `stopOnError: true`, interrompe na primeira falha.

## Action

| Campo         | Tipo                | Observação                                        |
| ------------- | ------------------- | ------------------------------------------------- |
| `id`          | `UUID`              | Único no plano                                    |
| `type`        | `string`            | Aberto à extensão; `ActionType` traz os canônicos |
| `description` | `string`            |                                                   |
| `payload`     | `Record<string,…>`  | Dados da ação                                      |
| `priority`    | `Priority`          | Metadado (agendamento por prioridade é extensão)  |
| `status`      | `ActionStatus`      | Estado declarado inicial                          |

### ActionType (primeiros valores canônicos)

`CREATE_TASK`, `UPDATE_TASK`, `COMPLETE_TASK`, `CREATE_NOTE`, `UPDATE_PROJECT`, `REQUEST_REVIEW`, `GENERATE_PROMPT`, `LOG`.

> Como `Action.type` é `string`, **adicionar um novo tipo não altera o núcleo**: basta declarar a constante e registrar um executor (Open/Closed Principle).

## ActionExecutor & Registry

```ts
interface ActionExecutor {
  readonly name: string;
  supports(action: Action): boolean;
  execute(action: Action, context: ExecutionContext): Promise<ActionOutput> | ActionOutput;
}
```

- Cada executor atende **um** tipo. `BaseActionExecutor` implementa `supports` por comparação de tipo.
- O `ExecutorRegistry` localiza o executor (`resolve(action)`). O Engine **nunca** conhece implementações concretas.

## ExecutionResult

| Campo         | Descrição                                          |
| ------------- | -------------------------------------------------- |
| `executionId` | Id da execução                                     |
| `status`      | `SUCCESS` / `PARTIAL` / `FAILED`                   |
| `executed`    | Ações concluídas com sucesso                       |
| `failed`      | Ações que falharam                                 |
| `results`     | Todas as ações, na ordem de execução               |
| `durationMs`  | Duração total                                      |
| `logs`        | Trilha de auditoria por fase                       |

## Extensibilidade

- **Novo tipo de ação:** declare a constante + crie um `BaseActionExecutor` + `registry.register(...)`. Núcleo intocado.
- **Persistência:** implemente `ExecutionStore` (banco, fila) — injetado por construtor.
- **Agendamento por prioridade / paralelismo:** estratégias plugáveis em cima do loop (extensão futura).
- **Tool Connectors:** GitHub, Cursor, n8n, Figma, Drive e banco real entram como **executores concretos** em outro módulo, sem tocar no Engine.

## Exemplo de uso

```ts
import {
  ExecutionEngine,
  ExecutorRegistry,
  TaskActionExecutor,
  NoopExecutor,
} from "@operaia/execution-engine";

const registry = new ExecutorRegistry()
  .register(new TaskActionExecutor())
  .register(new NoopExecutor()); // LOG

const engine = new ExecutionEngine({ registry });

const result = await engine.execute({
  id: crypto.randomUUID(),
  actions: [
    {
      id: crypto.randomUUID(),
      type: "CREATE_TASK",
      description: "Criar tarefa de kickoff do NEXO",
      payload: { title: "Kickoff NEXO" },
      priority: "HIGH",
      status: "PENDING",
    },
  ],
});
```
