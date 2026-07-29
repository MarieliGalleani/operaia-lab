# Operational Cycle Proof

> Prova operacional de que a **Mission Queue** é o coração do Digital Office.
> Sem funcionalidades novas. Sem implementação de memória.

**ADR:** [ADR-007](./adr/ADR-007-mission-system-consolidation.md)  
**Plano:** [Unified Mission Gateway](./unified-mission-gateway-migration.md) — Fase 3  
**Handbook:** [03 — Mission Orchestration](../engineering-handbook/03-mission-orchestration.md)

---

## 1. Objetivo

Comprovar o ciclo completo do Digital Office usando o caminho oficial da Mission Queue:

```
Request
  → OperationalMissionService (preferQueue=true)
  → Mission Queue (enqueue COORDINATE)
  → Continuous Runtime
  → Worker claim
  → COORDINATE (Opera CEO)
  → Delegation
  → Mag CTO (EXECUTE)
  → CONSOLIDATE
  → Mission COMPLETED
  → Result persistido (resultJson + MissionEvents)
```

Entradas oficiais validadas:

| Entrada | Rota |
|---------|------|
| Ask | `POST /api/v1/employees/:id/ask` |
| Operations | `POST /api/v1/operations/missions` |

---

## 2. O que esta prova NÃO faz

- Não cria features novas
- Não implementa memória (M1/M2/M3)
- Não remove Path A (`MissionOrchestrator` sync) — apenas prova que Path A **não** é usado com `preferQueue=true`
- Não substitui o proof 2.2c (`ops:assisted-queue-proof`); o complementa com HTTP + DoD Fase 3

---

## 3. Como executar

### Pré-requisitos

```bash
pnpm infra:up
pnpm db:migrate
pnpm db:seed
```

Variáveis relevantes (ver `.env.example` / `docs/production/environment.md`):

| Variável | Valor esperado na prova |
|----------|-------------------------|
| `DATABASE_URL` | Postgres acessível |
| `ASSISTED_QUEUE_MODE` | `true` (default produto; harness força `preferQueue`) |
| LLM | Deterministic no harness (sem chave) |

### CLI (evidência JSON)

```bash
pnpm --filter @operaia/api ops:operational-cycle-proof
```

Artefato: `apps/api/.ops/last-operational-cycle-proof.json`

### Teste de integração

```bash
pnpm --filter @operaia/api test -- operational-cycle.integration
```

Skip automático se Postgres ou seed NEXO indisponíveis.

### Artefatos de código

| Arquivo | Papel |
|---------|-------|
| `apps/api/src/modules/operations/operational-cycle-proof-harness.ts` | Boot + HTTP inject + evidência + DoD |
| `apps/api/src/modules/operations/operational-cycle.integration.test.ts` | Suite Vitest |
| `apps/api/src/modules/operations/proof-operational-cycle.ts` | CLI |
| `apps/api/src/modules/operations/assisted-queue-real-harness.ts` | Bundle Lab + Continuous (reusado) |

---

## 4. Validações automatizadas

| # | Critério | Como prova |
|---|----------|------------|
| 1 | Continuous Runtime inicia no boot | `continuous.start()` → `snapshot.started` + readiness |
| 2 | Workers consomem a fila | `workersAlive === 9` (roster Digital Team) |
| 3 | Supervisor ativo | `snapshot.supervisor.running === true` |
| 4 | Mission Events registrados | `mission_events` com enqueued/claimed/waiting/completed |
| 5 | `resultJson` com final | `initial` + `final` na raiz CONSOLIDATED |
| 6 | Status terminal | raiz `COMPLETED`, kind `COORDINATE`, owner `operaia-ceo` |

Ambas as entradas HTTP devem completar `COORDINATE → EXECUTE (Mag) → CONSOLIDATE` **sem** chamar `MissionOrchestrator` (spy Path A = 0).

---

## 5. Checklist de DoD operacional

Assinar após `ops:operational-cycle-proof` com `dod.allPassed === true` e suite verde.

