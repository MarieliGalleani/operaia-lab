# Employee Framework

O **Employee Framework** é a fundação de **todos** os funcionários digitais do
OperaIA.lab. Depois desta base, nenhum funcionário é criado do zero: cada um
apenas **especializa** o framework. Criar um colaborador vira **configuração**,
não desenvolvimento.

Pacote: `@operaia/employee-framework` (depende apenas de `@operaia/shared`).

---

## Objetivo

- Eliminar duplicação entre funcionários.
- Padronizar contrato, briefing, decisão, qualidade e resposta.
- Permitir dezenas de funcionários com o mínimo de código.
- Manter os funcionários **puros**: só informação de negócio, nunca infraestrutura.

## Princípios

Todo funcionário:

- trabalha **exclusivamente** sobre um `EmployeeBriefing` (nunca um Workspace direto);
- **não** conhece infraestrutura, banco, Runtime, Execution, Orchestration ou ferramentas;
- trabalha apenas com informação de negócio.

---

## Arquitetura

```
                    EmployeeInput { briefing }
                              │
                              ▼
        ┌──────────────  BaseEmployee.work()  ──────────────┐
        │  1. validateBriefing                               │
        │  2. brain.decide(briefing)   ← ESPECIALIZAÇÃO      │
        │  3. delegationPolicy.resolve                       │
        │  4. responsePolicy.build → EmployeeReport          │
        │  5. qualityPolicy.validate → QualityResult         │
        └───────────────────────────────────────────────────┘
                              │
                              ▼
        EmployeeOutput { decision, report, quality }
```

A **única** coisa que um novo funcionário implementa é o `EmployeeBrain`
(`decide(briefing) → EmployeeDecision`). Todo o resto (validação, delegação,
formatação, qualidade) é reutilizado.

---

## Conceitos

### Employee Contract

`EmployeeProfile` (dados) reúne tudo que descreve um funcionário:

```ts
interface EmployeeProfile {
  id; name; role; mission;
  specialization: Specialization;
  capabilities; permissions; limits; qualityRules;
}
```

`Employee` (comportamento): `{ profile, work(input) }`.

### Briefing

`EmployeeBriefing` é a **única** entrada de trabalho: project, objective,
executiveSummary, currentState, pending, tasks, documentation, history,
constraints, successCriteria, additional.

O `BriefingBuilder` é o **único ponto de adaptação** `WorkspaceSnapshot →
Briefing`. Nenhuma adaptação acontece dentro dos funcionários.

### Decision Model

Todo funcionário responde às mesmas perguntas (`EmployeeDecision`): o que
analisou, o que decidiu, por quê, o que recomenda, o que delega e quais riscos
(+ próximas ações).

### Response Policy

`EmployeeReport` padroniza a saída em 6 seções: **Resumo · Análise · Plano ·
Recomendações · Riscos · Próximas ações**.

### Quality Policy

Todo funcionário valida a própria entrega (`QualityResult { passed, issues }`)
antes de finalizar.

### Delegation Policy

Funcionários **nunca** escolhem outro funcionário — apenas informam a
`Specialization` necessária (SOFTWARE_ENGINEERING, UX_DESIGN, MARKETING,
FINANCE, LEGAL, AUTOMATION, PRODUCT, MANAGEMENT). A resolução de **quem** executa
acontece fora do domínio.

### Factory & Registry

- `EmployeeFactory.create(blueprint, deps)` instancia um funcionário aplicando as
  políticas padrão. Nenhum funcionário é montado manualmente.
- `EmployeeRegistry` apenas registra e lista funcionários disponíveis (sem lógica
  de negócio). `defineEmployee(blueprint)` encapsula a criação tipada.

---

## Como criar um novo funcionário

Três passos — tudo configuração:

```ts
import {
  Specialization, defineEmployee,
  type EmployeeBrain, type EmployeeBlueprint, type EmployeeProfile,
} from "@operaia/employee-framework";

// 1. Perfil (dados)
const profile: EmployeeProfile = {
  id: "ux-designer", name: "UX Designer", role: "Designer de produto",
  mission: "Garantir usabilidade e consistencia visual.",
  specialization: Specialization.UX_DESIGN,
  capabilities: ["avaliar fluxos", "propor wireframes"],
  permissions: ["recomendar mudancas de UI"],
  limits: ["nao escreve codigo de producao"],
  qualityRules: ["decisoes centradas no usuario"],
};

// 2. Brain (a unica logica que voce escreve)
class UxBrain implements EmployeeBrain {
  async decide(briefing) { /* ... EmployeeDecision ... */ }
}

// 3. Blueprint + registro
export const uxBlueprint: EmployeeBlueprint = { profile, build: () => new UxBrain() };
export const uxEmployee = defineEmployee(uxBlueprint);
```

## Como especializar um funcionário existente

Sobrescreva políticas no blueprint (todas opcionais):

```ts
const blueprint: EmployeeBlueprint = {
  profile,
  build: (deps) => new MeuBrain(deps),
  responsePolicy: new MinhaResponsePolicy(),   // opcional
  qualityPolicy: new MinhaQualityPolicy(),     // opcional
  delegationPolicy: new MinhaDelegationPolicy(),// opcional
};
```

---

## O OperaIA CEO como especialização

O CEO foi **migrado** para o framework sem mudar comportamento:

- `CeoPlanner`, `CeoPrioritizer`, `CeoReviewer` — mesma lógica determinística,
  agora consumindo `EmployeeBriefing`/`EmployeeTask`.
- `CeoBrain implements EmployeeBrain` — orquestra os três + LLM (resumo executivo)
  e devolve um `EmployeeDecision`.
- `ceoProfile: EmployeeProfile` (specialization = `MANAGEMENT`).
- `createCeo(llm)` monta o CEO via `EmployeeFactory`.

O CEO é hoje **apenas um perfil + um brain** registrados no framework.

---

## Testes

- `packages/employee-framework/src/employee-framework.test.ts`: briefing builder,
  validador, políticas default, factory e registry.
- `packages/agents/src/operaia-ceo/operaia-ceo.test.ts`: planner, prioritizer,
  reviewer e a **migração do CEO** (trabalha sobre briefing, entrega o report
  padrão, delega para engenharia, valida qualidade).
