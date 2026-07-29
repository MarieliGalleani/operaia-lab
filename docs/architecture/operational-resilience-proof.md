# Operational Resilience Proof

> Prova de que a operação contínua do OperaIA.lab é **confiável sob falha**.
> Sem funcionalidades novas. Sem memória. Sem remoção do Path A.

**Relacionado:** [Operational Cycle Proof](./operational-cycle-proof.md) · [ADR-007](./adr/ADR-007-mission-system-consolidation.md) · [Operational Supervisor](./operational-supervisor.md)

---

## 1. Objetivo

Validar comportamento real em cenários de falha operacional **antes** da próxima migração (Fase 4 / Path A):

1. **Restart Recovery** — missão em processamento + restart do Continuous Runtime  
2. **Supervisor Deduplication** — múltiplos ciclos, mesma condição, sem duplicar COORDINATE  
3. **Worker Failure** — RUNNING órfão + fail/requeue + reclaim  

Contrato observado (já existente):

| Mecanismo | API |
|-----------|-----|
| Recover RUNNING stale | `MissionQueue.recoverStaleRunning` (também no boot do `ContinuousRuntime`) |
| Recover WAITING / DAG | `recoverWaitingParents` / `recoverBlockedDag` |
| Dedupe COORDINATE | `enqueue({ dedupe: true })` via `objectiveHash` + OPEN statuses |
| Fail → retry | `MissionQueue.fail` → `requeued` ou `failed` |
| Claim | `FOR UPDATE SKIP LOCKED` |

---

## 2. O que esta prova NÃO faz

- Não cria features novas (ex.: stop de um worker isolado, reclaim por heartbeat)  
- Não implementa memória M1/M2/M3  
- Não remove Path A  
- Não altera `PolicyEngine` (não wired no SupervisorLoop)

Simulações usam apenas APIs/config existentes + SQL raw para forçar `updatedAt` antigo (Prisma `@updatedAt` impede update normal).

---

## 3. Como executar

### Pré-requisitos

```bash
pnpm infra:up
pnpm db:migrate
pnpm db:seed
```

### CLI (evidência JSON)

```bash
pnpm --filter @operaia/api ops:operational-resilience-proof
```

Artefato: `apps/api/.ops/last-operational-resilience-proof.json`

### Teste de integração

```bash
pnpm --filter @operaia/api test -- operational-resilience.integration
```

Skip automático se Postgres/NEXO indisponíveis.

### Artefatos

| Arquivo | Papel |
|---------|-------|
| `operational-resilience-proof-harness.ts` | Cenários + DoD |
| `operational-resilience.integration.test.ts` | Vitest |
| `proof-operational-resilience.ts` | CLI |
| `assisted-queue-real-harness.ts` | `probeRealQueueReady` reusado |

Config do bundle de resiliência: `staleRunningMs: 0` (recovery observável no boot) e `schedulerIntervalMs` alto (ciclos Supervisor manuais via `runCycle()`).

---

## 4. Cenários

### 4.1 Restart Recovery

```
start → stop
  → enqueue COORDINATE
  → forçar RUNNING órfão (updatedAt antigo)
  → start (recoverStaleRunning no boot)
  → worker reclaim (claimed / WAITING / COMPLETED)
```

Verifica:

- contagem por `objectiveHash` permanece **1** (sem duplicata)  
- evento `recovered`  
- workers vivos após restart  
- estado final consistente (`RUNNING` | `WAITING` | `COMPLETED`)

### 4.2 Supervisor Deduplication

```
enqueue(objective, dedupe:true) → created: true
enqueue(mesmo objective, dedupe:true) → created: false (mesmo id)
runCycle() × 2
  → openCount(objectiveHash) permanece 1
```

Verifica:

- segunda enqueue não cria missão  
- múltiplos ciclos não aumentam OPEN COORDINATE daquele objective  

> Dedupe é por `workspaceId + objective` (hash), não “no máximo 1 COORDINATE por workspace”. Reasons diferentes → objectives diferentes → permitido.

### 4.3 Worker Failure

```
stop workers
  → enqueue + forçar RUNNING órfão
  → recoverStaleRunning(0) → QUEUED + recovered
  → forçar RUNNING + fail() → QUEUED + requeued
  → start → reclaim (claimed / terminal)
```

Verifica:

- stale reclaim  
- fail/requeue (`attempt < maxAttempts`)  
- worker retoma após recovery  

---

## 5. Checklist de DoD operacional

Assinar após CLI com `dod.allPassed === true` e suite verde.

| ID | Item | Pass? | Campo |
|----|------|-------|-------|
| OR-1 | Restart: missão não duplicada | ☐ | `dod.restartNoDuplicate` |
| OR-2 | Restart: worker retoma (recovered + reclaim) | ☐ | `dod.restartWorkerResumes` |
| OR-3 | Restart: estado final consistente | ☐ | `dod.restartFinalConsistent` |
| OR-4 | Supervisor: sem COORDINATE duplicada (mesmo objective) | ☐ | `dod.supervisorNoDuplicate` |
| OR-5 | Worker: stale RUNNING → QUEUED → reclaim | ☐ | `dod.workerStaleReclaim` |
| OR-6 | Worker: fail → requeue | ☐ | `dod.workerFailRequeue` |
| OR-7 | Evidência JSON gravada | ☐ | `.ops/last-operational-resilience-proof.json` |

### Resultado esperado

```json
{
  "dod": {
    "restartNoDuplicate": true,
    "restartWorkerResumes": true,
    "restartFinalConsistent": true,
    "supervisorNoDuplicate": true,
    "workerStaleReclaim": true,
    "workerFailRequeue": true,
    "allPassed": true
  }
}
```

---

## 6. Relação com outras provas

| Prova | Foco |
|-------|------|
| `ops:operational-cycle-proof` | Ciclo feliz HTTP ask/operations |
| `ops:assisted-queue-proof` | Service → fila real |
| `ops:autonomy-proof` | Smoke autonomia + recovery APIs |
| `ops:operational-resilience-proof` (**esta**) | Falha: restart / dedupe / reclaim |

---

## 7. Limitações conhecidas (não são bugs desta prova)

| Limitação | Implicação |
|-----------|------------|
| Sem stop de worker isolado | Falha simulada via estado Prisma + recovery |
| Heartbeat ≠ reclaim | Reclaim usa `mission.updatedAt` + `recoverStaleRunning` |
| Dedupe por objectiveHash | Não garante 1 COORDINATE/workspace |

---

*Operational Resilience Proof · OperaIA.lab · pré-requisito de confiança antes da próxima migração*
