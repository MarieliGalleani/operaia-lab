# Decisão — OPERAIA_PROCESS_ROLE (Missão 3 / Deploy)

**Data:** 2026-07-27  
**Decisão:** manter **um único processo** com `OPERAIA_PROCESS_ROLE=all`.

## Validação no código

- Não há branch/entrypoint que interprete `OPERAIA_PROCESS_ROLE` em `apps/api`.
- Continuous Runtime, WorkerManager e Scheduler sobem no mesmo processo da API quando `CONTINUOUS_RUNTIME_ENABLED=true`.
- Separar units `operaia-runtime|worker|scheduler` **agora** duplicaria workers e claims na fila.

## Consequência operacional

| Unit | Ação no Deploy |
|------|----------------|
| `operaia-api.service` | Instalar, enable, start |
| `operaia-runtime.service` | **Não** instalar/enable |
| `operaia-worker.service` | **Não** instalar/enable |
| `operaia-scheduler.service` | **Não** instalar/enable |

Ordem efetiva de “subida”:

1. PostgreSQL (Docker Compose)  
2. `operaia-api` (API + Runtime + Workers + Scheduler no mesmo processo)

Health checks cobrem os quatro papéis via endpoints HTTP no mesmo processo.
