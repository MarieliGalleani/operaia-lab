# Operational Alerts — OperaIA.lab

Alertas internos registrados pelo Supervisor. **Não criam loops de COORDINATE.**

## Tipos

| Alert | Origem |
|---|---|
| `MEMORY_QUOTA_WARNING` | memória ≥ 80% |
| `MEMORY_QUOTA_CRITICAL` | memória ≥ 95% |
| `QUEUE_CONGESTION` | WAITING acima do threshold |
| `MISSION_DEPTH_HIGH` | depth (queued+running+waiting) alto |
| `WORKER_OFFLINE` | heartbeat stale |
| `FAILED_SPIKE` | spike de FAILED recentes |

## Evento Supervisor

`SupervisorEvent.OPERATIONAL_ALERT` — payload com `type`, `severity`, `message`, `workspaceId`.

## Log

```json
{
  "event": "operational_alert",
  "component": "operational-health",
  "workspaceId": "nexo",
  "correlationId": "...",
  "alertType": "MEMORY_QUOTA_WARNING",
  "timestamp": "..."
}
```

## Bus

`InMemoryAlertBus` — testes e ciclo do Supervisor. Persistência via `PersistingSupervisorLogger` / event store existente.
