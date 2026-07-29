# Operational Memory Continuity Proof

> Prova de que a **memória operacional M1** persiste e volta ao briefing após restart.
> Sem funcionalidades novas. Sem M2. Sem alteração de TTL/quota.

**Design:** [memory-m1-design.md](./memory-m1-design.md)  
**Relacionado:** [Operational Cycle Proof](./operational-cycle-proof.md) · [Operational Resilience Proof](./operational-resilience-proof.md)

---

## 1. Objetivo

Validar continuidade M1 ponta a ponta:

```
Missão 1 (Mission Queue + preferQueue)
  → OperationalMemoryNote (Prisma)
  → stop Continuous Runtime / novo store
  → loadOperationalMemoryNotes (feed do EmployeeContext)
  → Missão 2 (briefing com memoryContext)
  → isolamento workspace
```

---

## 2. O que esta prova NÃO faz

- Não cria features novas  
- Não implementa M2/M3  
- Não altera TTL/quota  
- Não remove Path A  

> O projector da Queue (`operational-run-from-queue`) usa briefing stub e **não** rehidrata `memoryContext`.  
> A prova valida o **mesmo loader** usado pelo `QueuedMissionExecutor` (`loadOperationalMemoryNotes`) e confirma injeção no briefing via Path A com o **mesmo** `PrismaOperationalMemoryStore`.

---

## 3. Como executar

### Pré-requisitos

```bash
pnpm infra:up
pnpm db:migrate
pnpm db:seed
```

`MEMORY_STORE=prisma` (default produto). Migration M1 aplicada.

### CLI (evidência JSON)

```bash
pnpm --filter @operaia/api ops:operational-memory-continuity-proof
```

Artefato: `apps/api/.ops/last-operational-memory-continuity-proof.json`

### Teste de integração

```bash
pnpm --filter @operaia/api test -- operational-memory-continuity
```

### Artefatos

| Arquivo | Papel |
|---------|-------|
| `operational-memory-continuity-proof-harness.ts` | Cenário + DoD |
| `operational-memory-continuity.integration.test.ts` | Vitest |
| `proof-operational-memory-continuity.ts` | CLI |

---

## 4. Cenário detalhado

1. Bundle com `PrismaOperationalMemoryStore` + Continuous Runtime  
2. Grava note “veneno” em workspace estrangeiro (`LEAK_TOKEN`)  
3. Executa missão completa via **Mission Queue** (objetivo com marker único)  
4. Assert `OperationalMemoryNote` criado (summary ± learning)  
5. `continuous.stop()` + novo bundle (restart)  
6. `loadOperationalMemoryNotes` no mesmo workspace → contém marker  
7. Nova missão (Path A + mesmo store) → `briefing.additional.memoryContext` recupera memória  
8. Assert: sem `LEAK_TOKEN`; sem duplicatas de conteúdo / source  

---

## 5. Checklist de DoD

| ID | Item | Campo |
|----|------|--------|
| MC-1 | Memória persiste após restart | `dod.memoryPersistsAfterRestart` |
| MC-2 | Briefing recupera memória correta | `dod.briefingRecoversMemory` |
| MC-3 | Nenhuma duplicação | `dod.noDuplicates` |
| MC-4 | Nenhum vazamento entre workspaces | `dod.noCrossWorkspaceLeak` |
| MC-5 | Notes criadas após missão Queue | `dod.notesCreatedAfterMission` |
| MC-6 | Evidência JSON gravada | `.ops/last-operational-memory-continuity-proof.json` |

```json
{
  "dod": {
    "memoryPersistsAfterRestart": true,
    "briefingRecoversMemory": true,
    "noDuplicates": true,
    "noCrossWorkspaceLeak": true,
    "notesCreatedAfterMission": true,
    "firstMissionCompleted": true,
    "allPassed": true
  }
}
```

---

## 6. Relação com outras provas

| Prova | Foco |
|-------|------|
| `ops:operational-cycle-proof` | Ciclo Queue feliz |
| `ops:operational-resilience-proof` | Restart/dedupe/reclaim de missão |
| `ops:operational-memory-continuity-proof` (**esta**) | Continuidade M1 no briefing |

---

*Operational Memory Continuity Proof · OperaIA.lab · M1 only*
