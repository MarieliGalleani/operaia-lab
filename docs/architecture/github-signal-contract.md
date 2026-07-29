# GitHub Signal Contract — S3.0

| Campo | Valor |
|-------|--------|
| **Status** | Contrato S3.0 + **Bridge S3.1 implementado** (sem webhook HTTP / enqueue) |
| **Versão** | 1.1 |
| **Fase** | S3.0 contrato · S3.1 `GitHubSourceBridge` |
| **ADR** | [ADR-009](./adr/ADR-009-domain-signal-layer.md) |
| **Relacionados** | [Domain Signal Layer](./domain-signal-layer.md), Plano Diretor F4-01 / F4-08 / F4-09 |
| **Código** | `GitHubSourceBridge` + mapper em `@operaia/domain-signals` — **sem** rota HTTP pública, UI, MissionQueue |

---

## Princípio

```
Signal informa.
Opera decide.
Mission executa.
```

O contrato GitHub define **o que** o futuro `GitHubSourceBridge` normaliza para `NormalizedIngressEvent` / `DomainSignal`.  
Não define HTTP, secrets, nem enqueue.

| Campo S1/S2 | Valor GitHub |
|-------------|--------------|
| `sourceType` | `github` |
| `externalRef` | `owner/repo` (lowercase canônico) |
| Binding | `WorkspaceSourceBinding(workspaceId, sourceType=github, externalRef)` |

---

## 1. Eventos GitHub suportados inicialmente (MVP)

Escopo deliberadamente **estreito** (Plano Diretor Sprint 3: PR, issue, push).

| # | GitHub `X-GitHub-Event` | Actions aceitas | Incluído no MVP? |
|---|-------------------------|-----------------|------------------|
| 1 | `pull_request` | `opened`, `reopened`, `ready_for_review`, `synchronize`, `closed` | **Sim** |
| 2 | `issues` | `opened`, `reopened`, `labeled`, `closed` | **Sim** |
| 3 | `push` | *(evento único; filtrar por branch)* | **Sim** (com filtro) |
| 4 | `pull_request_review` | — | **Não** (S3.x+) |
| 5 | `check_suite` / `check_run` | — | **Não** |
| 6 | `workflow_run` | — | **Não** |
| 7 | `create` / `delete` / `fork` / `star` | — | **Não** |
| 8 | `issue_comment` / `pull_request_review_comment` | — | **Não** (ruído) |
| 9 | `ping` | — | Aceitar só para health do Bridge futuro; **não** vira DomainSignal de produto |

**Regra:** qualquer evento/action fora da tabela MVP → **não persiste** como sinal de produto (reject na borda ou `ignored` / `unmapped_event` na avaliação). Preferência de desenho: rejeitar cedo na normalização do Bridge (S3.1), sem poluir o ledger.

---

## 2. Mapeamento: GitHub Event → `DomainSignal.type`

Convenção: `github.<entity>.<verb>` em snake/dot lowercase.

| GitHub Event | Action / condição | `DomainSignal.type` | `sourceId` (externo) |
|--------------|-------------------|---------------------|----------------------|
| `pull_request` | `opened`, `reopened`, `ready_for_review` | `github.pr.opened` | `pr:{number}` |
| `pull_request` | `synchronize` | `github.pr.updated` | `pr:{number}` |
| `pull_request` | `closed` + `merged=true` | `github.pr.merged` | `pr:{number}` |
| `pull_request` | `closed` + `merged=false` | `github.pr.closed` | `pr:{number}` |
| `issues` | `opened`, `reopened` | `github.issue.opened` | `issue:{number}` |
| `issues` | `labeled` | `github.issue.labeled` | `issue:{number}` |
| `issues` | `closed` | `github.issue.closed` | `issue:{number}` |
| `push` | branch ∈ allowlist do binding | `github.push` | `push:{ref}:{after_sha_short}` |

### Notas de mapeamento

- `ready_for_review` trata-se como **abertura operacional** (`github.pr.opened`) — draft→ready é sinal de “agora pode avaliar”.
- `synchronize` **não** reusa o type `opened`; usa `updated` para a Opera distinguir storm de push vs nova PR.
- `push` em tag (`refs/tags/…`) → **fora do MVP** (ignore / unmapped).
- Múltiplos commits num push → **um** DomainSignal por delivery (não um sinal por commit).

---

## 3. Payload mínimo necessário

Após redaction, `payloadJson` (e o `payload` do `NormalizedIngressEvent`) deve conter **somente** o necessário para a Opera e para hash/correlação. Versão de schema: `payloadVersion = 1`.

