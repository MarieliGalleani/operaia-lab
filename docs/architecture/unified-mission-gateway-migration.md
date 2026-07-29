# Plano técnico — Unified Mission Gateway

| Campo | Valor |
|-------|--------|
| **Missão** | Eliminar Path A × Path B — Mission Queue como única porta |
| **ADR** | [ADR-007](./adr/ADR-007-mission-system-consolidation.md) |
| **Status** | **Fase 1 implementada** — Queue default; Path A kill-switch |
| **Data** | 2026-07-28 |

---

## 1. Problema

Hoje coexistem dois motores:

| Path | Fluxo | Persistência | Default produto |
|------|--------|--------------|-----------------|
| **A — Assisted sync** | `OperationalMissionService.runSync` → `MissionOrchestrator` → EmployeeRuntime | `OperationalRunStore` (RAM) | **Sim** (`ASSISTED_QUEUE_MODE=false`) |
| **B — Oficial** | `MissionQueue` → Workers → `QueuedMissionExecutor` → `Mission.resultJson` | Prisma | Usado por Supervisor + `POST /missions` |

ADR-007: Path B é Mission oficial; Path A é Assisted/lab.

**Objetivo desta missão:** um único gateway — Assisted e UI passam pela Queue; Path A sync deixa de ser caminho de produto.

---

## 2. Mapa do Path A (uso atual)

### 2.1 Endpoints envolvidos

| Endpoint | Módulo | Como entra no Path A |
|----------|--------|----------------------|
| `POST /api/v1/employees/:id/ask` | `employees.routes.ts` → `EmployeesApplication.ask` | `missions.run()` → **runSync** se flag off |
| `POST /api/v1/operations/missions` | `operations.routes.ts` | `runtime.service.run()` → idem |
| `POST /api/v1/operations/missions/nexo` | idem | Atalho NEXO → idem |
| `GET /api/v1/operations/missions` | idem | Lista **OperationalRun** (RAM) — não Mission Queue |
| `GET /api/v1/operations/missions/:id` | idem | Get OperationalRun (RAM) |

**Não são Path A** (já Path B / runtime):

| Endpoint | Papel |
|----------|--------|
| `POST /api/v1/missions` | Enfileira COORDINATE oficial |
| `GET /api/v1/missions` | Lista/árvore da Mission Queue |
| Supervisor / workers | Path B contínuo |

**UI web:** `apps/web/src/data/adapters/http-gateways.ts` → `POST /employees/:id/ask`  
Comentário legado em `ceo-responder.ts` ainda cita MissionOrchestrator.

### 2.2 Serviços envolvidos

```text
createProductLabRuntime()
  └─ createLabRuntime(preferQueue = ASSISTED_QUEUE_MODE)
        ├─ OperationalMissionService  ←── shared
        │     ├─ run() → runSync | runViaQueue
        │     ├─ MissionOrchestrator     (só Path A)
        │     ├─ OperationalRunStore     (ambos salvam projeção)
        │     └─ queue.bind(continuous.queue)
        ├─ EmployeesApplication(missions: service)  ← ask
        └─ operations.routes(lab.operations)         ← HTTP operations

ContinuousRuntime (paralelo)
  └─ MissionQueue + Workers + QueuedMissionExecutor + Supervisor
```

| Serviço / classe | Path A? | Notas |
|------------------|---------|-------|
| `OperationalMissionService` | Gateway dual | `runSync` = A; `runViaQueue` = B |
| `MissionOrchestrator` | **Só A** | Não usado por `QueuedMissionExecutor` |
| `EmployeesApplication.ask` | Via service | Mesma instância que Operations |
| `OperationalRunStore` | Compat HTTP | Volátil |
| `projectMissionTreeToOperationalRun` | Path B→HTTP | Projector parcial (stubs) |
| `waitUntilTerminal` | Path B Assisted | Bloqueia request até COMPLETED/FAILED |
| `QueuedMissionExecutor` | Só B | Orquestra fases na fila |
| `DelegationService` / Matcher / Runner | A e B | Compartilhados |
| `ops:nexo` | A por default | `createOperationalRuntime` sem ContinuousRuntime/flag |

### 2.3 Dependências críticas

| Dependência | Impacto na unificação |
|-------------|------------------------|
| `CONTINUOUS_RUNTIME_ENABLED=true` + workers vivos | Obrigatório para Path B Assisted; senão `waitUntilTerminal` timeout |
| `ASSISTED_QUEUE_MODE` | Interruptor A↔B no service |
| `bindQueue(continuous.queue)` | Já feito em `product-lab-runtime.ts` |
| Timeout HTTP / `wait` options | Path B é mais lento (LLM + fila); risco 504 |
| Projector `operational-run-from-queue` | Shape `OperationalRun` para UI/operations |
| `WorkflowStore` (ask) | Continua salvando workflow projetado |
| Memória InMemory | Ambos paths; não bloqueia unificação |
| Dedupe | `runViaQueue` usa `dedupe: false` hoje (vs runtime HTTP `dedupe: true`) — alinhar política |

