# Proposta técnica — Arquitetura de memória do OperaIA.lab

| Campo | Valor |
|-------|--------|
| **Status** | Proposta — **aguardando aprovação** |
| **ADR** | [ADR-008](./adr/ADR-008-memory-three-layers.md) |
| **Objetivo** | Permitir que funcionários digitais consultem histórico de decisões, missões e aprendizados — **sem memória infinita** |
| **Implementação** | Bloqueada até aprovação |

Complementa o handbook [`05-memory-system.md`](../engineering-handbook/05-memory-system.md) com a tipologia oficial em três camadas.

---

## 1. Problema

O Digital Office precisa de continuidade:

```
missões / decisões / resultados / aprendizados → briefing → nova decisão
```

Sem arquitetura explícita:

- tudo vira um único saco de texto;
- o volume cresce sem limite;
- contexto de negócio mistura-se com log técnico;
- risco de vazamento entre workspaces;
- Employees tendem a “buscar tudo” se tiverem acesso direto.

---

## 2. Princípios

1. **Memória finita e governada** — retenção, quota, `topK`, idade máxima.
2. **Três camadas** — operacional / estratégica / técnica.
3. **Derivada da verdade** — M1 deriva de Mission Queue + learnings; não substitui `Mission` / `MissionEvent`.
4. **Employees desacoplados** — orquestração carrega e injeta; brains só leem briefing.
5. **Scoped** — `workspaceId` obrigatório na consulta de produto.
6. **Promoção explícita** — M1 → M2 não é automática sem política / Human Oversight quando estrutural.
7. **Observável** — toda recuperação registra camada, filtros e ids de origem.

---

## 3. As três camadas

### 3.1 Memória operacional (M1)

**Para quê:** continuidade de execução e auditoria recuperável.

| Inclui | Não inclui |
|--------|------------|
| Missões executadas (resumo) | Roadmap / OKRs de negócio |
| Decisões do ciclo (Opera / specialist no escopo da missão) | Specs longas de arquitetura |
| Resultados (`usableResult`, status, gaps) | Corpus completo de código |
| Learnings operacionais (`MissionLearning`) | Chat livre com usuário |
| Referências a `missionId` / eventos | |

**Fontes canônicas:**

- `Mission` + `resultJson` + `MissionEvent` (ledger)
- `persistMissionMemory` (`kind: operational-run-summary`)
- `MissionLearning` / `recordMissionLearning`

**Consumidores típicos (via briefing):** Opera (coordenar), specialists (evitar retrabalho).

**Retenção sugerida (proposta):**

| Parâmetro | Valor inicial proposto |
|-----------|------------------------|
| Idade máxima | 90 dias (lab); configurável por workspace |
| Máx. registros / workspace | 2 000 resumos + learnings |
| `topK` default na missão | 5 |
| Compactação | Após N missões, sumarizar lote antigo → 1 registro “digest” e arquivar detalhe |

---

### 3.2 Memória estratégica (M2)

**Para quê:** intenção de negócio e prioridade — o “porquê” estável do workspace.

| Inclui | Não inclui |
|--------|------------|
| Objetivos do workspace / projeto | Logs de cada EXECUTE |
| Prioridades vigentes | Diffs de código |
| Contexto de negócio (cliente, restrições, tese) | Documentação técnica completa |
| Decisões estratégicas **aprovadas** / promovidas | |

**Fontes canônicas (propostas):**

- Artefatos curados de workspace (config / registro estratégico)
- Promoções explícitas a partir de consolidações da Opera (com gate humano se estrutural)
- Portfolio snapshot **somente** como input de leitura, não como write livre do Supervisor

**Consumidores típicos:** Opera (COORDINATE / CONSOLIDATE). Specialists recebem fatia mínima se a Opera incluir no briefing — não varrem M2 inteiro.

**Retenção sugerida:**

| Parâmetro | Valor inicial proposto |
|-----------|------------------------|
| Modelo | Versionado (atual + histórico curto) |
| Versões históricas | Últimas 20 por workspace |
| Escrita | Curada / baixa frequência |
| `topK` | 3–5 trechos de intenção |

---

### 3.3 Memória técnica (M3)

**Para quê:** contexto de sistema para execução técnica (Mag e papéis técnicos).

| Inclui | Não inclui |
|--------|------------|
| ADRs e docs de arquitetura indexados | Prioridades comerciais |
| Trechos / índices de código relevantes | Histórico completo de todas as missões |
| Padrões e runbooks técnicos | Decisões de produto não técnicas |
| Documentação de módulos | |

**Fontes canônicas (propostas):**

- Pipeline de ingestão de `docs/` + ADRs
- Índice de repositório (quando GitHub integrado — Fase 4+), sempre via Bridge → artefatos, **não** Employee falando com GitHub
- Handbooks versionados

**Consumidores típicos:** Mag / papéis técnicos via briefing filtrado por especialização.

**Retenção sugerida:**

| Parâmetro | Valor inicial proposto |
|-----------|------------------------|
| Modelo | Índice versionado por `docId` / `path` / `commit` |
| Invalidação | Reindexação sobe versão; versões antigas com TTL (ex.: 180 dias) |
| `topK` | 5–8 chunks |
| Quota | Máx. chunks / workspace ou / tenant |

---

## 4. Modelo lógico unificado

Uma porta de consulta, metadados obrigatórios:

```text
MemoryRecord
  id
  content
  embedding?          // evolução RAG
  metadata
    layer: operational | strategic | technical
    workspaceId       // obrigatório em produto
    tenantId?         // Fase 6
    kind              // ex.: operational-run-summary | org-learning | workspace-objective | adr-chunk
    missionId?        // M1
    sourceRef?        // missionId | learningId | docPath@rev
    createdAt
    expiresAt?        // retenção
    sensitivity?      // normal | restricted
```

