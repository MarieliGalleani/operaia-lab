# Memory M1 — Design da camada persistente

| Campo | Valor |
|-------|--------|
| **Status** | M1.1 **implementado** — store Prisma + flag + testes |
| **Camada** | M1 — Memória operacional |
| **ADR** | [ADR-008](./adr/ADR-008-memory-three-layers.md) |
| **Proposta-mãe** | [memory-architecture.md](./memory-architecture.md) |
| **Próximo** | M1.3/M1.4 unificar load de learnings; M1.5 quotas/métricas em prod |

> Objetivo desta missão: definir como persistir M1 em PostgreSQL/Prisma **sem** memória infinita e **sem** memória de conversa.  
> Este documento **não** autoriza código, migrations nem troca do default de produto.

---

## 1. Problema e objetivo

Hoje o Digital Office já grava e lê notas operacionais via contrato `MemoryStore`, mas o default de produto é `InMemoryMemoryStore` (volátil). Após restart:

- resumos de missão somem do índice de busca;
- o espelho RAG de learnings some;
- `MissionLearning` (Prisma) e `Mission` / `MissionEvent` permanecem — verdade de execução não é o problema.

**Objetivo M1:** continuidade operacional entre missões e reinicializações, com índice recuperável **persistente**, scoped por workspace, finito e derivado do ledger.

### Inclui

1. **Mission outcomes** — objetivo, decisão, resultado, status final (como resumo recuperável)  
2. **Operational learnings** — lições, riscos, próximos passos / reuse-avoid  
3. **Workspace scoped context** — isolamento obrigatório por `workspaceId`

### Não inclui

| Proibido em M1 | Motivo |
|----------------|--------|
| Memória infinita | Quota + TTL + `topK` |
| Memória de conversa / transcript LLM | Só artefatos estruturados |
| M2 (estratégica) / M3 (técnica) | Camadas futuras |
| Segundo ledger de missão | ADR-007: `Mission` + `MissionEvent` continuam fonte de verdade |
| Employees importando `MemoryStore` | ADR-002 |

---

## 2. Estado atual (baseline)

| Peça | Situação |
|------|----------|
| Contrato `@operaia/memory` (`MemoryStore`) | Estável: `store` / `search` |
| `persistMissionMemory` / `loadMissionMemoryNotes` | `kind: operational-run-summary` |
| `recordMissionLearning` | Upsert Prisma `MissionLearning` + mirror no store (`organizational-learning`) |
| `loadOrganizationalLearningNotes` | Lê Prisma direto (já persistente) |
| Default produto | `InMemoryMemoryStore` via `createLabRuntime` |
| Ledger | `Mission.resultJson`, `MissionEvent`, status |

**Gap M1:** o índice de busca (`MemoryStore`) não sobrevive ao restart; metadata não carrega `layer` / `expiresAt`; não há quota/TTL no store.

---

## 3. Princípios de design

1. **Contrato intacto** — `MemoryStore.store` / `search` não mudam assinatura; metadata ganha campos convencionados.  
2. **Derivada da verdade** — M1 indexa resumos; não substitui `Mission` / `MissionLearning`.  
3. **Scoped hard** — `search` de produto **exige** `filter.workspaceId`; sem filtro → erro operacional (não resultado vazio silencioso).  
4. **Finita** — TTL, quota por workspace, `topK` default 5.  
5. **Sem chat** — `content` = texto curto estruturado; rejeitar payloads acima de teto de caracteres.  
6. **Sem vazamento** — testes de isolamento obrigatórios antes de trocar default de produto.  
7. **Employee Runtime intacto** — continua recebendo só `memoryNotes[]` no briefing.

---

## 4. Modelo de dados

### 4.1 Separação de responsabilidades

