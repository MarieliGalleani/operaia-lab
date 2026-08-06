# Failure Policy — OperaIA.lab

Política permanente após o incidente `MemoryQuotaExceededError` (A.D1 → A.5.3).

## Princípio

> Uma falha **NON_CRITICAL** nunca pode transformar uma missão **SUCCESS** em **FAILED**.

## OperationCriticality

| Nível | Exemplos |
|---|---|
| **CRITICAL** | mission.create, mission.claim, employee.execution, action.runtime, mission.complete, queue.state |
| **NON_CRITICAL** | memory.operational, analytics, metrics, telemetry, learning, usage.statistics |

Pacote: `@operaia/operational-health` → `OperationCriticality`, `FailurePolicy`.

## FailurePolicy

```ts
await defaultFailurePolicy.runNonCritical({
  operation: NonCriticalOperation.OPERATIONAL_MEMORY,
  run: () => persistMissionMemory(...),
  onFailure: (err) => logger.error(...),
});
```

- Operação NON_CRITICAL: erro é logado e engolido (missão permanece COMPLETED).
- Operação CRITICAL: não use `runNonCritical` — a falha deve propagar.

## Integração

- `QueuedMissionExecutor.safePersistMemorySideEffects` → FailurePolicy
- `OperationalMissionService.runSync` → FailurePolicy na persistência M1

## Observabilidade

Log estruturado `event=operation_criticality` com `workspace`, `correlationId`, `component`, `payload`.
