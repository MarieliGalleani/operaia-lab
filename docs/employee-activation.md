# Ativação da Equipe — Employee Activation Layer

> Sprint 7 — Contratação e Ativação da Equipe.
> Objetivo: fazer o OperaIA.lab funcionar como um escritório virtual, provando a
> colaboração entre funcionários digitais.

## Visão geral

Até aqui cada funcionário sabia **decidir** (Employee Framework), mas ninguém os
colocava para trabalhar dentro de um Workspace nem coordenava a colaboração entre
eles. A **Employee Activation Layer** (`@operaia/employee-runtime`) preenche essa
lacuna.

O primeiro fluxo real do escritório:

```
Usuário
  ↓
CEO — Opera        (analisa o Workspace e cria o plano)
  ↓
Identifica necessidade técnica
  ↓
Delegação          (pede a especialidade SOFTWARE_ENGINEERING)
  ↓
EmployeeMatcher    (encontra a CTO — Mag no Registry)
  ↓
CTO — Mag          (recebe briefing e devolve plano técnico)
  ↓
Retorno para o CEO
```

## Componentes

`@operaia/employee-runtime` é uma camada **genérica**: não conhece o CEO nem a
CTO. Depende apenas de contratos (`employee-framework`), do `execution-engine`
(para o mapeamento de tarefas → Actions) e de `shared`. Os funcionários concretos
são conectados na composição (testes/app).

| Componente | Responsabilidade |
| --- | --- |
| `WorkspaceBriefingAdapter` | Único ponto de adaptação `WorkspaceSnapshot → EmployeeBriefing`. |
| `EmployeeRunner` | Coloca um funcionário para trabalhar: `Workspace → Briefing → Employee → Output`. |
| `EmployeeMatcher` | Resolve uma **especialidade** em um funcionário concreto via `EmployeeRegistry`. |
| `DelegationService` | Para cada pedido de especialidade, encontra o especialista, monta o briefing focado e executa. |
| `EmployeeActionMapper` | Traduz `EmployeeTask → Action / ExecutionPlan` do Execution Engine. |

## Como os funcionários trabalham juntos

1. O **snapshot de negócio** do Workspace (`WorkspaceSnapshot`) e um objetivo
   entram no `EmployeeRunner`.
2. O `WorkspaceBriefingAdapter` transforma o snapshot em um `EmployeeBriefing`
   puro. **Os funcionários nunca veem infraestrutura** — apenas o briefing.
3. O funcionário (ex.: CEO) produz um `EmployeeDecision`, que pode conter
   **delegações** (apenas a especialidade necessária, nunca um nome).
4. O `DelegationService` recebe essas delegações e, para cada uma:
   - usa o `EmployeeMatcher` para encontrar um funcionário compatível;
   - constrói um briefing focado (objetivo = tarefa/motivo da delegação);
   - executa o especialista e devolve o resultado a quem delegou.

## Como funciona a delegação

Um funcionário **nunca escolhe outro funcionário diretamente**. Ele apenas
informa a especialidade necessária no seu `EmployeeDecision`:

```ts
delegations: [
  { specialization: "SOFTWARE_ENGINEERING", reason: "Executar a implementação priorizada." },
]
```

A resolução de "quem executa" vive **fora do domínio dos funcionários**, no
`EmployeeMatcher`, que consulta o `EmployeeRegistry` por `specialization`.

- Especialidade sem funcionário no quadro → `DelegationOutcome.matched = false`
  (o fluxo não quebra; o CEO fica ciente de que falta contratação).
- Funcionário inexistente por `id` → `EmployeeRegistry.require` lança
  `EmployeeNotFoundError`.

## Como criar novos funcionários

Continua sendo **configuração, não desenvolvimento** (Employee Framework). Um
novo funcionário é um pacote com quatro arquivos, espelhando a CTO — Mag em
`packages/employees/cto-mag`:

```
src/
  <nome>-profile.ts        // EmployeeProfile (id, role, specialization, limits...)
  <nome>-system-rules.ts   // System prompt em blocos reutilizáveis
  <nome>-brain.ts          // EmployeeBrain: decide(briefing) -> EmployeeDecision
  index.ts                 // blueprint + registered + createXxx()
```

Depois basta registrá-lo no escritório:

```ts
const registry = new EmployeeRegistry()
  .register(ceoRegisteredEmployee)
  .register(magRegisteredEmployee)
  .register(novoFuncionarioRegistrado); // <- pronto para ser delegado
```

Nenhuma alteração na camada de ativação é necessária: o `EmployeeMatcher` passa a
encontrá-lo automaticamente pela sua `specialization`.

## Como o CEO coordena especialistas

O CEO — Opera é apenas mais uma especialização do Framework (`MANAGEMENT`). Ele:

1. Analisa o Workspace e prioriza (planner/prioritizer/reviewer determinísticos).
2. Quando o objetivo exige execução técnica, delega `SOFTWARE_ENGINEERING`.
3. Recebe de volta o plano técnico da CTO — Mag para acompanhar o ciclo.

O CEO **não conhece** a Mag, o Registry, o Runner nem o Execution Engine. Ele só
recebe um Briefing e devolve uma decisão — toda a orquestração acontece na
Employee Activation Layer.

## Limites desta sprint

Sem integrações externas (GitHub, Cursor, n8n, banco real). O foco é **provar a
colaboração** entre funcionários com o mínimo de complexidade. O
`EmployeeActionMapper` já produz `Action`/`ExecutionPlan`, mas a execução real
contra ferramentas externas é responsabilidade de um futuro Tool Connector Layer.
