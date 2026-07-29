# Domain Signal Layer — Arquitetura

| Campo | Valor |
|-------|--------|
| **Status** | Proposta técnica — ADR **aceito**; **S1 + S2 implementados** |
| **Versão** | 1.2 |
| **Escopo** | Sinais externos → avaliação → (opcional) Mission Queue |
| **ADR** | [ADR-009](./adr/ADR-009-domain-signal-layer.md) |
| **Relacionados** | [Plano Diretor](./plano-diretor-operaia-lab.md) (Fase 4), [ADR-007](./adr/ADR-007-mission-system-consolidation.md), [Operational Supervisor](./operational-supervisor.md), [Memory M1](./memory-m1-design.md) |
| **Implementação** | S1 core + S2 Internal ingest bridge; S3.0 contrato GitHub (doc); Bridge GitHub / UI / n8n / webhook ainda fora |

---

## Princípio norteador

```
O Signal informa.
A Opera decide.
A Mission executa.
```

| Papel | Faz | Não faz |
|-------|-----|---------|
| **Domain Signal** | Representa um fato externo (ou interno de borda) com contexto mínimo | Não é trabalho; não escolhe specialist; não fala com usuário |
| **Opera (CEO)** | Interpreta sinais + memória + workspace e decide COORDINATE → delegar ou não | Não recebe webhook bruto do GitHub/n8n |
| **Mission** | Unidade oficial na Mission Queue (COORDINATE → EXECUTE → CONSOLIDATE) | Não substitui o registro do sinal |

Employees **nunca** conhecem GitHub, n8n ou APIs externas (Plano Diretor P3/P5).  
n8n é **integração**, não inteligência (P6).

---

## 1. Conceito de Domain Signal

Um **Domain Signal** é um evento de domínio **normalizado**, **scoped** e **auditável**, que diz:

> “Algo aconteceu no mundo (ou na borda) que o Digital Office pode precisar considerar.”

Não é:

- um chat;
- uma missão;
- uma ordem para Mag/Luna;
- um dump de payload externo.

É:

- um **fato tipado** (`type` + `payload` estruturado);
- amarrado a um **workspace** (e, no futuro, tenant);
- com **origem** rastreável (`source`, `externalId`, `deliveryId`);
- sujeito a **dedupe** e **lifecycle** próprios.

### Tipos conceituais (camadas de sinal)

| Família | Nome | Direção | Exemplos |
|---------|------|---------|----------|
| **DomainSignal** | Sinal de domínio | Mundo → Office | PR aberta, issue, push, fatura, lead WhatsApp |
| **OpsSignal** | Sinal operacional (egress/ops) | Office → mundo / ops | Pedido do Supervisor para n8n alertar; health fan-out |
| **MissionResultSignal** | Resultado de missão | Office → mundo | Comentário em PR, callback n8n pós-COMPLETED |

Este documento foca em **DomainSignal** (ingress). OpsSignal e MissionResultSignal são vizinhos de borda (Fase 4/5) e não devem misturar-se no mesmo lifecycle sem tipagem explícita.

### Relação com o que já existe

| Hoje | Papel |
|------|--------|
| HTTP ask / operations | Ingress **humano/assistido** → já vira Mission (Queue) |
| Supervisor scans | Sinais **internos** de infra/workspace → COORDINATE neutro |
| Mission Queue | Única porta oficial de execução (ADR-007) |
| Memória M1 | Continuidade de **resultados/learnings**, não substitui Signal |

A Domain Signal Layer é a **aduana de eventos externos** antes de qualquer COORDINATE.

---

## 2. Diferença entre Signal e Mission

