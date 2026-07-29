# ADR-009 — Domain Signal Layer

| Campo | Valor |
|-------|--------|
| **Status** | Aceito — **S1 core + S2 Ingestion Bridge** implementados; conectores externos pendentes |
| **Data** | 2026-07-28 |
| **Área** | Ingress / borda / eventos externos |
| **Decisores** | OperaIA / Engenharia |
| **Relacionados** | ADR-002, ADR-003, ADR-005, ADR-006, ADR-007, ADR-008; [`domain-signal-layer.md`](../domain-signal-layer.md); [Plano Diretor](../plano-diretor-operaia-lab.md) (Fase 4); [Operational Supervisor](../operational-supervisor.md) |

---

## 1. Contexto

O OperaIA.lab possui hoje:

| Capacidade | Situação |
|------------|----------|
| **Mission Queue** | Fonte oficial de missões (ADR-007) — COORDINATE → EXECUTE → CONSOLIDATE |
| **Operational Supervisor** | Infraestrutura que observa e pode enfileirar COORDINATE neutro (ADR-006) |
| **Memory M1** | Índice persistente de outcomes/learnings (`OperationalMemoryNote`) |
| **Ingress atual** | Principalmente HTTP assistido (`ask` / `operations/missions`) |

Há necessidade clara de receber **eventos externos** (GitHub, n8n, sistemas de domínio) sem:

- bypassar a Opera;
- criar `EXECUTE` direto;
- acoplar Employees a integrações;
- transformar webhooks em chat ou memória infinita.

O Plano Diretor (Fase 4) já exige DomainSignal aceito, Bridge autenticado e 100% das missões externas via Mission Queue. Falta a **decisão arquitetural formal** que amarra o desenho antes de migrations e conectores.

---

## 2. Decisão

Implementar uma **camada intermediária de Domain Signals** entre o mundo externo e a Mission Queue.

```
Fontes externas (GitHub, n8n, APIs)
        │
        ▼
Integration Bridge (auth / normalize)
        │
        ▼
Domain Signal Layer (lifecycle + dedupe)
        │
        ▼
Opera (decisão via COORDINATE)
        │
        ▼
Mission Queue (execução oficial)
```

### Princípios vinculantes

```
Signal informa.
Opera decide.
Mission executa.
```

1. Signal **nunca** executa ação de domínio diretamente.  
2. Signal **nunca** ignora a aprovação/decisão da Opera.  
3. Toda missão originada de sinal externo entra como **COORDINATE** com `ownerEmployeeId = Opera`.  
4. Employees **não** conhecem GitHub, n8n nem o Bridge (ADR-002 / Plano Diretor P3–P6).

A especificação detalhada permanece em [`domain-signal-layer.md`](../domain-signal-layer.md). Este ADR fixa o que é **obrigatório**.

---

## 3. DomainSignal

### 3.1 Propósito

Representar um **fato tipado, scoped e auditável** ocorrido na borda ou no mundo externo, para que o Digital Office possa considerá-lo.

Não é missão, não é ordem a specialist, não é transcript.

### 3.2 Lifecycle

```
detected → evaluated → converted → resolved
                ↘
              ignored | expired
```

| Status | Significado |
|--------|-------------|
| `detected` | Aceito pelo Bridge; persistido; autenticado |
| `evaluated` | Política decidiu: converter, ignorar ou diferir |
| `converted` | COORDINATE enfileirado; `missionId` preenchido |
| `resolved` | Ciclo do sinal fechado (missão terminal ou supersedido) |
| `ignored` | Fora de escopo / policy / duplicata semântica |
| `expired` | TTL sem ação |

**Regra:** nenhum `converted` sem avaliação prévia (exceto rejeição de auth na borda, que pode nem persistir).

### 3.3 Campos principais (contrato lógico)

| Campo | Papel |
|-------|--------|
| `id` | Identidade interna |
| `workspaceId` | Isolamento obrigatório |
| `type` | Tipo tipado (ex.: `github.pr.opened`) |
| `source` | Origem (`github`, `n8n`, `http`, …) |
| `externalId` | Id no sistema de origem |
| `deliveryId` | Id da entrega (anti-replay) |
| `signalHash` | Hash semântico (dedupe lógico) |
| `status` | Lifecycle acima |
| `payloadJson` | Dados redigidos (sem secrets) |
| `missionId` | Presente se `converted` |
| `evaluationJson` / `reason` | Auditoria da avaliação |
| `receivedAt` / timestamps de transição | Observabilidade |
| `correlationId` | Trace ponta a ponta |

---

## 4. WorkspaceSourceBinding

### 4.1 Propósito

Vincular uma **fonte externa** a um **workspace** de forma explícita e desligável.

### 4.2 Isolamento

| Regra | Obrigatório |
|-------|-------------|
| Sem binding válido | Sinal não entra no workspace (rejeitado ou ignored) |
| Binding `enabled=false` | Kill-switch da origem |
| Um evento | Escreve **somente** no `workspaceId` do binding |
| Vazamento A→B | Proibido; deve ser coberta por teste quando houver implementação |

Campos lógicos mínimos: `workspaceId`, `source`, `externalRef` (ex.: `owner/repo`), `enabled`, `configJson` (filtros; secrets fora do payload de sinal).

---

## 5. Diferença Signal vs Mission

