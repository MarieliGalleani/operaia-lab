# ADR-007 — Consolidação do Mission System (MissionQueue como fonte oficial)

| Campo | Valor |
|-------|--------|
| **Status** | Aceito — **Fase 0 documentada** (handbook + testes de contrato); Fases 1–4 pendentes |
| **Data** | 2026-07-28 |
| **Contexto** | Consolidação Path A × Path B — Mission System |
| **Decisores** | OperaIA / Engenharia |
| **Relacionados** | [`docs/architecture/operational-supervisor.md`](../operational-supervisor.md); Handbook `03-mission-orchestration.md` |

---

## 1. Problema

O OperaIA.lab possui **dois caminhos** com semânticas diferentes para o que se chama “missão”:

| Caminho | Componentes | Persistência | Semântica |
|---|---|---|---|
| **Path A** | `OperationalMissionService` + `MissionOrchestrator` (+ `DelegationService` síncrono) | `OperationalRun` (em processo) | Execução assistida / síncrona; `employeeId` pode não ser a Opera |
| **Path B** | `MissionQueue` + `QueuedMissionExecutor` + Continuous Runtime | Prisma `Mission` + eventos | Fila distribuída: COORDINATE → EXECUTE → CONSOLIDATE |

### Riscos

- drift de comportamento entre sync e fila;
- auditoria e memória inconsistentes;
- bypass potencial da Opera no Path A;
- invariantes (owner, priority, kind) aplicadas no Supervisor mas não em todos os produtores;
- dificuldade de evoluir o Digital Office contínuo com duas “fontes da verdade”.

---

## 2. Decisão

**O Mission System oficial do OperaIA.lab é baseado em `MissionQueue`.**

Uma **Mission oficial** é a unidade operacional persistida na fila, com o fluxo:

```
COORDINATE
    ↓
Opera
    ↓
Delegation
    ↓
Matcher
    ↓
EXECUTE
    ↓
CONSOLIDATE
    ↓
Execution
    ↓
Memory
```

| Kind | Papel |
|---|---|
| **COORDINATE** | Entrada oficial; executada pela **Opera (CEO)** |
| **EXECUTE** | Trabalho de domínio; nasce **somente** após delegação da Opera |
| **CONSOLIDATE** | Fechamento pela Opera após filhos; dispara Execution Engine quando aplicável |

`packages/orchestration-engine` permanece motor genérico; **não** substitui este contrato de Mission do Digital Office.

---

## 3. Consequências

1. **Path A vira Assisted Execution legado** — kill-switch temporário (`ASSISTED_QUEUE_MODE=false`). **Não** é Mission oficial. Com default `ASSISTED_QUEUE_MODE=true` (Unified Mission Gateway Fase 1), HTTP Assisted/`ask` usam a Mission Queue.
2. **COORDINATE sempre pertence à Opera** — `ownerEmployeeId = operaia-ceo` (`CEO_EMPLOYEE_ID`).
3. **EXECUTE só nasce após delegação** — criado pelo fluxo pós-decisão da Opera (`QueuedMissionExecutor` / equivalente), nunca por entrada externa direta.
4. **Employee direto não representa Mission oficial** — chamar specialist sem COORDINATE/Opera está fora do Mission System (apenas Assisted Execution ou harness de teste, se explicitamente marcado).
5. **OperationalRun** deixa de ser a fonte da verdade; no máximo projeção/compat de resposta HTTP até migração completa.
6. **Supervisor** continua podendo criar COORDINATE operacional; **não** escolhe specialist, **não** define prioridade de negócio, **não** substitui a Opera.

---

## 4. Regras do contrato

### `ownerEmployeeId`

| Kind | Regra |
|---|---|
| COORDINATE | Sempre Opera (`CEO_EMPLOYEE_ID`) |
| CONSOLIDATE | Sempre Opera |
| EXECUTE | Definido/confirmado no **claim** do worker compatível com `requiredSpecialization` |