### 3.1 Comum a todos os tipos MVP

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `repo.fullName` | string | sim | `owner/repo` (= `externalRef`) |
| `repo.id` | number \| string | sim | id GitHub do repositório |
| `sender.login` | string | sim | ator (sem email/token) |
| `github.event` | string | sim | nome do evento bruto |
| `github.action` | string \| null | condicional | action; `null` em `push` |
| `github.deliveryId` | string | sim | eco do header (auditoria) |

### 3.2 `github.pr.*`

| Campo | Obrigatório |
|-------|-------------|
| `pr.number` | sim |
| `pr.title` | sim |
| `pr.state` | sim (`open` / `closed`) |
| `pr.draft` | sim |
| `pr.merged` | sim (bool; relevante em closed) |
| `pr.baseRef` | sim |
| `pr.headRef` | sim |
| `pr.htmlUrl` | sim |
| `pr.authorLogin` | sim |
| `pr.labels` | não (lista de nomes) |

**Não incluir:** body completo da PR, diff, patch, files[], comments[].

### 3.3 `github.issue.*`

| Campo | Obrigatório |
|-------|-------------|
| `issue.number` | sim |
| `issue.title` | sim |
| `issue.state` | sim |
| `issue.htmlUrl` | sim |
| `issue.authorLogin` | sim |
| `issue.labels` | sim em `labeled` (senão opcional) |
| `label.added` | sim só em `github.issue.labeled` |

**Não incluir:** body longo, reactions, timeline.

### 3.4 `github.push`

| Campo | Obrigatório |
|-------|-------------|
| `ref` | sim (`refs/heads/…`) |
| `branch` | sim (derivado de `ref`) |
| `before` | sim |
| `after` | sim |
| `forced` | sim |
| `commitCount` | sim |
| `headMessage` | não (1 linha, truncada ≤ 200 chars) |
| `pusherLogin` | sim |

**Não incluir:** lista completa de commits, trees, blobs, contents.

---

## 4. Redaction obrigatória

Além das deny-keys genéricas S1 (`token`, `secret`, `authorization`, `password`, …), o contrato GitHub **exige** remover ou nunca mapear:

| Origem GitHub | Tratamento |
|---------------|------------|
| `*.token`, `*.access_token`, installation tokens | strip / `[REDACTED]` |
| `sender.email`, `pusher.email`, `email` | strip |
| `body` / `body_html` de issue/PR (texto longo) | **omitir** no MVP (não só redact) |
| `diff` / `patch` / `files` contents | omitir |
| Headers `Authorization`, `Cookie` | nunca no payload |
| Webhook secret | nunca no payload |
| URLs com query `token=` / `access_token=` | redact query |
| `client_payload` genérico não allowlisted | omitir |

**Regra:** o Bridge futuro aplica `redactPayload` **depois** do mapeamento mínimo — campos omitidos não entram; deny-keys pegam vazamentos residuais.

---

## 5. Regras de dedupe e correlação

Alinha S1: `deliveryId` = idempotência; `signalHash` = similaridade (**não** unique); `correlationId` = rastreio.

### 5.1 `deliveryId`

| Regra | Valor |
|-------|--------|
| Fonte | Header `X-GitHub-Delivery` (UUID GitHub) |
| Unique | `(sourceType=github, deliveryId)` — replay da **mesma** entrega não cria segunda linha |
| Ausência | Bridge futuro **rejeita** (não inventar id frágil a partir do body) |

### 5.2 `signalHash` (similaridade)

Canônico MVP (`computeSignalHash` / equivalente):

```text
workspaceId
+ type                    // DomainSignal.type mapeado
+ externalRef             // owner/repo
+ sourceId                // pr:{n} | issue:{n} | push:{ref}:{after_short}
+ relevantPayload         // ver abaixo
```

| Type | `relevantPayload` mínimo no hash |
|------|----------------------------------|
| `github.pr.opened` / `updated` / `merged` / `closed` | `{ number }` |
| `github.issue.*` | `{ number }` (+ `label` em labeled) |
| `github.push` | `{ branch, after }` |

**Efeitos:**

- Mesmo PR com **deliveries distintas** (`opened` depois `synchronize`) → hashes **diferentes** se `type` muda (`opened` vs `updated`), ou iguais só se type+sourceId+relevant coincidirem.
- Hash igual **não bloqueia** ingest (S1) — similares entram em `evaluationJson.similarSignalIds` para a Opera.
- Storm de `synchronize` com mesmo `pr.number` e type `updated` → hashes iguais entre deliveries diferentes → audit de similaridade; política de avaliação pode `DEFER` / `IGNORE` (não a unique do banco).

### 5.3 `correlationId`