### 5.1 Ciclo e entradas (obrigatório nesta prova)

| ID | Item | Pass? | Evidência |
|----|------|-------|-----------|
| OC-1 | Continuous Runtime sobe no boot com readiness OK | ☐ | `boot.continuousStarted` |
| OC-2 | Workers 9/9 vivos e claimando | ☐ | `boot.workersAlive` |
| OC-3 | Supervisor v2 `running` | ☐ | `boot.supervisorRunning` |
| OC-4 | `POST /employees/:id/ask` → ciclo completo → COMPLETED | ☐ | `ask` + `dod.askFullCycle` |
| OC-5 | `POST /operations/missions` → ciclo completo → COMPLETED | ☐ | `operations` + `dod.operationsFullCycle` |
| OC-6 | Mission Events auditáveis na árvore | ☐ | `eventTypes` |
| OC-7 | `resultJson` com `initial` + `final` | ☐ | `rootHasInitial/Final` |
| OC-8 | Path A não usado (`orchestratorCalled=false`) | ☐ | `dod.pathANotUsed` |
| OC-9 | Mission persiste em Prisma após o ciclo | ☐ | `missionPersistsInPrismaAfterCycle` |
| OC-10 | Queue é o caminho (`preferQueue=true`) | ☐ | `boot.preferQueue` |

### 5.2 DoD Fase 3 (Unified Mission Gateway) — mapa

| Fase 3 | Coberto por esta prova? | Nota |
|--------|-------------------------|------|
| 3.1 ask → ciclo → COMPLETED | **Sim** | HTTP inject ask |
| 3.2 operations/missions idem | **Sim** | HTTP inject operations |
| 3.3 Supervisor sem conflito | **Parcial** | Supervisor ativo durante Assisted; dedupe/política detalhada permanece nos testes do Supervisor |
| 3.4 Runtime HTTP `POST /missions` | **Fora** | Endpoint runtime separado; coerência via contract ADR-007 |
| 3.5 Health workers 9/9 + fallback Gemini | **Parcial** | 9/9 sim; fallback LLM = deterministic nesta prova |
| 3.6 Reinício API (Mission fica / Run some) | **Documentado** | Mission Prisma = fonte da verdade; `OperationalRunStore` é RAM — esperado sumir no restart |
| 3.7 Projector stubs | **Fora** | Melhoria de projector, não bloqueia prova de Queue |
| 3.8 Suite facade + real + contract + e2e ask | **Parcial** | Esta suite + 2.2c + contract; e2e Path A legado permanece separado |

### 5.3 Explicitamente fora de escopo

| Item | Status |
|------|--------|
| Memória M1/M2/M3 | Não implementar nesta missão |
| Remoção do Path A | Só após DoD Fase 3 estável (Fase 4) |
| Novas features de produto | Proibidas nesta prova |

---

## 6. Interpretação do resultado

```json
{
  "dod": {
    "continuousRuntimeBoot": true,
    "workersConsuming": true,
    "supervisorActive": true,
    "askFullCycle": true,
    "operationsFullCycle": true,
    "missionEventsRegistered": true,
    "resultJsonHasFinal": true,
    "missionCompleted": true,
    "pathANotUsed": true,
    "allPassed": true
  }
}
```

Se `allPassed === true`: a Queue é o coração operacional real para ask e operations.

Se falhar: inspecionar `apps/api/.ops/last-operational-cycle-proof.json`, logs do Continuous Runtime e status das missões filhas no Prisma.

---

## 7. Relação com provas anteriores

| Prova | Foco |
|-------|------|
| `ops:assisted-queue-proof` (2.2c) | Service → fila real (sem HTTP) |
| `ops:queue-proof` | Fila distribuída / workers |
| `ops:operational-cycle-proof` (**esta**) | Boot + Supervisor + HTTP ask/operations + DoD |
| `ops:operational-resilience-proof` | Restart / dedupe Supervisor / reclaim sob falha |

---

*Operational Cycle Proof · OperaIA.lab · sem memória nesta etapa*