### 2.4 O que precisa ser migrado

| Item | Ação |
|------|------|
| Default `ASSISTED_QUEUE_MODE` | `false` → `true` (lab/produto) |
| Contrato HTTP Assisted | Garantir resposta estável via projector; expor `missionId` da **Queue** |
| Timeouts | Configurar `waitUntilTerminal` + Fastify/proxy para missões longas |
| `ops:nexo` / proofs | Rodar com ContinuousRuntime + preferQueue |
| Testes Path A default | Atualizar expectativas; manter suíte sync só como legado marcado |
| Docs (handbook, ceo-responder, digital-team-online) | Path B como oficial; Orchestrator = legado |
| Política `employeeId` no ask | Path B já força Opera no enqueue — UI pedindo specialist direto muda comportamento (correto por ADR-007) |
| GET operations/missions | Migrar leitura para Queue ou documentar como projeção curta em RAM |

### 2.5 O que pode ser removido (só na Fase 4)

| Remover / descontinuar | Quando seguro |
|------------------------|---------------|
| `runSync` + branch Path A em `OperationalMissionService` | Após DoD Fase 3 + período de observabilidade |
| Chamadas de produto a `MissionOrchestrator.run` | Manter arquivo só para testes unitários de cadeia sync **ou** deletar se cobertos pelo executor |
| Default `preferQueue: false` | Fase 1 |
| Docs que dizem “Orchestrator é o único núcleo” | Fase 2–4 |
| Eventualmente `OperationalRunStore` como fonte | Substituir por leitura de Mission + projector on-demand |

**Não remover agora:** `MissionOrchestrator` em testes; Execution Engine; Delegation; EmployeeRuntime; projector (ainda necessário para shape HTTP).

### 2.6 Riscos de regressão

| Risco | Severidade | Mitigação |
|-------|------------|-----------|
| Timeout HTTP (Gemini lento / quota → fallback) | Alta | Timeout generoso; fallback on; métrica p95 |
| ContinuousRuntime down → ask quebra | Alta | Readiness gate; health; não ligar flag sem workers |
| Projector incompleto (llmEvents vazios, execution stub) | Média | Aceitar gap na Fase 1–2; fechar na Fase 3 |
| UI espera sync rápido; Path B demora | Média | UX já é request bloqueante — só aumentar timeout; sem nova tela |
| `ask` a non-Opera employee | Média | Path B força Opera — alinhar expectativa ADR-007 |
| Dedupe false vs true | Baixa | Definir política única no gateway |
| Testes e2e/`ops:nexo` ainda Path A | Média | Atualizar na Fase 1–2 |
| Dupla verdade OperationalRun vs Mission | Alta até Fase 4 | Tratar Run como projeção; Mission como verdade |

---

## 3. Insight de arquitetura (importante)

**Fase 2 não exige mudar a UI.**

`EmployeesApplication` já recebe o **mesmo** `OperationalMissionService` que Operations (`lab-runtime.ts`).  
Ativar `ASSISTED_QUEUE_MODE=true` faz:

```text
POST /employees/:id/ask  ──┐
                           ├──► service.run() ──► runViaQueue ──► MissionQueue
POST /operations/missions ─┘
```

A “Fase 2” no plano abaixo é **contrato + validação + docs + timeouts**, não um segundo redirect de código na web — a menos que se opte (opcional) por cliente chamar `POST /api/v1/missions` + poll (evolução async, fora do mínimo).

---

## 4. Plano de migração

### Fase 1 — Ativar `ASSISTED_QUEUE_MODE` — **CONCLUÍDA**

**Objetivo:** produto lab usa Path B atrás da fachada Assisted, sem remover Path A.

| # | Tarefa | Status |
|---|--------|--------|
| 1.1 | Default env / `.env.example`: `ASSISTED_QUEUE_MODE=true` | Feito |
| 1.2 | Pré-condição: `CONTINUOUS_RUNTIME_ENABLED=true` + readiness OK | Documentado |
| 1.3 | `ASSISTED_MISSION_WAIT_TIMEOUT_MS` + estado `timed_out` (HTTP 202) | Feito |
| 1.4 | `run.id` = Mission Queue id | Feito (projector) |
| 1.5 | Kill-switch `ASSISTED_QUEUE_MODE=false` → Path A | Mantido |
| 1.6 | `runSync` / MissionOrchestrator preservados | Mantido |

**Rollback:** `ASSISTED_QUEUE_MODE=false`.

---

### Fase 2 — Redirecionar UI/ask para Queue

**Objetivo:** tratar ask como cliente oficial do gateway unificado (já na Queue) com contrato estável.