| Fase | Regra |
|------|--------|
| Primeiro sinal de um artefato (ex.: PR opened) | Gerar UUID; persistir |
| Sinais seguintes do **mesmo** `sourceId` no mesmo workspace (updated/closed) | **Preferir** reutilizar o `correlationId` do sinal aberto mais recente com mesmo `sourceId` (lookup por similaridade / query); se não houver, gerar novo |
| Objetivo | Trace único Signal → Evaluation → (futuro) Mission → Learning (F4-09) |

S3.0 **especifica** a intenção; S3.1+ implementa o lookup. Até lá, gerar novo correlationId por delivery permanece válido (degradação aceitável).

---

## 6. Candidatos à avaliação da Opera (`CONVERT_CANDIDATE`)

Após ingest (`DETECTED`), a política de avaliação (ainda **não** enqueue) deve marcar como candidatos quando o binding está enabled e o type está allowlisted:

| Type | Candidato? | Motivo |
|------|------------|--------|
| `github.pr.opened` | **Sim** | Nova unidade de trabalho / revisão |
| `github.pr.updated` | **Sim, com freio** | Default: `DEFER` se similar recente (&lt; N min) com mesmo `sourceId`; senão `CONVERT_CANDIDATE` |
| `github.pr.merged` | **Sim** | Fechamento operacional / aprendizado |
| `github.pr.closed` (não merged) | **Opcional** | Default MVP: `IGNORE` com reason `pr_closed_unmerged` (baixo valor); override via `configJson` do binding |
| `github.issue.opened` | **Sim** | Backlog |
| `github.issue.labeled` | **Sim** só se label ∈ allowlist do binding | Senão `IGNORE` / `label_not_allowlisted` |
| `github.issue.closed` | **Opcional** | Default MVP: `IGNORE` (`issue_closed`) |
| `github.push` | **Sim** só se `branch` ∈ `configJson.pushBranches` (default: `main` / `master`) | Senão ignore |

**Invariante S3.0:** candidato ≠ missão. `CONVERT_CANDIDATE` **não** chama MissionQueue. Convert/enqueue é fase posterior (S3.2+ / ADR-009 §8).

---

## 7. Sinais / eventos a ignorar

### 7.1 Na borda (não viram DomainSignal de produto)

| Caso | Reason sugerido |
|------|-----------------|
| Evento/action fora do MVP | `unmapped_event` |
| `ping` | `health_ping` |
| Repo sem `WorkspaceSourceBinding` | `binding_missing` |
| Binding `enabled=false` | `binding_disabled` |
| Push em tag / branch não allowlisted | `policy_deny` / `branch_not_allowlisted` |
| PR draft `opened` (ainda draft) | `draft_pr` — **ignore até** `ready_for_review` ou opened com `draft=false` |
| Bot-only noise (opcional) | `sender` ∈ denylist (`dependabot[bot]` etc. via `configJson`) |

### 7.2 Após DETECTED (avaliação → `IGNORE`)

| Caso | `evaluationReason` |
|------|---------------------|
| Label fora da allowlist | `label_not_allowlisted` |
| PR closed sem merge (default) | `pr_closed_unmerged` |
| Issue closed (default) | `issue_closed` |
| Similaridade storm (`updated` repetido) | `deferred_or_ignored_storm` |
| Workspace pausado (quando houver flag) | `workspace_paused` |

---

## 8. Binding `configJson` (contrato lógico)

Preparação para S3.1 — sem schema Prisma novo nesta fase:

```json
{
  "pushBranches": ["main", "master"],
  "issueLabelAllowlist": ["opera", "priority"],
  "ignoreDraftPr": true,
  "ignoreUnmergedClose": true,
  "ignoreIssueClosed": true,
  "botDenyLogins": ["dependabot[bot]", "renovate[bot]"],
  "prUpdatedDeferWindowSec": 300
}
```

Secrets **nunca** em `configJson` — só `secretRef` no binding (já S1).

---

## 9. Fora de escopo (S3.0)

| Item | Status |
|------|--------|
| Webhook HTTP / rotas | Não |
| Validação HMAC GitHub em código | Não (hooks S2 já existem; wiring é S3.1) |
| `GitHubSourceBridge` | Não |
| UI | Não |
| `MissionQueue.enqueue` | Não |
| Reviews, checks, Actions, comments | Não |

---

## 10. Definition of Done (documento)

- [x] Eventos MVP listados  
- [x] Mapeamento Event → `DomainSignal.type`  
- [x] Payload mínimo por família  
- [x] Redaction obrigatória GitHub  
- [x] Dedupe: `deliveryId` / `signalHash` / `correlationId`  
- [x] Candidatos Opera vs ignorados  
- [x] Sem código de integração  

**Próxima fase (S3.1):** implementar `GitHubSourceBridge` + registro no `BridgeRegistry`, reutilizando S1/S2, **sem** enqueue automático.

---

*S3.0 — GitHub Signal Contract · OperaIA.lab*
