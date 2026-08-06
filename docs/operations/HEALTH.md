# Operational Health — OperaIA.lab

## Serviço

`@operaia/operational-health` → `OperationalHealthService.getHealth()`

Retorno:

```ts
{
  status,      // HEALTHY | DEGRADED | CRITICAL | UNKNOWN
  workers,
  queue,
  memory,
  actions,
  runtime,
  scheduler,
  warnings,
  evaluations,
  alerts
}
```

## Thresholds (default)

| Regra | Warning | Critical |
|---|---|---|
| Memory quota ratio | 80% | 95% |
| Queue WAITING | 20 | 50 |
| FAILED recentes (Quota) | 5 | 20 |
| Mission depth | 5 | 10 |
| Worker heartbeat age | 30s | 60s |

Configurável via `HealthRulesConfig` / `DEFAULT_HEALTH_RULES`.

## Wiring

O Supervisor (a cada ciclo) chama `operationalHealth.getHealth()` e emite `OPERATIONAL_ALERT` **sem criar missões**.

Adapters Prisma: `apps/api/src/modules/runtime/operational-hardening-adapters.ts`.
