# Automatic Maintenance — OperaIA.lab

Rotinas periódicas idempotentes (`OperationalMaintenance`), disparadas pelo Supervisor a cada N ciclos (default 5).

## Memory

| Rotina | Ação |
|---|---|
| `memory.archive_expired` | `archivedAt` onde `expiresAt` passou |
| `memory.preventive_eviction` | FIFO até `memoryTargetActiveMax` (default 1600 = 80% de 2000) |

Eviction sob quota no `store()` permanece em `PrismaOperationalMemoryStore` (A.D1).

## Mission Queue

| Rotina | Ação |
|---|---|
| `queue.cancel_orphan_waiting` | Cancela WAITING de resilience proof / pinned |
| `queue.purge_expired_retries` | FAILED em QUEUED antigos com Quota M1 esgotado |

## Execution Ledger

| Rotina | Ação |
|---|---|
| `ledger.purge_old` | Remove `ActionExecution` mais antigos que N dias (default 30) |

## Evento

`SupervisorEvent.MAINTENANCE_RAN` + log `event=maintenance_execution`.

## Remediação manual (ops)

```bash
pnpm --filter @operaia/api exec tsx --env-file-if-exists=../../.env \
  .ops/remediate-ad1-runtime-failure.ts
```
