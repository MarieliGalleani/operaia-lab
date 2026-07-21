# OperaIA CEO — Funcionário Digital

O **OperaIA CEO** é o primeiro funcionário digital do OperaIA.lab. Não é um
chatbot nem um assistente: é um **colaborador permanente** que gerencia o
escritório virtual.

Vive em `packages/agents/src/operaia-ceo/` (dentro de `@operaia/agents`).

---

## Quem é o CEO

O gerente geral do escritório. Ele coordena projetos, prioriza o trabalho,
planeja, delega e acompanha sessões até levar cada objetivo à conclusão — sempre
respondendo em **linguagem executiva**.

## Responsabilidades

- Analisar um Workspace e entender um objetivo
- Identificar pendências
- Criar um plano de execução
- Definir prioridades
- Recomendar criação de tarefas e atualização de roadmap
- Decidir quando solicitar ajuda de outros agentes (delegar)
- Acompanhar sessões
- Responder ao usuário com linguagem executiva

## Limites (o que ele NÃO faz)

- Não escreve código
- Não cria telas
- Não executa automações

Essas atividades são **delegadas** a agentes especialistas. O CEO gerencia.

---

## Arquitetura do cérebro

O CEO combina **decisões determinísticas** (auditáveis e testáveis) com o **LLM**
apenas para a narrativa executiva:

| Componente | Responsabilidade | Usa LLM? |
| --- | --- | --- |
| `CeoPlanner` | Objetivo + Workspace → plano de etapas | Não |
| `CeoPrioritizer` | Tarefas → score + `Priority` | Não |
| `CeoReviewer` | Objetivo atingido? pendências? novo ciclo? | Não |
| `CeoResponseBuilder` | Padroniza as 5 seções executivas | Não |
| `OperaIACeo` | Orquestra tudo + resumo executivo via LLM | Sim |

### Desacoplamento

O CEO define **seus próprios contratos de entrada** (`WorkspaceSnapshot`,
`CeoTask`) — dados puros. Ele **não depende** de `@operaia/workspace-runtime`,
evitando o ciclo `agents → workspace-runtime → agent-runtime → agents`. Um adapter
externo (futuro) traduz o Workspace real neste snapshot.

O LLM é acessado **apenas** pela interface `LLMProvider` (`@operaia/ai-core`): o
CEO funciona com qualquer provider.

---

## System Prompt em blocos

Nunca um prompt gigante. `ceo-system-prompt.ts` define blocos reutilizáveis —
Identidade, Missão, Forma de pensar, Critérios de prioridade, Como analisar, Como
responder, Quando criar tarefas, Quando atualizar roadmap, Quando solicitar outro
agente, Regras de segurança, Limites — compostos por `buildCeoSystemPrompt()`.

A `AgentDefinition` do CEO (`definitions/operaia-ceo.ts`) deriva seu
`systemInstructions` desse builder — **fonte única da verdade**.

---

## Critérios de decisão

### Priorização (determinística)

```
score = impacto*0.30 + urgencia*0.30 + risco*0.20 + dependentes*0.15 - esforco*0.15
```

- `dependentes` = quantas tarefas dependem desta (desbloquear valor sobe a prioridade)
- Mapeamento de score → `Priority`: `≥3.5` URGENT · `≥2.5` HIGH · `≥1.5` MEDIUM · resto LOW
- Tarefas `DONE` são excluídas

### Planejamento (adaptativo ao estado)

`Analisar Workspace → Revisar pendências → [Criar tarefas se não há pendências] →
[Atualizar roadmap] → [Delegar se há execução] → Reportar`.

### Review

`objetivo atingido = há tarefas E nenhuma pendente`. Caso contrário, sinaliza
`needsNewCycle` e lista os achados (pendências, bloqueios).

---

## Fluxo de trabalho

```
CeoRequest { objective, workspace: WorkspaceSnapshot }
        │
        ▼
  OperaIACeo.decide()
     ├─ CeoPlanner.plan()          → CeoPlan
     ├─ CeoPrioritizer.prioritize()→ PrioritizedTask[]
     ├─ CeoReviewer.review()       → CeoReview
     ├─ LLMProvider.complete()     → resumo executivo
     └─ CeoResponseBuilder.build() → CeoResponse (5 seções)
        │
        ▼
  CeoDecision { plan, priorities, review, response }
```

Exemplo:

```ts
import { OperaIACeo } from "@operaia/agents";

const ceo = new OperaIACeo({ llm: meuLLMProvider });

const decisao = await ceo.decide({
  objective: "Finalizar a NEXO",
  workspace: {
    workspaceId: "nexo",
    name: "NEXO",
    tasks: [
      { id: "t1", title: "Implementar login", status: "TODO", impact: 5, urgency: 5 },
    ],
  },
});

console.log(decisao.response.resumoExecutivo);
console.log(decisao.priorities[0].priority); // URGENT
```

---

## Como interage com os demais funcionários

O CEO **gerencia e delega**. Quando uma tarefa exige execução especializada
(código, design, automação), o plano inclui um passo `DELEGATE`. Os agentes
especialistas (a serem criados) recebem tarefas e reportam de volta ao CEO, que
consolida o progresso e decide sobre novos ciclos.

Toda coordenação acontece **dentro de um Workspace** — o CEO nunca responde
apenas ao prompt; sempre considera histórico, sessões, tarefas, documentação e
objetivos.

---

## Testes

`packages/agents/src/operaia-ceo/operaia-ceo.test.ts` cobre: planejamento,
priorização (ordenação + dependências), review (concluído e pendente), geração de
resposta, análise de Workspace, objetivo concluído e objetivo pendente.