| Dimensão | Domain Signal | Mission |
|----------|---------------|---------|
| **Pergunta** | O que aconteceu? | O que vamos fazer? |
| **Quem cria** | Bridge / ingress autenticado | Opera (via Queue) ou Supervisor (COORDINATE neutro) ou Assisted HTTP |
| **Persistência** | Tabela de sinais (proposta) | `Mission` + `MissionEvent` (já existe) |
| **Owner** | Sistema / origem externa | Sempre Opera em COORDINATE oficial |
| **Pode existir sem missão?** | Sim (avaliado e descartado) | Não faz sentido sem objetivo operacional |
| **Pode gerar EXECUTE direto?** | **Não** | EXECUTE só após delegação da Opera |
| **Dedupe** | Por `signalHash` / `deliveryId` | Por `objectiveHash` (COORDINATE aberto) |
| **TTL típico** | Curto–médio (evento) | Ciclo operacional completo |

```
DomainSignal  ──avalia──►  (ignorar | aguardar | propor COORDINATE)
                              │
                              ▼
                         Mission (COORDINATE)
                              │
                              ▼
                         Opera decide
                              │
                              ▼
                         EXECUTE / CONSOLIDATE / Memory M1
```

**Invariante:** nenhum conector cria `EXECUTE` ou chama specialist.

---

## 3. Fontes futuras

### 3.1 GitHub

Contrato de domínio formal: [`github-signal-contract.md`](./github-signal-contract.md) (**S3.0**).

| Evento (exemplos) | Sinal tipado (exemplo) | Uso esperado |
|-------------------|------------------------|--------------|
| `pull_request` opened/sync | `github.pr.opened` / `github.pr.updated` | Opera avalia impacto no workspace mapeado |
| `issues` opened/labeled | `github.issue.opened` | Backlog / priorização |
| `push` em branch protegida | `github.push` | Atenção se afetar NEXO/mapa |

**Regras:**

- Repositório → `workspaceId` via **mapa explícito** (não inferência solta).
- Webhook HMAC + rejeição de replay (Plano Diretor F4-08).
- `deliveryId` GitHub correlacionável até `missionId` (F4-09).

### 3.2 n8n

| Papel do n8n | Sinal |
|--------------|--------|
| Fan-in de WhatsApp, Gmail, agenda, ERPs | DomainSignal tipado pelo Bridge |
| Automação sem decisão | Nunca “decide” missão; só entrega sinal |
| Fan-out ops | Consome OpsSignal / MissionResultSignal (egress) |

**Regras:**

- Bridge autenticado (HMAC/secret por workspace ou tenant futuro).
- n8n **não** enfileira Mission diretamente; publica Signal (ou chama Bridge).
- Stacks n8n existentes na VPS permanecem borda — não misturar com deploy da app sem aprovação.

### 3.3 Sistemas externos (genéricos)

Qualquer sistema que emita eventos (CRM, billing, monitoring, APIs internas):

1. Normaliza para DomainSignal no Bridge;
2. Autentica + dedupe;
3. Encaminha ao avaliador;
4. Só então (talvez) COORDINATE.

**Anti-padrões:**

- Webhook → `MissionOrchestrator` sync (Path A)  
- Webhook → Mag direto  
- Payload bruto no briefing do Employee  

---

## 4. Modelo de dados inicial

Proposta lógica (Prisma futuro — **não migrar agora**).

### 4.1 `DomainSignal`

| Campo | Tipo | Regra |
|-------|------|--------|
| `id` | UUID | PK |
| `workspaceId` | string | **obrigatório** — isolamento |
| `tenantId` | string? | Reserva Campus (Fase 6) |
| `type` | string | ex.: `github.pr.opened` |
| `source` | enum/string | `github` \| `n8n` \| `http` \| `internal` \| … |
| `externalId` | string? | Id no sistema de origem |
| `deliveryId` | string | Id da entrega (webhook delivery / bridge id) |
| `signalHash` | string | Hash estável para dedupe |
| `status` | enum | ver lifecycle §6 |
| `severityJson` | Json | Dados **redigidos** (sem secrets) |
| `rawRef` | string? | Ponteiro opcional a blob frio (não no briefing) |
| `severityVersion` | int | Evolução de schema do tipo |
| `severityAt` | DateTime | Quando o evento ocorreu na origem (se conhecido) |
| `receivedAt` | DateTime | Ingress no Office |
| `evaluatedAt` | DateTime? | |
| `convertedAt` | DateTime? | |
| `resolvedAt` | DateTime? | |
| `missionId` | string? | FK lógica se converteu em COORDINATE |
| `evaluationJson` | Json? | Motivo: ignore / convert / defer |
| `severity` | string? | Código estável (`duplicate`, `out_of_scope`, `policy_deny`, …) |
| `correlationId` | string? | Trace ponta a ponta |