```
┌─────────────────────────────────────────────────────────────┐
│ FONTE DE VERDADE (já existe)                                │
│  Mission (+ resultJson, status)                             │
│  MissionEvent                                               │
│  MissionLearning                                            │
└───────────────────────────┬─────────────────────────────────┘
                            │ deriva (write path atual)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ ÍNDICE RECUPERÁVEL M1 (novo)                                │
│  OperationalMemoryNote  ←  implementa MemoryStore           │
│  (Postgres / Prisma)                                        │
└───────────────────────────┬─────────────────────────────────┘
                            │ search(topK, workspaceId)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Orquestração → EmployeeContext.memoryNotes → Briefing       │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Entidade nova: `OperationalMemoryNote`

Tabela proposta (Prisma). Nome de mapa: `operational_memory_notes`.

| Campo | Tipo | Regra |
|-------|------|--------|
| `id` | `String` @id (UUID) | = `MemoryRecord.id` |
| `workspaceId` | `String` | **obrigatório**; isolamento |
| `content` | `String` | resumo curto (cap ~2–4 KB) |
| `layer` | `String` | default `"operational"` (M1) |
| `kind` | `String` | ver §4.3 |
| `missionId` | `String?` | origem de outcome / learning |
| `learningId` | `String?` | FK lógica → `MissionLearning.id` quando kind = learning |
| `sourceRef` | `String?` | ex.: `mission:{id}` / `learning:{id}` |
| `statusFinal` | `String?` | ex.: `COMPLETED` / `FAILED` (outcomes) |
| `objective` | `String?` | denormalizado para filtro/score |
| `decision` | `String?` | fatia estruturada opcional |
| `resultSummary` | `String?` | fatia estruturada opcional |
| `risksJson` | `Json?` | riscos (learnings) |
| `nextActionsJson` | `Json?` | próximos passos / reuse-avoid |
| `metadataJson` | `Json?` | demais metadata do contrato |
| `embedding` | `Unsupported("vector")?` | **fora de M1-v1** (fase RAG) |
| `createdAt` | `DateTime` | |
| `expiresAt` | `DateTime?` | TTL |
| `archivedAt` | `DateTime?` | fora do índice quente |

**Índices:**

```text
@@index([workspaceId, createdAt])
@@index([workspaceId, kind, createdAt])
@@index([workspaceId, expiresAt])
@@index([missionId])
@@unique([workspaceId, sourceRef, kind])  // upsert idempotente por origem
```

> `@@unique([workspaceId, sourceRef, kind])` evita duplicar o mesmo outcome/learning no índice em re-consolidações / retries.

### 4.3 Kinds M1 (fechados)

| `kind` | Conteúdo | Writer |
|--------|----------|--------|
| `operational-run-summary` | Outcome: objetivo + resumo + status | `persistMissionMemory` |
| `organizational-learning` | Learning: lição, riscos, reuse/avoid | `recordMissionLearning` |
| `operational-digest` | Compactação de lote antigo | job de retenção (fase posterior à troca do store) |

**Kinds proibidos em M1:** `chat-message`, `llm-transcript`, `raw-tool-log`.

### 4.4 Mapeamento dos três pilares

| Requisito | Persistência estruturada | Índice M1 (`kind`) |
|-----------|--------------------------|--------------------|
| Mission outcomes | `Mission` + `resultJson` + status | `operational-run-summary` (`objective`, `decision`/`resultSummary`, `statusFinal`) |
| Operational learnings | `MissionLearning` | `organizational-learning` (`risksJson`, `nextActionsJson`, lição no `content`) |
| Workspace scoped | `workspaceId` em toda linha | `search` sempre com `filter.workspaceId` |

### 4.5 Entidades existentes (sem mudança de papel)

| Entidade | Papel após M1 |
|----------|----------------|
| `Mission` | Ledger de execução |
| `MissionEvent` | Auditoria de ciclo |
| `MissionLearning` | Artefato estruturado 1:1 missão (já persistente) |

`MissionLearning` **não** é removido. O store passa a ser o índice unificado de busca; `loadOrganizationalLearningNotes` pode, na migração, passar a preferir `MemoryStore.search({ filter: { kind: "organizational-learning", workspaceId } })` **ou** manter dual-read temporário (ver §8).

---

## 5. Contrato `MemoryStore` (compatibilidade)

### 5.1 API (inalterada)

```typescript
// packages/memory/src/memory-store.ts — manter
interface MemoryStore {
  store(record: MemoryRecord): Promise<void>;
  search(query: MemoryQuery): Promise<readonly MemorySearchResult[]>;
}
```

### 5.2 Convenções de metadata (M1)

Escrita (`store`):

```text
metadata.workspaceId   // obrigatório
metadata.layer         // "operational"
metadata.kind          // operational-run-summary | organizational-learning | …
metadata.missionId?    
metadata.sourceRef?    
metadata.statusFinal?  
metadata.expiresAt?    // ISO string; senão default = now + maxAgeDays
```

Leitura (`search.filter`):

```text
filter.workspaceId     // obrigatório em PrismaMemoryStore (produto)
filter.layer?          // default "operational"
filter.kind?           // opcional
filter.maxAgeDays?     // opcional; senão política default
```

### 5.3 Implementação proposta

| Classe | Pacote sugerido | Uso |
|--------|-----------------|-----|
| `PrismaOperationalMemoryStore` | `@operaia/memory` ou `apps/api` adapter | Produto / integração |
| `InMemoryMemoryStore` | `@operaia/workspace-runtime` | Testes unitários / lab isolado sem DB |

Comportamento `store`:

1. Validar `workspaceId`, `kind` permitido, tamanho de `content`.  
2. Resolver `expiresAt` (TTL).  
3. Checar quota do workspace (ativos não arquivados).  
4. Upsert por `(workspaceId, sourceRef, kind)` quando `sourceRef` presente; senão insert.  
5. Em quota excedida: **erro observável** (não silenciar).

Comportamento `search`:

1. Exigir `workspaceId`.  
2. Filtrar `layer=operational`, não arquivados, `expiresAt > now` (ou null).  
3. Score inicial: lexical (paridade com `InMemoryMemoryStore`); embeddings = evolução.  
4. `topK` default 5, hard cap (ex.: 20).

---

## 6. Fluxo de leitura / escrita

### 6.1 Escrita (após missão)

```
COORDINATE (resposta direta) | CONSOLIDATE | Path A sync
        │
        ├─► persistMissionMemory(memory, { workspaceId, missionId, objective, summary })
        │     content = Workspace / Objetivo / Resumo
        │     kind = operational-run-summary
        │     statusFinal = COMPLETED | FAILED | …
        │
        └─► recordMissionLearning(memory, { … lição, risks, reuse/avoid … })
              1) upsert MissionLearning (Prisma)     ← verdade estruturada
              2) memory.store(organizational-learning) ← índice M1
