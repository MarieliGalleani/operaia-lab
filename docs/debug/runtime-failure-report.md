# Runtime Failure Report — Sprint A.D1

> Diagnóstico da falha operacional real da CEO na execução em produção/lab,
> apesar da Validation Suite 12/12 PASS.

**Data:** 2026-08-03  
**Ambiente observado:** API `operaia-lab-api` (porta 3333), ContinuousRuntime ativo, 9/9 workers.

---

## Resumo executivo

A CEO **concluía o raciocínio com sucesso**, mas a missão falhava **depois** da decisão, ao persistir memória operacional M1:

```text
Quota M1 excedida para workspace nexo (max 2000 notes ativas)
```

O worker capturava a exceção e chamava `MissionQueue.fail()`, convertendo (ou reenfileirando) a missão. A UI engolia o HTTP error e mostrava a mensagem amigável.

`COORDINATE/congestionamento_fila` com `depth=13` **não era a causa raiz** — era um **amplificador**: 13 missões WAITING órfãs (resilience proof) mantinham a fila congested (≥10), gerando mais COORDINATE que também falhavam na quota.

---

## Fluxo real mapeado

```text
Mensagem (UI ExecutiveChat)
  ↓ officeService.askCeo
POST /employees/operaia-ceo/ask
  ↓ EmployeesApplication.ask
ConversationMissionRouter  → OPERATIONAL_REVIEW + [MISSION_INTENT]
  ↓
OperationalMissionService.runViaQueue (ASSISTED_QUEUE_MODE=true)
  ↓ enqueue COORDINATE
MissionQueue
  ↓ claim
EmployeeWorker (operaia-ceo)
  ↓
QueuedMissionExecutor.runCoordinate
  ↓ CEO decide (OK — delegationCount=0)
finishWithoutDelegation
  ↓ queue.complete()          ← sucesso operacional
  ↓ persistMissionMemory()    ← ESTOURO AQUI
  ↓ throw MemoryQuotaExceededError
EmployeeWorker.catch
  ↓ queue.fail(error)         ← missão marcada FAILED / requeued
AssistedQueueMissionFailedError (quando ask espera terminal FAILED)
  ↓ HTTP 5xx
ExecutiveChat.catch
  ↓ "Não consegui concluir a missão agora..."
```

Estágio da falha: **pós-Employee Finished / side-effect de memória**, não no Intent Router, não no Action Runtime, não na decisão da CEO.

---

## Respostas obrigatórias

### 1. Qual exceção ocorreu?

`MemoryQuotaExceededError`

Mensagem:

```text
Quota M1 excedida para workspace nexo (max 2000 notes ativas)
```

Código: `MEMORY_QUOTA_EXCEEDED` (`packages/memory/src/memory-m1.ts`).

### 2. Onde ocorreu?

`PrismaOperationalMemoryStore.store()` → chamado por `persistMissionMemory()` em:

`QueuedMissionExecutor.finishWithoutDelegation()` **após** `queue.complete()`.

### 3. Qual componente lançou?

`@operaia/memory` / `PrismaOperationalMemoryStore` (apps/api).

### 4. Qual componente capturou?

1. `EmployeeWorker` (`mission_failed` → `queue.fail`)
2. `OperationalMissionService.runViaQueue` (se status terminal FAILED → `AssistedQueueMissionFailedError`)
3. Fastify error handler → HTTP error
4. `ExecutiveChat.vue` catch → mensagem amigável (sem stack)

### 5. Por que a Validation Suite não detectou?

- Suite usa ledger/adapters em memória e roteamento determinístico.
- Não enche o índice M1 até 2000 notes por workspace.
- Não executa Path B real (MissionQueue + PrismaOperationalMemoryStore) sob carga de dados de produção.
- Ambiente de teste ≠ estado saturado do lab.

### 6. Existe diferença entre teste e produção?

| Aspecto | Teste / Validation Suite | Lab real |
|---|---|---|
| MemoryStore | vazio / isolado | 2000 notes ativas em `nexo` |
| MissionQueue | mock / limpa | 22k+ FAILED por quota |
| ASSISTED_QUEUE_MODE | frequentemente Path A nos unitários | Path B (fila) |
| Congestionamento | ausente | depth=13 por WAITING órfãos |

### 7. Existe loop na Mission Queue?

**Sim — loop operacional secundário**, não recursão de depth de missão:

1. Quota cheia → missões falham/requeue
2. 13 WAITING de `resilience_dedupe` pinam `depth = waiting+queued+running ≥ 10`
3. `CoordinationDispatcher` cria `[COORDINATE/congestionamento_fila] … depth=13`
4. Essas missões também tentam persistir M1 → falham de novo
5. Contagem observada: **~22 201** missões com `lastError` contendo `Quota M1`

`depth=13` = profundidade da **fila** (`QueueMonitor`), não depth DAG recursivo.

### 8. Existe problema de configuração?

Parcialmente:

- `MEMORY_M1_QUOTA_PER_WORKSPACE = 2000` sem eviction FIFO (hard fail).
- `congestionThreshold = 10` reage a WAITING órfãos de proofs.
- Configuração em si é válida; faltava política de evicção no índice derivado.

### 9. Existe problema de dados?

**Sim:**