```text
MemoryQuery
  text
  topK
  filter
    workspaceId
    layer?            // uma ou lista
    kind?
    maxAgeDays?
```

**Regra:** busca de produto **sempre** com `workspaceId`. Busca sem layer pode ser permitida só com `topK` baixo e política que prioriza M1+M2 para Opera e M3 para specialists técnicos.

---

## 5. Fluxo de uso (inalterado na forma, refinado na camada)

```
Antes da missão
  loadMemoryNotes(workspaceId, objective, layers[])
        ↓
  EmployeeContext.memoryNotes
        ↓
  EmployeeBriefing (EmployeeRunner)
        ↓
Durante
  Opera / specialists decidem (sem MemoryStore)
        ↓
Depois
  persist M1 (resumo + learning)
  (opcional) propor promoção → M2 (governança)
  M3 atualizado só por pipeline de ingestão — não a cada missão
```

### Quem escreve o quê

| Camada | Writer permitido |
|--------|------------------|
| M1 | Camada operacional (`OperationalMissionService`, `QueuedMissionExecutor`, adapters de learning) |
| M2 | Serviço de workspace strategy + governance (aprovação humana se estrutural) |
| M3 | Job/pipeline de indexação (docs/código) — **não** o Supervisor, **não** o Employee |

### Quem lê o quê

| Papel | Layers default na injeção |
|-------|---------------------------|
| Opera | M1 + M2 (+ M3 só se o objetivo for técnico) |
| Mag / técnico | M1 (recente) + M3 |
| Outros specialists | M1 + fatia de M2 se relevante ao papel |
| Supervisor | **Não consulta memória de domínio** — só estado de fila/workspace |

---

## 6. Anti-memória-infinita (controles)

| Controle | Descrição |
|----------|-----------|
| **TTL / expiresAt** | Exclusão ou arquivamento automático |
| **Quota por workspace** | Hard cap de registros ativos |
| **topK obrigatório** | Sem “trazer tudo” |
| **Compactação (digest)** | Resumos periódicos de M1 antigo |
| **Sem write de transcript bruto de LLM** | Só artefatos estruturados / resumos |
| **Redaction** | Secrets/PII não entram em content |
| **Arquivo frio** | Detalhe antigo fora do índice quente de busca |

Violação de quota: rejeitar store com erro operacional observável (não silenciar).

---

## 7. Relação com o que já existe

| Existente | Camada | Ação futura (após aprovação) |
|-----------|--------|------------------------------|
| `MemoryStore` contrato | Todas | Estender metadata (`layer`, `expiresAt`) sem quebrar API mínima |
| `operational-run-summary` | M1 | Marcar `layer: operational` |
| `MissionLearning` | M1 (e candidato a digest → M2) | Manter Prisma; espelhar/resumir no store de busca |
| `Mission` / `MissionEvent` | Ledger (não é “memory search”) | Continuam fonte de verdade; M1 deriva |
| `InMemoryMemoryStore` | Dev/test | Substituir default de produto por store persistente |
| Handbook tipos Mission/Decision/… | Conceito | Reconciliar com M1/M2/M3 na próxima revisão do handbook |

---

## 8. Integrações arquiteturais

```
MissionQueue (verdade de execução)
        ↓ deriva
   Memória operacional (M1)
        ↓ promoção governada
   Memória estratégica (M2)

Docs / ADRs / (futuro) índice Git
        ↓ ingestão
   Memória técnica (M3)

        ↓ retrieval
   Orquestração (notes)
        ↓
   Briefing → Employees
```

- **ADR-007:** memória não cria segundo caminho de missão.
- **Supervisor:** não grava M1/M2/M3 de domínio; pode no máximo emitir eventos operacionais próprios (histórico de ciclo — doc do Supervisor).
- **n8n / GitHub:** alimentam sinais → Queue; indexação técnica é pipeline separado.

---

## 9. Plano de implementação (somente após aprovação)

Ordem sugerida — **não executar agora**:

| Fase | Entrega |
|------|---------|
| A | Formalizar metadata `layer` + políticas de retenção no contrato/docs |
| B | Store persistente scoped (Postgres) para M1; migrar default de produto |
| C | API interna de retrieval por layer + testes de isolamento workspace |
| D | Curadoria M2 (modelo versionado + gate de promoção) |
| E | Pipeline M3 (docs/ADR primeiro; código depois com GitHub) |
| F | Compactação + quotas + métricas (`memory_hits`, `quota_exceeded`) |

Critérios de sucesso alinhados ao Plano Diretor: memória por workspace funcionando; zero vazamento; Employees sem import de `MemoryStore`.

---

## 10. Riscos

| Risco | Mitigação |
|-------|-----------|
| Virar dump infinito | Quotas + TTL + topK + proibir transcript bruto |
| Vazamento cross-workspace | Filtro obrigatório + testes |
| M2 poluído por M1 | Promoção explícita + Human Oversight |
| M3 desatualizado | Versionamento + reindex |
| Duplicar ledger da Mission | M1 sempre com `sourceRef` / `missionId` |

---

## 11. Fora de escopo desta proposta

- Implementação de código / migrations  
- UI de memória  
- Escolha final do modelo de embedding  
- Multi-tenant completo  
- Memória conversacional estilo chatbot infinito  

---

## 12. Aprovação

| Artefato | Status |
|----------|--------|
| ADR-008 | Aguardando aprovação |
| Esta proposta técnica | Aguardando aprovação |
| Código | **Não implementar** até aprovação explícita |

---

*Proposta técnica — Memória OperaIA.lab · v1.0*