```

**EXECUTE:** continua gravando learning quando aplicável; resumo de outcome da árvore permanece na consolidação da raiz (comportamento atual — não expandir escopo nesta missão).

### 6.2 Leitura (antes da missão)

```
QueuedMissionExecutor / OperationalMissionService
        │
        ├─ loadOperationalMemoryNotes(memory, { workspaceId, objective })
        │    → MemoryStore.search (summaries + learnings, dedupe)
        │    → fallback MissionLearning só se MEMORY_M1_LEARNING_FALLBACK=true
        │
        └─ (opcional) portfolio notes — NÃO é M1 store
                │
                ▼
        context.memoryNotes: string[]
                │
                ▼
        EmployeeRunner.attachMemoryNotes
          → briefing.history += notes
          → briefing.additional.memoryContext = notes
```

`loadOrganizationalLearningNotes(memory, …)` também lê só o índice; `loadOrganizationalLearningNotesFromPrisma` fica restrito ao fallback de migração.

### 6.3 Diagrama ponta a ponta

```
Restart API
  → PrismaOperationalMemoryStore lê Postgres
  → missões novas recuperam M1 do workspace
  → Employees veem continuidade no briefing
  → sem acesso a outros workspaces
```

---

## 7. Lifecycle

### 7.1 Estados do registro

| Estado | Condição | Visível no `search`? |
|--------|----------|----------------------|
| **Active** | `archivedAt IS NULL` e (`expiresAt` null ou futuro) | Sim |
| **Expired** | `expiresAt <= now` | Não (job pode arquivar) |
| **Archived** | `archivedAt` setado | Não (arquivo frio; ledger Mission permanece) |

### 7.2 Políticas iniciais (lab)

| Parâmetro | Valor proposto |
|-----------|----------------|
| `maxAgeDays` | 90 |
| Quota ativos / workspace | 2 000 |
| `topK` default | 5 |
| Cap `topK` | 20 |
| Cap `content` | 4 096 chars |
| Compactação | Fase F (digest) — **após** store persistente estável |

### 7.3 Jobs (design; implementação em fases)

1. **Expire/Archive** — marca `archivedAt` onde `expiresAt` passou.  
2. **Digest (opcional)** — N resumos antigos → 1 `operational-digest`; arquiva detalhe.  
3. **Quota enforcement** — no `store` (síncrono) + métrica `memory_quota_exceeded`.

Supervisor **não** escreve M1 de domínio (ADR-008 / memory-architecture).

---

## 8. Integração com briefing dos funcionários

### 8.1 Fronteira

| Camada | Responsabilidade |
|--------|------------------|
| Orquestração (`QueuedMissionExecutor`, `OperationalMissionService`) | Load + persist via `MemoryStore` |
| `EmployeeRunner` | Injeta `memoryNotes` no `EmployeeBriefing` |
| Brains (Opera, Mag, …) | Leem só briefing — **zero** import de storage |

### 8.2 O que o funcionário “vê”

Strings curtas, tipicamente:

```text
Workspace: …
Objetivo: …
Resumo: …          // outcome