- `nexo`: exatamente **2000** notes M1 ativas (quota cheia).
- **13** missões `WAITING` com objective `resilience_dedupe` (proof antigo).
- **~22k** missões `FAILED` com erro de quota (sintoma acumulado).

### 10. Qual é a menor correção possível?

Três camadas mínimas (sem mudar arquitetura):

1. **Código — índice M1:** eviction FIFO ao atingir quota (não derrubar missão por índice derivado).
2. **Código — executor:** após `complete()`, side-effects de memória não podem rethrow (evita `complete` → `fail`).
3. **Dados:** arquivar notes excedentes + cancelar WAITING órfãos de resilience proof.

---

## Evidências (stack / logs)

Log típico (journal `operaia-lab-api`):

```json
{
  "level": "info",
  "msg": "Opera coordenou missao",
  "component": "queued-mission-executor",
  "event": "coordinate_decided",
  "missionId": "c486bff5-9531-4e6b-a1f1-58944c0c0661",
  "workerEmployeeId": "operaia-ceo",
  "delegationCount": 0
}
{
  "level": "error",
  "msg": "Missao falhou",
  "component": "employee-worker",
  "employeeId": "operaia-ceo",
  "event": "mission_failed",
  "missionId": "c486bff5-9531-4e6b-a1f1-58944c0c0661",
  "error": "Quota M1 excedida para workspace nexo (max 2000 notes ativas)",
  "requeued": false
}
```

Objetivo correlato no mesmo ciclo:

```text
[COORDINATE/congestionamento_fila] Atencao operacional no workspace nexo. depth=13
```

Health antes da remediação:

```json
{
  "queue": { "queued": 0, "running": 0, "waiting": 13, "failed": 22195 }
}
```

---

## Quem cria `COORDINATE/congestionamento_fila`?

| Pergunta | Resposta |
|---|---|
| Quem? | `CoordinationDispatcher` (`coordination-dispatcher.ts`) |
| Quando? | Supervisor cycle com `queue.congested === true` (depth ≥ 10) |
| Condição? | Workspace com `needsAttention` ou `openMissions > 0` |
| Cria novas? | Sim — enqueue COORDINATE (com dedupe) |
| Recursão? | Não de depth DAG; feedback operacional via fila |

---

## Correções aplicadas

### Código (repo)

1. `PrismaOperationalMemoryStore`: FIFO eviction ao saturar quota.
2. `QueuedMissionExecutor.safePersistMemorySideEffects`: memória pós-`complete` não falha a missão.
3. `OperationalMissionService.runSync`: soft-fail em `persistMissionMemory`.
4. `EmployeeWorker`: log de `stack`, `workspaceId`, `objective` em `mission_failed`.
5. Teste: `quota: FIFO eviction…` em `memory-m1.integration.test.ts`.

### Dados (lab compartilhado)

Script: `apps/api/.ops/remediate-ad1-runtime-failure.ts`

- Arquivou 200 notes (`2000 → 1800` ativas).
- Cancelou 13 WAITING `resilience_dedupe`.

### Validação pós-fix

```text
POST /employees/operaia-ceo/ask
question: "O que merece atenção hoje?"
→ 200 OK — resposta OPERATIONAL_REVIEW da Opera
→ log: mission_completed (COORDINATE)
```

Health após remediação: `waiting=0`, congestão desarmada.

---

## Por que a mensagem amigável esconde a causa

`ExecutiveChat.vue` captura qualquer erro de `askCeo` e substitui por:

> "Não consegui concluir a missão agora. Verifique a API..."

**UI não foi alterada** (restrição da sprint). A causa real deve ser lida nos logs da API (`mission_failed.error` / `stack`).

---

## Deploy

O processo em `/opt/operaia-lab` precisa ser **redeployado** com o código desta correção para eviction + soft-fail permanentes. A remediação de dados já desbloqueou o lab atual.

```bash
# remediação (se necessário de novo)
pnpm --filter @operaia/api exec tsx --env-file-if-exists=../../.env .ops/remediate-ad1-runtime-failure.ts

# verificação
curl -sS -X POST http://127.0.0.1:3333/api/v1/employees/operaia-ceo/ask \
  -H 'content-type: application/json' \
  -d '{"workspaceId":"nexo","question":"O que merece atenção hoje?"}'
```

---

## Critérios de aceite A.D1

| Critério | Status |
|---|---|
| Causa raiz identificada | ✅ MemoryQuotaExceeded pós-complete |
| Stack/erro documentado | ✅ |
| Fluxo real mapeado | ✅ |
| Correção mínima | ✅ eviction + soft-fail + dados |
| Sem mudança arquitetural | ✅ |
| Ask real funcional após remediação | ✅ |

---

## Manutenibilidade

A falha veio do acoplamento rígido entre **índice derivado M1** e **terminalidade da missão**. Tratar quota com eviction FIFO e isolar side-effects pós-`complete` preserva a arquitetura Sprint A e evita que saturação de memória operacional derrube a organização digital. Próximo passo recomendado: redeploy do binário em `/opt`, monitorar `memory_side_effect_failed` / `quota_fifo_eviction`, e (opcional) job de arquivamento TTL — sem alterar Workers, Queue schema, Policy ou UI.