| | **DomainSignal** | **Mission** |
|--|------------------|-------------|
| Pergunta | O que aconteceu? | O que vamos fazer? |
| Persistência | Ledger de ingress (futuro) | `Mission` / `MissionEvent` (ADR-007) |
| Pode existir sozinho? | Sim (ignored / expired) | Ciclo operacional completo |
| Cria EXECUTE? | **Nunca** | Só após delegação da Opera |
| Dedupe | `deliveryId` + `signalHash` | `objectiveHash` em COORDINATE aberto |

Signal **informa** a Opera; Mission **executa** o que a Opera decidir.

---

## 6. Deduplicação

| Camada | Chave | Efeito |
|--------|-------|--------|
| Delivery | `(source, deliveryId)` | Bloqueia replay do mesmo webhook/entrega |
| Semântica | `(workspaceId, signalHash)` | Mesmo fato lógico não multiplica sinais abertos |
| Fila | `enqueue({ dedupe: true })` na conversão | Alinha ao dedupe oficial da Mission Queue |

Atualizações do mesmo artefato externo (ex.: PR `synchronize`) devem atualizar ou versionar o sinal — **não** stormar COORDINATE a cada entrega sem avaliação.

---

## 7. Segurança

| Controle | Decisão |
|----------|--------|
| **HMAC** (ou equivalente) | Obrigatório no Bridge / webhooks |
| **Replay protection** | `deliveryId` único + validação de timestamp skew |
| **Workspace isolation** | Binding + `workspaceId` obrigatório em todo sinal de produto |
| **Redaction** | Secrets/tokens **fora** de `payloadJson`; raw opcional só em cold storage |
| **Allowlist de types** | Tipos não mapeados → ignored / reject |
| **Rate limit** | Por workspace / source (política de implementação) |

---

## 8. Integração

```
Signal Layer
    → (evaluated + convert)
    → MissionQueue.enqueue(COORDINATE, owner=Opera, dedupe=true)
    → Worker Opera
    → Opera decide (briefing + M1)
    → EXECUTE / CONSOLIDATE / Memory M1
    → Signal resolved (quando política amarrar ao terminal da missão)
```

| Produtor de COORDINATE | Gatilho |
|------------------------|---------|
| Domain Signal Layer | Evento externo |
| Supervisor | Sinal interno (backlog, stale, congestão) |
| Assisted HTTP | Humano / UI |

Supervisor **não** interpreta webhooks GitHub/n8n.  
Signal Layer **não** faz health/recovery de workers.

---

## 9. Limites (não negociáveis)

1. **Signal nunca executa ação diretamente** — sem side-effects de domínio no Bridge além de persistir/avaliar/enfileirar COORDINATE.  
2. **Signal nunca ignora a Opera** — proibido EXECUTE, proibido chamar Matcher/specialist, proibido Path A sync como destino de webhook.  
3. **Sem UI nesta decisão** — superfície humana continua ask/operations até fase própria.  
4. **Sem conectores nesta ADR** — GitHub/n8n só após plano de implementação aprovado.  
5. **Sem migration nesta ADR** — schema formaliza-se na fase de implementação (S1+).

---

## 10. Consequências

### Positivas

- Borda externa alinhada ao Mission System oficial.
- Opera permanece única autoridade de decisão.
- Correlação `deliveryId` → `missionId` viável (Plano Diretor F4-09).
- Isolamento workspace testável na borda.

### Trade-offs aceitos

- Mais uma entidade e lifecycle antes da missão (complexidade consciente).
- Latência de avaliação entre evento e COORDINATE.
- Necessidade de mapas `WorkspaceSourceBinding` (ops explícita).

---

## 11. O que esta ADR **não** decide

- Schema Prisma final / nomes de migration.
- Provider concreto de secrets.
- UI de inspeção de sinais.
- Detalhe de OpsSignal / MissionResultSignal (egress) — vizinhos, ADR futura se necessário.
- Implementação de conectores GitHub/n8n.

---

## 12. Status de implementação

| Item | Status |
|------|--------|
| Esta ADR | **Aceito** |
| Proposta técnica | [`domain-signal-layer.md`](../domain-signal-layer.md) |
| **S1 — Domain Signal Core** | **Implementado** — models, store, service, lifecycle, security utils, testes |
| **S2 — Ingestion Bridge** | **Implementado** — SourceBridge, Registry, InternalSourceBridge, DomainSignalIngestService (sem webhook/conectores) |
| **S3.0 — GitHub Signal Contract** | **Documento** — [`github-signal-contract.md`](../github-signal-contract.md) |
| **S3.1 — GitHubSourceBridge MVP** | **Implementado** — mapper + HMAC + ingest via S2; **sem** rota HTTP / enqueue |
| Conectores n8n / UI / webhook público / convert→Mission | Fora de escopo até missão explícita |

### Ajustes S1 (vs modelo inicial da ADR §6)

| Tema | Decisão S1 |
|------|-----------|
| `deliveryId` | Unique `(sourceType, deliveryId)` — idempotência de entrega |
| `signalHash` | **Não** unique — similaridade / lookup; não bloqueia eventos legítimos |
| `correlationId` | Obrigatório no ingest (gerado se ausente) — rastreio Signal → Evaluation → Mission → Learning |
| Evaluation | Auditável: `evaluationDecision` + `evaluationPolicy` + `evaluationReason` + `evaluationJson` |
| Convert | `markConverted(missionId)` só marca status; **não** chama MissionQueue |

---

*ADR-009 — Domain Signal Layer · OperaIA.lab*