[LEARNING]… | reutilizar: … | evitar: …   // learning
```

Não há thread de conversa; não há histórico infinito no briefing — só `topK` notas ranqueadas.

### 8.3 Isolamento no briefing

- Toda nota carregada já veio filtrada por `workspaceId` da missão.  
- Teste obrigatório: missão no workspace A **não** recebe notes do workspace B.  
- Path sync e path fila devem usar o **mesmo** `MemoryStore` de produto após cutover.

---

## 9. Estratégia de migração

### 9.0 Plano Prisma M1.1 (aprovado / aplicado)

| Item | Decisão |
|------|--------|
| Migration | `20260728200000_operational_memory_m1` — **aditiva** |
| Tabela | `operational_memory_notes` |
| Unique | `(workspaceId, sourceType, sourceId, kind)` |
| Rastreio | `sourceType`, `sourceId`, `origin` |
| Alterações em Mission/Learning | **Nenhuma** |
| Rollback app | `MEMORY_STORE=inmemory` |
| Rollback DB | tabela pode permanecer ociosa |

### 9.1 Fases (somente M1; M2/M3 fora)

| Fase | Entrega | Critério de saída |
|------|---------|-------------------|
| **M1.0** | Aprovar este design + ADR-008 (escopo M1) | ✅ |
| **M1.1** | Migration Prisma `OperationalMemoryNote` + `PrismaOperationalMemoryStore` | ✅ (`MEMORY_STORE`, testes) |
| **M1.2** | Wire em `createProductLabRuntime` / flag | ✅ |
| **M1.3** | Backfill opcional a partir de `MissionLearning` + missões COMPLETED recentes | ✅ (API `backfillOperationalMemory`) |
| **M1.4** | Unificar load de learnings via `search` (deprecar dual-read) | ✅ `loadOperationalMemoryNotes` + flag `MEMORY_M1_LEARNING_FALLBACK` |
| **M1.5** | TTL/quota + prova de resiliência de memória | Parcial (TTL/quota no store; proof CLI pendente) |

**Não** fazer na mesma PR: embeddings/pgvector, M2, M3, UI, remoção de `MissionLearning`.

### 9.2 Feature flag sugerida

```text
MEMORY_STORE=inmemory|prisma   // default produto: prisma após M1.2
```

Kill-switch: voltar `inmemory` sem rollback de schema (tabela pode ficar ociosa).

### 9.3 Backfill (M1.3)

1. Para cada `MissionLearning` dos últimos `maxAgeDays`:  
   - criar note `organizational-learning` com `sourceRef=learning:{id}`.  
2. Para cada `Mission` COMPLETED com `resultJson.usableResult` (ou consolidado):  
   - criar note `operational-run-summary` com `sourceRef=mission:{id}` (se ainda não existir).  
3. Idempotente via unique `(workspaceId, sourceRef, kind)`.

Dados voláteis antigos do `InMemoryMemoryStore` **não** são migráveis (perdidos por definição).

### 9.4 Ordem de deploy

```
1. migrate schema (additive)
2. deploy código com PrismaOperationalMemoryStore atrás da flag (off)
3. enable flag em lab
4. backfill
5. testes isolamento + restart
6. default on em produto
7. manter InMemory só para unit tests
```

### 9.5 Rollback

- Desligar flag → `InMemoryMemoryStore`.  
- Tabela permanece (sem drop).  
- Ledger `Mission` / `MissionLearning` intacto.

---

## 10. Plano de testes (quando implementar)

| Teste | Assert |
|-------|--------|
| Unit store | `store` + `search` com filtro workspace |
| Isolamento | workspace A não vê B |
| Restart | notes presentes após novo process/`$disconnect` |
| Quota | store falha de forma observável ao estourar |
| TTL | expirados fora do `search` |
| Contrato | `persistMissionMemory` / `recordMissionLearning` sem mudança de assinatura |
| Briefing | `memoryNotes` injetados; Employee sem import MemoryStore |
| Integração fila | consolidate → note M1 → próxima COORDINATE recupera |

Prova sugerida (após código): `ops:memory-m1-proof` espelhando o padrão cycle/resilience — **não criar agora**.

---

## 11. Definition of Done (implementação futura)

- [ ] `OperationalMemoryNote` no Prisma + migration  
- [ ] `PrismaOperationalMemoryStore` implementa `MemoryStore`  
- [ ] Produto usa store persistente (flag → default)  
- [ ] Outcomes + learnings no índice M1  
- [ ] Isolamento workspace coberto por teste  
- [ ] Continuidade após restart comprovada  
- [ ] Quota/TTL mínimos ativos  
- [ ] Sem transcript/chat  
- [ ] Employee Runtime inalterado na fronteira de briefing  
- [ ] Path A **não** removido; memória não depende de Path A  

---

## 12. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Duplicar ledger | Unique por `sourceRef`; content = resumo |
| Quota silenciada | Erro + métrica |
| Vazamento | `workspaceId` obrigatório + testes |
| Dual-read divergente | Cutover M1.4 cedo |
| Embeddings prematuros | Fora de M1-v1 |
| Backfill pesado | Janela `maxAgeDays`; batch |

---

## 13. Fora de escopo deste design

- Implementação de código / Prisma migrate  
- M2 / M3  
- pgvector / embeddings de produção  
- UI de exploração  
- Memória conversacional  
- Multi-tenant (`tenantId` só reservado em metadata futura)  
- Remoção do Path A  

---

## 14. Aprovação

| Item | Status |
|------|--------|
| Este design M1 | Aguardando aprovação |
| ADR-008 (camada M1) | Alinhado; implementação ainda bloqueada |
| Código | **Não implementar** até go explícito |

Após aprovação: executar fases **M1.1 → M1.5** sem abrir M2/M3.

---

### Referências de código (baseline)

- `packages/memory/src/memory-store.ts`  
- `packages/workspace-runtime/src/defaults/in-memory-memory-store.ts`  
- `apps/api/src/modules/operations/mission-memory.ts`  
- `apps/api/src/modules/organization/mission-learning.ts`  
- `apps/api/src/modules/runtime/queued-mission-executor.ts`  
- `apps/api/src/modules/operations/lab-runtime.ts`  
- `packages/database/prisma/schema.prisma` (`Mission`, `MissionLearning`, `MissionEvent`)  
- `packages/employee-runtime` (briefing / `memoryNotes`)

---

*Memory M1 Persistent Layer — Design · OperaIA.lab · sem implementação nesta etapa*