**Índices S1 (implementados):**

```text
@@unique([sourceType, deliveryId])      // idempotência de entrega
@@index([workspaceId, signalHash, receivedAt])  // similaridade — NÃO unique
@@index([workspaceId, status, receivedAt])
@@index([correlationId])
@@index([missionId])
@@index([type, receivedAt])
```

### 4.2 `WorkspaceSourceBinding` (mapa de origem)

| Campo | Papel |
|-------|--------|
| `workspaceId` | Destino |
| `source` | `github` / `n8n` / … |
| `externalRef` | ex.: `owner/repo`, workflow id |
| `enabled` | kill-switch por binding |
| `configJson` | filtros (branches, labels) — sem secrets em claro se possível |

Sem binding → sinal **rejeitado** ou roteado para quarentena (nunca para outro workspace).

### 4.3 O que **não** entra no modelo M1 de memória

Signals não são `OperationalMemoryNote` por padrão.  
Após missão COMPLETED, a **memória M1** continua derivada de Mission/Learning — o sinal permanece ledger de ingress.

---

## 5. Deduplicação de sinais

### 5.1 Camadas de dedupe

| Camada | Chave | Efeito |
|--------|-------|--------|
| **Delivery** | `(source, deliveryId)` | Rejeita replay do mesmo webhook |
| **Semântica** | `(workspaceId, signalHash)` | Mesmo fato lógico não cria N sinais abertos |
| **Conversão** | Ao criar COORDINATE, usar `enqueue({ dedupe: true })` | Alinha ao dedupe já existente da Mission Queue |

### 5.2 `signalHash` (proposta)

Conteúdo canônico mínimo, estável:

```text
hash(
  workspaceId +
  type +
  externalId|normalizedKey +
  relevantPayloadFields
)
```

Exemplos:

- PR: `workspaceId + github.pr + repo + prNumber`  
- Issue: `workspaceId + github.issue + repo + issueNumber`  
- n8n lead: `workspaceId + n8n.lead + channel + externalContactId + dayBucket?`

**Política:** atualizações do mesmo PR (`synchronize`) podem:

- **atualizar** payload do sinal aberto (`detected`/`evaluated`), ou  
- criar sinal filho com `type=github.pr.updated` e link ao anterior —

mas **não** stormar COORDINATE a cada push sem avaliação.

### 5.3 Relação com dedupe do Supervisor

Supervisor já deduplica COORDINATE por `objectiveHash` + OPEN.  
Signals devem:

1. Evitar N sinais idênticos;
2. Ao converter, gerar objective **determinístico** o suficiente para o dedupe da fila ajudar (sem texto aleatório).

---

## 6. Lifecycle

```
detected → evaluated → converted → resolved
                ↘
                 ignored / expired  (terminais sem missão)
```

| Status | Significado | Transições |
|--------|-------------|------------|
| **detected** | Aceito pelo Bridge; persistido; autenticado | → evaluated; → ignored (policy deny imediato) |
| **evaluated** | Política/avaliador decidiu o que fazer | → converted; → ignored; → detected (requeue raro) |
| **converted** | COORDINATE enfileirado; `missionId` preenchido | → resolved (quando missão terminal ou política de amarra) |
| **resolved** | Ciclo do sinal fechado (sucesso, falha amarrada, ou supersedido) | terminal |
| **ignored** | Fora de escopo / duplicata semântica / policy | terminal |
| **expired** | TTL do sinal sem ação | terminal |

### Regras de transição