Proibido: owner specialist em missão raiz; cliente HTTP escolhendo specialist como owner de COORDINATE.

### `missionKind`

| Regra | Detalhe |
|---|---|
| Entrada externa (HTTP, Supervisor, planning autorizado) | Somente **COORDINATE** |
| EXECUTE | Somente pós-delegação da Opera |
| CONSOLIDATE | Somente pela fila quando filhos atingem estado terminal |

Proibido: API de produto criar EXECUTE ou CONSOLIDATE diretamente.

### `parentMissionId`

| Kind | Regra |
|---|---|
| COORDINATE (raiz) | `null` |
| EXECUTE | Obrigatório — aponta para o COORDINATE pai |
| CONSOLIDATE | Obrigatório — aponta para o COORDINATE raiz |

Dependências entre EXECUTEs usam `MissionDependency` (DAG), além do parent.

### `priority`

| Regra | Detalhe |
|---|---|
| Natureza | Prioridade **técnica de fila** (ordenação de claim), não roadmap de produto |
| Supervisor | Não envia priority de negócio → default de infra (`MEDIUM`) |
| HTTP usuário | Default `MEDIUM`; qualquer elevação exige política/governança explícita — nunca via Supervisor |
| Filhos | Herdam da raiz ou default; não re-priorizam portfólio |

Proibido: Matcher, Execution Engine ou Supervisor decidirem urgência estratégica.

### Quem pode criar COORDINATE

- Operational Supervisor (sinais operacionais);
- HTTP Runtime (objetivo de usuário/produto), com owner forçado Opera;
- Planejamento sob demanda da Opera (ex.: scheduler chamado como ferramenta da Opera — **não** como fallback do Supervisor).

### Employee direto

Permitido **apenas**:

- no fluxo oficial, como EXECUTE após delegação; ou
- em Assisted Execution / testes, **fora** do contrato Mission oficial.

---

## 5. Migração

Migração incremental **sem big-bang**, alinhada à proposta de consolidação:

| Fase | Objetivo | Quebra? |
|---|---|---|
| **Fase 0** | Documentar contrato (este ADR); Path B = oficial; Path A = Assisted Execution; testes de contrato | **Concluída** (handbook + `mission-system.contract.test.ts`) |
| **Fase 1** | Endurecer Path B: HTTP só COORDINATE + owner Opera; Scheduler isolado do Supervisor; testes de fila | Baixo |
| **Fase 2** | Fachada Assisted → enqueue COORDINATE (+ wait/poll opcional); resposta compat `OperationalRun` | Médio (latência) |
| **Fase 3** | Deprecar Path A sync puro; remover bypass `employeeId ≠ CEO` na API de produto; Run derivado da fila | Médio (API) |
| **Fase 4** | Limpeza: Assisted só harness/lab; observabilidade unificada; enum/lifecycle (`CREATED`/`CANCELLED`) conforme uso | Baixo |

Nenhuma fase desta ADR **implementa** código por si só — a implementação segue aprovação e planejamento por fase.

---

## 6. Alternativas consideradas

| Alternativa | Motivo da rejeição |
|---|---|
| Manter Path A e B como Missions oficiais iguais | Drift permanente e auditoria dupla |
| Tornar Path A (sync) a fonte oficial | Não escala com Continuous Runtime / workers / recovery |
| Eliminar Path A imediatamente | Quebra clients Operations / demos sem fachada |

---

## 7. Critérios de sucesso

- Toda Mission de produto passa pela `MissionQueue`.
- Toda raiz é COORDINATE com owner Opera.
- Nenhum EXECUTE nasce sem delegação da Opera.
- Supervisor e Assisted Execution respeitam os limites deste ADR.
- Documentação (handbook + architecture) não trata Path A como Mission oficial.

---

*ADR-007 — Mission System · OperaIA.lab*
