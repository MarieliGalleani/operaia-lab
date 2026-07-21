# Agent Runtime — O Kernel do OperaIA.lab

O `@operaia/agent-runtime` é o núcleo responsável por **executar qualquer agente** da plataforma. Ele é um **orquestrador puro**: coordena o pipeline de execução dependendo apenas de contratos (ports), sem conhecer nenhum provedor de LLM, banco ou ferramenta concreta.

## Princípios

- **Ports & Adapters:** tudo que o runtime consome são interfaces recebidas por construtor.
- **Injeção de dependências:** sem singletons globais — inclusive o relógio (`Clock`) é injetável para tornar timing e logs determinísticos em teste.
- **Vendor-agnóstico:** nenhuma dependência de OpenAI, Anthropic, etc. Depende só de `@operaia/ai-core`, `@operaia/memory` e `@operaia/agents`.
- **Propõe, não executa:** o kernel devolve `actions` propostas; a execução de ações é uma extensão opcional construída ao redor dele.

## Pipeline

```
RuntimeInput
    │
    ▼
1. Load Agent ──────────► AgentLoader.load(agentKey)      (valida existência e "active")
2. Build Context ───────► resolve parâmetros (memoryTopK, startedAt)
3. Load Memory ─────────► MemoryStore.search({ text, topK })
4. Discover Tools ──────► ToolProvider.discover({ agent, input })
5. Build Prompt ────────► PromptBuilder.build(context) → LLMMessage[]
6. Generate Plan ───────► LLMSelector.select(context) + ExecutionPlan determinístico
7. Execute LLM ─────────► LLMProvider.complete(messages, options)
8. Return ──────────────► RuntimeResponse
    │
    ▼
{ output, plan, actions, usage, logs }
```

Cada estágio é medido e registrado (`RuntimeLog` com passo, mensagem e `durationMs`).

## Contratos (ports)

| Port           | Origem                | Responsabilidade                                  |
| -------------- | --------------------- | ------------------------------------------------- |
| `AgentLoader`  | agent-runtime         | Carregar a `AgentDefinition` pela chave           |
| `MemoryStore`  | `@operaia/memory`     | Recuperar contexto (RAG)                          |
| `ToolProvider` | agent-runtime         | Descobrir ferramentas disponíveis                 |
| `PromptBuilder`| agent-runtime         | Montar as `LLMMessage[]`                          |
| `LLMSelector`  | agent-runtime         | Escolher o `LLMProvider` da execução              |
| `LLMProvider`  | `@operaia/ai-core`    | Executar a chamada ao modelo                      |
| `ActionParser` | agent-runtime         | Extrair `actions` propostas da resposta           |
| `Clock`        | agent-runtime         | Fonte de tempo injetável                          |

## Implementações default (plugáveis, sem vendor)

- `RegistryAgentLoader` — carrega do registro de `@operaia/agents`.
- `DefaultPromptBuilder` — sistema (instruções) → ferramentas → memória → mensagem do usuário.
- `EmptyToolProvider` — sem ferramentas.
- `SingleProviderSelector` — sempre o mesmo provider.
- `NoopActionParser` (default) / `JsonActionParser` — extrai um bloco ```json``` com `actions`.

## RuntimeResponse

| Campo     | Tipo                | Descrição                                          |
| --------- | ------------------- | -------------------------------------------------- |
| `output`  | `string`            | Texto retornado pelo modelo                        |
| `plan`    | `ExecutionPlan`     | Passos ordenados, modelo alvo, ferramentas, hits   |
| `actions` | `AgentAction[]`     | Ações propostas (não executadas pelo kernel)       |
| `usage`   | `RuntimeUsage\|null`| Uso de tokens reportado pelo provider              |
| `logs`    | `RuntimeLog[]`      | Trilha de auditoria por estágio, com duração       |

## Exemplo de uso

```ts
import {
  AgentRuntime,
  RegistryAgentLoader,
  DefaultPromptBuilder,
  EmptyToolProvider,
  SingleProviderSelector,
} from "@operaia/agent-runtime";

const runtime = new AgentRuntime({
  agentLoader: new RegistryAgentLoader(),
  memoryStore: myMemoryStore, // implementa MemoryStore
  toolProvider: new EmptyToolProvider(),
  promptBuilder: new DefaultPromptBuilder(),
  llmSelector: new SingleProviderSelector(myLLMProvider), // implementa LLMProvider
});

const response = await runtime.run({
  agentKey: "operaia-ceo",
  message: "Analise o projeto NEXO e proponha as próximas tarefas.",
});
```

## Gargalos conhecidos

- **Latência sequencial:** `Load Memory` e `Discover Tools` são independentes e podem ser paralelizados (`Promise.all`).
- **Chamada síncrona ao LLM:** `Execute LLM` bloqueia até a resposta — inadequado para tarefas longas em requisição HTTP.
- **Custo de RAG e tamanho do prompt:** `topK` alto e muitas ferramentas inflam tokens; requer truncamento/priorização.
- **Sem timeout/retry:** um provider pendurado trava o pipeline.

## Extensões futuras (preservando o núcleo)

- **Agentes autônomos:** um `ActionExecutor` + loop *plan→act→observe* (ReAct) ao redor do runtime, reusando `actions`/`ExecutionPlan`.
- **Execução assíncrona & filas:** `JobQueue`/`RuntimeJob` serializam o `RuntimeInput`, executam o mesmo `AgentRuntime.run` em worker e persistem o `RuntimeResponse`.
- **Colaboração multi-agente:** um `Orchestrator` (ex.: OperaIA CEO) delega para outros runtimes via `AgentLoader`/`LLMSelector`, repassando `actions`.
- **Streaming:** adicionar um método opcional ao port do provider sem quebrar `complete`.