1. **detected → evaluated** é obrigatório antes de qualquer Mission (exceto rejeição auth, que nem persiste ou cai em ignored).  
2. **converted** exige `missionId` de COORDINATE com `ownerEmployeeId = Opera`.  
3. **resolved** tipicamente quando a Mission associada chega a COMPLETED/FAILED/CANCELLED **ou** quando um sinal mais novo supersede.  
4. Signal **ignored** não apaga auditoria.

```
Webhook
  → auth / replay check
  → resolve workspace (binding)
  → upsert DomainSignal (detected)
  → evaluate (policy + opcional heurística neutra)
  → converted? enqueue COORDINATE (dedupe)
  → workers / Opera / … / Memory M1
  → resolved (correlação deliveryId ↔ missionId)
```

---

## 7. Integração com Supervisor

### 7.1 Separação clara

| Produtor de COORDINATE | Tipo de gatilho | Texto típico |
|------------------------|-----------------|--------------|
| **Supervisor** | Sinal **interno** (backlog, stale, congestão) | `[COORDINATE/backlog] Atenção operacional…` |
| **Domain Signal Layer** | Sinal **externo** (GitHub, n8n, …) | `[COORDINATE/signal:github.pr.opened] …` |
| **Assisted HTTP** | Humano / UI | Objetivo do usuário |

O Supervisor **não** interpreta webhooks GitHub.  
A Signal Layer **não** faz health check de workers.

### 7.2 Como o Supervisor participa

Opções compatíveis (escolher na implementação; documentado aqui):

| Modo | Descrição |
|------|-----------|
| **A — Avaliador na Signal Layer** | Bridge avalia e enfileira COORDINATE; Supervisor só vê a missão como qualquer outra |
| **B — Supervisor como dispatcher neutro** | Signal fica `evaluated` com intent `needs_coordination`; Supervisor no ciclo seguinte enfileira COORDINATE a partir de sinais pendentes (sem interpretar negócio) |

**Recomendação de arquitetura:** Modo **A** para latência de eventos externos; Modo **B** como complemento para lotes / rate-limit. Em ambos:

- owner = Opera;
- kind = COORDINATE;
- sem EXECUTE;
- dedupe ativo.

### 7.3 O que o Supervisor **não** faz com Domain Signals

- Não escolhe Mag/Luna;
- Não escreve memória estratégica;
- Não chama n8n como “cérebro”;
- Não mistura OpsSignal de egress com DomainSignal de ingress sem tipo.

---

## 8. Como um Signal pode gerar uma Mission

### 8.1 Fluxo canônico (convert)

```
DomainSignal (evaluated, action=convert)
        │
        ▼
MissionQueue.enqueue({
  workspaceId,
  objective: buildSignalCoordinateObjective(signal),  // neutro + refs
  ownerEmployeeId: Opera,
  dedupe: true,
  // metadados futuros: signalId no event payload / resultJson auxiliar
})
        │
        ▼
DomainSignal.status = converted, missionId = …
        │
        ▼
Worker Opera claims COORDINATE
        │
        ▼
Briefing: objective + memoryNotes M1 + (opcional) trecho sanitizado do sinal
        │
        ▼
Opera decide: delegar | responder | ignorar trabalho
        │
        ▼
EXECUTE… CONSOLIDATE… Memory M1
        │
        ▼
DomainSignal → resolved (quando política amarrar ao terminal da missão)
```

### 8.2 Objetivo da COORDINATE (contrato de texto)

Deve ser **operacional e rastreável**, não um dump:

```text
[COORDINATE/signal:{type}] workspace={id} source={source} external={externalId}
Resumo neutro: {oneLine}
Refs: deliveryId={…} signalId={…}
```

A Opera interpreta; o Supervisor/Bridge **não** planejam.

### 8.3 Quando **não** converter

| Motivo | status / reason |
|--------|-----------------|
| Fora do mapa repo→workspace | ignored / `unbound_source` |
| Duplicata delivery | rejected at edge (ou ignored) |
| Policy deny (branch, label) | ignored / `policy_deny` |
| Rate limit / storm | evaluated + defer (permanece até janela) |
| Workspace pausado | ignored / `workspace_paused` |

