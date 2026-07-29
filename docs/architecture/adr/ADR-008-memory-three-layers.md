# ADR-008 — Arquitetura de memória em três camadas (operacional, estratégica, técnica)

| Campo | Valor |
|-------|--------|
| **Status** | Proposto — **aguardando aprovação** (sem implementação) |
| **Data** | 2026-07-28 |
| **Área** | Memória / continuidade operacional |
| **Decisores** | OperaIA / Engenharia |
| **Relacionados** | Handbook `05-memory-system.md`; ADR-002, ADR-003, ADR-005, ADR-007; [`memory-architecture.md`](../memory-architecture.md) |

---

## 1. Contexto

O OperaIA.lab precisa que funcionários digitais (via briefing) consultem **histórico de decisões, missões e aprendizados**, sem cair em:

- memória infinita e não governada;
- vazamento entre workspaces;
- Employees acoplados a storage;
- mistura de fatos operacionais, intenção de negócio e conhecimento técnico.

Hoje existe:

| Capacidade | Situação |
|------------|----------|
| Contrato `@operaia/memory` (`MemoryStore`) | Estável |
| `persistMissionMemory` / `loadMissionMemoryNotes` | Operacional (resumo de missão) |
| `MissionLearning` (Prisma) + `recordMissionLearning` | Aprendizado por missão |
| `Mission.resultJson` / `MissionEvent` | Fonte de verdade da execução (ADR-007) |
| Default de produto | Frequentemente `InMemoryMemoryStore` (volátil) |
| Tipologia no handbook | Mission / Decision / Operational / Workspace — **ainda não** as três camadas oficiais pedidas |

Não há fronteira explícita entre memória de **execução**, memória de **negócio/estratégia** e memória de **técnica/arquitetura**.

---

## 2. Decisão

Adotar oficialmente **três camadas de memória**, com políticas de retenção finitas e isolamento por workspace (e, no Campus, por tenant):

| Camada | Nome | Conteúdo canônico |
|--------|------|-------------------|
| **M1** | **Memória operacional** | Missões executadas, decisões de ciclo, resultados, eventos, learnings operacionais |
| **M2** | **Memória estratégica** | Objetivos, prioridades, contexto de negócio, portfolio intent |
| **M3** | **Memória técnica** | Arquitetura, código indexado, documentação, ADRs, padrões técnicos |

### Regras vinculantes

1. **Não existe memória infinita** — toda camada tem retenção, teto de volume e/ou janela de consulta (`topK`, idade, quota).
2. **Employees nunca acessam storage diretamente** — só `memoryNotes` / briefing (ADR-002 / handbook).
3. **Mission Queue / `Mission` + `MissionEvent` são a fonte de verdade da execução**; a memória operacional é **visão recuperável derivada**, não um segundo ledger paralelo sem origem.
4. **Human Oversight** para promover conteúdo de M1 → M2 quando for mudança estrutural de objetivos/prioridades (ADR-005).
5. **Isolamento** — consulta sempre filtrada por `workspaceId` (e `tenantId` na Fase 6).

---

## 3. Motivação

- Continuidade entre missões sem amnésia e sem dump completo do histórico.
- Separar o que a Opera usa para **coordenar** (M1+M2) do que Mag/técnicos usam para **executar com contexto de sistema** (M3), sem misturar papéis.
- Preparar RAG sem transformar o office em “chat com corpus infinito”.
- Alinhar ao Plano Diretor (memória workspace-scoped, zero vazamento).

---

## 4. Consequências positivas

- Tipologia clara para produto, engenharia e governança.
- Políticas de retenção por camada (operacional mais curta/densa; estratégica curada; técnica versionada).
- Evolução de implementações (`InMemory` → Postgres/pgvector) atrás do contrato, por camada se necessário.
- Auditoria: cada nota recuperável aponta para origem (`missionId`, `docId`, `decisionId`).

---

## 5. Trade-offs aceitos

- Mais metadados e políticas do que um único bag de strings.
- Memória estratégica exige curadoria (não auto-write irrestrito a partir de toda missão).
- Memória técnica exige pipeline de ingestão (docs/código) separado do ciclo de missão.
- Até a implementação persistente, lab continua com store volátil — documentado como gap, não como alvo.

---

## 6. O que esta ADR **não** decide

- Schema Prisma final de cada tabela (ver proposta técnica).
- Provider de embedding concreto.
- UI de exploração de memória.
- Multi-tenant completo (apenas reserva de `tenantId` no modelo).

---

## 7. Status de implementação

| Item | Status |
|------|--------|
| Esta ADR | Proposta |
| Proposta técnica | [`memory-architecture.md`](../memory-architecture.md) |
| Código | **Não iniciar** até aprovação |

---

*ADR-008 — Memória em três camadas · OperaIA.lab*