| # | Tarefa |
|---|--------|
| 2.1 | Garantir `missionId` retornado = id da Mission Queue (hoje projector pode usar id do run — **alinhar**) |
| 2.2 | Headers/timeouts da API e do client web compatíveis com espera longa |
| 2.3 | Atualizar comentários web (`ceo-responder`, gateways) — fluxo = Queue |
| 2.4 | Testes: `employees.http.test`, `digital-office.e2e` ask path com preferQueue |
| 2.5 | (Opcional, não obrigatório) Evoluir UI para `POST /missions` + `GET /missions/:id` sem request bloqueante — **sem nova tela**, só adaptador |
| 2.6 | GET `/operations/missions` — documentar como cache/projeção; preferir Queue para auditoria |

**Critério de saída:** ask no escritório virtual completa missão auditável em Prisma; handbook atualizado.

---

### Fase 3 — Validar ciclo completo

**Objetivo:** DoD do Unified Mission Gateway.

| # | Cenário de aceite |
|---|-------------------|
| 3.1 | ask → COORDINATE → EXECUTE (Mag) → CONSOLIDATE → COMPLETED |
| 3.2 | operations/missions idem |
| 3.3 | Supervisor COORDINATE não conflita (dedupe/política) |
| 3.4 | Runtime HTTP `POST /missions` idempotent/coerente com Assisted |
| 3.5 | Health: workers 9/9; fallback observável se Gemini falhar |
| 3.6 | Reinício API: Mission permanece; OperationalRun some (esperado) — docs OK |
| 3.7 | Melhorar projector: reduzir stubs críticos **ou** expor tree da Queue na resposta |
| 3.8 | Suite: facade + assisted-queue-real + contract ADR-007 + e2e ask |

**Critério de saída:** checklist assinado; zero Path A em tráfego de produto (métrica/log `preferQueue=true` + orchestrator spy = 0).

**Prova operacional (Fase 3):** ver [`operational-cycle-proof.md`](./operational-cycle-proof.md) — checklist DoD + `pnpm --filter @operaia/api ops:operational-cycle-proof` + `operational-cycle.integration.test.ts`.

**Prova de resiliência (pré-Fase 4):** ver [`operational-resilience-proof.md`](./operational-resilience-proof.md) — restart / Supervisor dedupe / worker reclaim + `ops:operational-resilience-proof`.

---

### Fase 4 — Descontinuar Path A antigo

**Objetivo:** um motor só.

| # | Tarefa |
|---|--------|
| 4.1 | Remover `runSync` do caminho de produto (ou hard-fail se `preferQueue=false` em prod) |
| 4.2 | Deprecar flag ou inverter: só `false` em testes unitários isolados |
| 4.3 | `MissionOrchestrator`: manter como lib de teste **ou** extrair lógica já coberta pelo executor e deletar |
| 4.4 | Atualizar ADR-007 status / handbook: Assisted = fachada Queue only |
| 4.5 | Ops scripts sem Path A |
| 4.6 | Planejar substituto de `OperationalRunStore` (leitura Queue + projector) |

**Critério de saída:** nenhum código de produto chama `MissionOrchestrator` para servir HTTP; grep CI pode enforcer.

---

## 5. Ordem recomendada e esforço

| Fase | Esforço relativo | Risco | Dependência |
|------|------------------|-------|-------------|
| 1 | Pequeno | Médio (timeouts/runtime) | Continuous Runtime saudável |
| 2 | Pequeno–médio | Médio (contrato IDs) | Fase 1 |
| 3 | Médio | Médio | Fase 2 |
| 4 | Médio | Alto se precoce | Fase 3 estável ≥ 1 sprint |

**Não fazer em paralelo:** remover Path A antes do DoD da Fase 3.

---

## 6. Fora de escopo

- Novas interfaces / redesign web  
- GitHub / n8n (ingress externo — depois do gateway unificado)  
- Memória M1/M2/M3 completa (pode seguir em paralelo após Fase 1)  
- Multi-tenant  

---

## 7. Definição de pronto da missão “Unified Mission Gateway”

1. 100% das missões originadas de ask/operations em lab passam pela Mission Queue.  
2. Path A sync não é default nem usado em produto.  
3. Ciclo COORDINATE→EXECUTE→CONSOLIDATE validado via UI ask e via operations.  
4. Documentação ADR-007 / handbook alinhadas.  
5. Kill-switch temporário só até Fase 4; depois removido ou restrito a teste.  

---

## 8. Aprovação

| Item | Status |
|------|--------|
| Este plano | Aguardando aprovação |
| Implementação | **Bloqueada** |

Após aprovação, iniciar **Fase 1** (ativar flag + timeouts + smoke), sem remover Path A.

---

*Unified Mission Gateway — Plano técnico v1.0 · OperaIA.lab*