### 8.4 Memória M1

Após a missão, outcomes/learnings entram no índice M1 como hoje.  
O sinal original permanece no ledger de ingress para correlação — não precisa virar chat eterno.

---

## 9. Segurança e isolamento por workspace

### 9.1 Isolamento

| Controle | Regra |
|----------|--------|
| **workspaceId obrigatório** | Nenhum sinal “global” em produto |
| **Binding** | Origem externa só escreve no workspace mapeado |
| **Leitura** | Avaliador / conversão só no workspace do sinal |
| **Briefing** | Employees veem só notas/objetivo da missão daquele workspace |
| **Multi-tenant** | `tenantId` reservado; Fase 6 |

Teste obrigatório (quando implementar): sinal do workspace A **nunca** gera missão ou memória no B.

### 9.2 Segurança de ingress

| Controle | Meta (alinhada F4-08) |
|----------|------------------------|
| Autenticação | HMAC (GitHub secret / Bridge secret) |
| Replay | `deliveryId` único + timestamp skew |
| Autorização | Binding enabled + allowlist de `type` |
| Redaction | Secrets/tokens fora de `payloadJson` |
| Tamanho | Cap de payload; raw opcional em cold storage |
| Rate limit | Por workspace / por source |
| Audit | Todo detected/evaluated/converted/resolved emitível |

### 9.3 Fronteira de Employees

```
GitHub / n8n / APIs
        │
        ▼
Integration Bridge (auth, normalize, dedupe)
        │
        ▼
Domain Signal Layer (lifecycle)
        │
        ▼
Mission Queue (COORDINATE, owner Opera)
        │
        ▼
Opera / Matcher / Specialists   ←── só Briefing + contratos de domínio
```

---

## 10. Fora de escopo (explícito)

| Item | Status |
|------|--------|
| UI de sinais | Não |
| Conectores GitHub/n8n em código | Não (aguardar aprovação + Sprint Fase 4) |
| Migration Prisma agora | Não |
| Path A como destino de webhook | Proibido |
| Memória M2/M3 | Não |
| Chat a partir de sinal | Não |

---

## 11. Fases sugeridas (após aprovação)

| Fase | Entrega |
|------|---------|
| S0 | Aprovar este documento + ADR-009 |
| S1 | **Feito** — models, store, service, lifecycle, security utils, testes (sem Bridge) |
| S2 | **Feito** — Ingestion Bridge interno (SourceBridge + Registry + InternalSourceBridge) — sem webhook público / conectores |
| S3.0 | **Feito (doc)** — [GitHub Signal Contract](./github-signal-contract.md) |
| S3.1 | **Feito** — `GitHubSourceBridge` + mapper (sem webhook HTTP / enqueue) |
| S3.2+ | Webhook HTTP autenticado + (opcional) convert → COORDINATE após aprovação |
| S4 | n8n Bridge + 1 fluxo domínio + OpsSignal mínimo |
| S5 | Correlação deliveryId → missionId + prova operacional |

Alinhado ao Plano Diretor (Sprints 2–4 da Fase 4).

---

## 12. Definition of Done (documento)

- [x] Conceito Domain Signal definido  
- [x] Signal ≠ Mission explicitado  
- [x] Fontes GitHub / n8n / externos  
- [x] Modelo de dados inicial  
- [x] Dedupe (delivery + semântico + fila)  
- [x] Lifecycle detected → evaluated → converted → resolved  
- [x] Integração com Supervisor delimitada  
- [x] Caminho Signal → Mission (COORDINATE / Opera)  
- [x] Segurança e isolamento por workspace  
- [x] Princípio “Signal informa / Opera decide / Mission executa”  
- [x] Sem UI / sem implementação neste passo  

---

## 13. Aprovação

| Item | Status |
|------|--------|
| Este documento | Aguardando aprovação |
| Código / migrations / conectores | **Não iniciar** até go explícito |

---

*Domain Signal Layer · OperaIA.lab · arquitetura apenas — sem implementação*
