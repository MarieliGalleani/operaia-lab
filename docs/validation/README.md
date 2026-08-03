# Validation Suite — Sprint A.V

Suíte oficial de validação ponta a ponta do **OperaIA.lab**.

Objetivo: comprovar que a arquitetura operacional da Sprint A funciona integrada — da entrada da mensagem até execução, auditoria e resposta.

Esta suíte **não** adiciona funcionalidades de produto. Ela valida o que já foi construído.

---

## Princípios

- Não alterar Employees, WorkerManager, Mission Queue, Action Runtime, Tool Runtime, Policy ou UI
- Não criar features novas
- Em caso de falha: corrigir apenas o defeito, preservando a arquitetura

---

## Pacote

`@operaia/validation-suite`

```
packages/validation-suite/
  src/
    scenario.ts
    scenario-runner.ts
    validation-report.ts
    validation-runner.ts
    operational-proof.ts
    scenarios/
      …
    cli.ts
  tests/
```

### API

```ts
import { ValidationRunner } from "@operaia/validation-suite";

const result = await new ValidationRunner().run();
// { success, executedScenarios, passed, failed, duration, report, proof }
```

---

## Como executar

```bash
# Suite completa + grava Operational Proof
pnpm --filter @operaia/validation-suite validate

# Testes
pnpm --filter @operaia/validation-suite test

# Typecheck
pnpm --filter @operaia/validation-suite typecheck
```

Artefato gerado:

[`sprint-a-operational-proof.md`](./sprint-a-operational-proof.md)

---

## Cenários obrigatórios

| ID | Cenário | Valida |
|---|---|---|
| A.V.1 | GENERAL_CONVERSATION | Intent + Opera + sem Operational Summary |
| A.V.2 | OPERATIONAL_REVIEW | Análise operacional + workspace |
| A.V.3 | TECH_IMPLEMENTATION | Delegação Mag |
| A.V.4 | BUG_INVESTIGATION | Mag recebe missão |
| A.V.5 | INFRASTRUCTURE_OPERATION | Atlas/Orion + Action Runtime |
| A.V.6 | Action Runtime | `docker.status` → SUCCESS + ledger |
| A.V.7 | Policy | Mag `docker.restart` → DENIED |
| A.V.8 | Workspace Isolation | A não acessa B |
| A.V.9 | Worker Selection | Intent → Employee correto |
| A.V.10 | Execution Ledger | REQUESTED → RUNNING → SUCCESS |
| A.V.11 | Conversation Routing | Sala CEO → ConversationMissionRouter |
| A.V.12 | Recovery | Adapter falha → FAILED controlado |

---

## Definition of Done

A Sprint A é considerada concluída quando:

1. Todos os cenários são executados
2. Todos os testes passam
3. Nenhuma regressão ocorre
4. `ValidationRunner` retorna sucesso
5. Operational Proof é gerado
6. Typecheck permanece verde

Esta suíte passa a fazer parte da **DoD de todas as próximas sprints**.
