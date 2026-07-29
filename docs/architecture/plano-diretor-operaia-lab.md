# Plano Diretor — OperaIA.lab

| Campo | Valor |
|-------|--------|
| **Status** | Oficial — referência permanente |
| **Versão** | 1.0 |
| **Escopo** | Evolução pós-Fase 3 (núcleo operacional validado) |
| **Audiência** | Engenharia, produto, operação |
| **Relacionados** | Engineering Handbook, ADR-001–007, desenhos GitHub/n8n |

Este documento é o **Plano Diretor** da OperaIA.lab. Ele orienta todas as fases seguintes. Em caso de conflito com ideias ad hoc, **prevalece este plano** e os ADRs vigentes — não o contrário.

Não substitui o Engineering Handbook (como o sistema funciona hoje). Complementa-o com **para onde vamos** e **como decidir o caminho**.

---

# 1. Visão

A OperaIA.lab é um **escritório digital autônomo**: uma sede operacional onde agentes especializados — coordenados pela Opera (CEO) — transformam objetivos e sinais do mundo real em trabalho auditável, delegado e concluído.

O problema que resolve não é “ter mais chatbots”. É a **fragmentação do trabalho digital**: código no GitHub, mensagens no WhatsApp, e-mails, agenda, finanças e APIs vivem em silos; humanos perdem tempo roteando contexto e cobrando status. A OperaIA.lab concentra esse fluxo em **missões**: analisa contexto, decide, delega a especialistas (Mag, Luna e demais), consolida e registra — com runtime contínuo, fila oficial e supervisão de infraestrutura.

No horizonte, o lab torna-se a base do **Opera Campus**: o mesmo modelo de escritório, isolado e seguro, para múltiplas organizações.

---

# 2. Objetivos estratégicos

Para os próximos anos, a plataforma deve:

1. **Tornar-se um escritório digital autônomo** — receber trabalho, coordenar, executar e concluir sem intervenção manual em cada passo rotineiro.
2. **Operar múltiplos projetos (workspaces)** — NEXO, MenuFlow, Plataforma e novos, com isolamento de contexto e capacidade.
3. **Coordenar especialistas de verdade** — Opera decide; Mag, Luna, Nexus, Atlas, Aurora, Themis, Mercúrio e Orion entram por especialização, com entregas úteis.
4. **Sentir o mundo externo** — GitHub, n8n e canais (WhatsApp, Gmail, agenda, banco, APIs) como fontes oficiais de sinal, não como hacks.
5. **Aprender continuamente** — outcomes alimentam memória e learning, sob governança humana para mudanças estruturais.
6. **Ser observável e resiliente** — toda missão rastreável; LLM com fallback; falhas externas não derrubam o escritório.
7. **Servir como base do Opera Campus** — multi-tenant seguro, produção na Oracle Cloud, onboarding repetível.
8. **Preservar a arquitetura** — evoluir sem violar ADRs nem acoplar Employees a integrações.

---

# 3. Princípios arquiteturais

Estes princípios **não devem ser quebrados**. Toda PR, feature ou integração deve ser rejeitada se os violar.

| # | Princípio |
|---|-----------|
| P1 | **Mission Queue é a única porta oficial de entrada de trabalho** (ADR-007). Path A (Assisted) é lab/compatibilidade, não o modo mental de produção. |
| P2 | **Supervisor nunca toma decisões de negócio** — apenas saúde, fila, recovery e sinais de infra (ADR-006 handbook). |
| P3 | **Employees nunca conhecem integrações externas** (GitHub, n8n, WhatsApp, Gmail). Só Briefing, Decisão e contratos de domínio. |
| P4 | **Opera sempre coordena** missões raiz (COORDINATE / CONSOLIDATE). Não executa o trabalho técnico do specialist (ADR-003). |
| P5 | **Especialistas nunca são chamados diretamente** pelo Ingress, pelo Supervisor ou pelo n8n. Ativação via Opera → Matcher → Specialization. |
| P6 | **n8n é integração, não inteligência** — conectores e fan-out; decisão permanece na OperaIA. |
| P7 | **Toda decisão deve ser auditável** — missão, resultJson, eventos, correlação `deliveryId → missionId`. |
| P8 | **Toda evolução deve preservar o desacoplamento** — domínio / runtime / infra; employees isolados por pacote (ADR-002, ADR-004). |
| P9 | **Human Oversight para mudanças estruturais** — learning sugere; humano aprova (ADR-005). |
| P10 | **Resiliência na borda de LLM** — falha de provider não deve, sozinha, matar o escritório (fallback oficial). |
| P11 | **Isolamento de contexto** — memória e missões não vazam entre workspaces (e, no Campus, entre tenants). |
| P12 | **Documentação segue a verdade** — Handbook descreve o que existe; este Plano distingue evolução de implementação concluída. |

---

# 4. Critérios de sucesso da Fase 4

**Tema:** sentidos, borda segura, memória scoped, multi-workspace disciplinado, lab operacional na Oracle.

Indicadores **mensuráveis** (todos necessários para declarar Fase 4 concluída):

| ID | Indicador | Meta |
|----|-----------|------|
| F4-01 | GitHub integrado | ≥1 repositório mapeado; push/PR/issue geram DomainSignal aceito |
| F4-02 | Missões externas via Queue | **100%** das missões originadas de GitHub/n8n entram por Mission Queue (COORDINATE, owner Opera) |
| F4-03 | n8n integrado | Bridge autenticado; ≥1 fluxo domínio + ≥1 OpsSignal (Supervisor → n8n) |
| F4-04 | Fallback observável | Evento `fallback_used` (ou equivalente) visível em runtime de produto em ≥1 validação controlada |
| F4-05 | Memória por workspace | Leitura/escrita scoped; teste automatizado prova **zero vazamento** entre workspaces |
| F4-06 | Isolamento multi-workspace | Caps de enqueue por workspace; missão A não lê tasks/memória de B |
| F4-07 | Oracle Cloud operacional | Deploy documentado; backup/restore **testado**; health externo OK |
| F4-08 | Segurança de ingress | HMAC (ou equivalente) + rejeição de replay/timestamp skew cobertos por teste |
| F4-09 | Correlação ponta a ponta | `deliveryId` (ou id GitHub) rastreável até `missionId` COMPLETED/FAILED |
| F4-10 | Qualidade de base | Typecheck limpo + testes da área verde no CI da entrega |

**Fora do escopo da Fase 4 (explícito):** multi-tenant Campus; ativação massiva de todos os employees; RAG pesado; redesign web.

---

# 5. Critérios de sucesso da Fase 5

**Tema:** escritório completo — CEO, Luna, specialists, aprendizado governado, SLOs.

| ID | Indicador | Meta |
|----|-----------|------|
| F5-01 | CEO multi-sinal | Opera produz plano coerente com ≥2 tipos de sinal (ex.: GitHub + memória/portfolio) em cenário de aceitação |
| F5-02 | Luna em operação | ≥1 missão real com EXECUTE Luna `COMPLETED` e deliverable UX definido em teste |
| F5-03 | Matriz Mag × Luna | Critérios documentados e cobertos por teste (quando design vs engenharia) |
| F5-04 | Specialists ativos | Além de Mag e Luna, ≥3 employees com missão de aceitação cada |
| F5-05 | Aprendizado contínuo | Learning gravado e **recuperado** no briefing; influência demonstrável em teste; sem auto-apply estrutural |
| F5-06 | Governança | Mudança estrutural exige proposta/aprovação humana (caminho exercitado) |
| F5-07 | SLO operacional | enqueue → estado terminal (COMPLETED/FAILED) com p95 definido e medido por ≥14 dias |
| F5-08 | Egress | ≥1 canal de retorno (ex.: comentário PR ou mensagem n8n) com `MissionResultSignal` |
| F5-09 | Observabilidade avançada | Painel ou endpoints com taxa COMPLETED/FAILED, profundidade de fila, workers alive, fallback rate |

---

# 6. Critérios de sucesso da Fase 6

**Tema:** Opera Campus — multi-tenant, produção endurecida, escala.

| ID | Indicador | Meta |
|----|-----------|------|
| F6-01 | Multi-tenant | ≥2 tenants isolados em ambiente de produção/staging equivalente |
| F6-02 | Isolamento comprovado | Suite de testes + review de segurança sem vazamento cross-tenant |
| F6-03 | Onboarding | Novo tenant sem deploy de código de domínio (config/runbook) |
| F6-04 | Segurança avançada | mTLS e/ou RBAC + auditoria de ingress/egress documentados |
| F6-05 | Oracle endurecida | Estratégia de HA/backup/custo documentada e exercitada |
| F6-06 | Quotas | Limites por tenant (missões/LLM) configuráveis, mesmo que enforcement inicial seja manual+alerta |
| F6-07 | Conectores | Modelo de workflows n8n por tenant (template + secrets isolados) |
| F6-08 | Incidentes | Runbook de incidente cross-tenant testado em tabletop |

---

# 7. Roadmap temporal (~90 dias)

Roadmap **operacional** alinhado à Fase 4 (sem alterar a sequência estratégica já definida: obs → segurança → GitHub → n8n → memória → multi-workspace → Oracle → preparação CEO/Luna).

| Sprint | Semanas | Entrega principal |
|--------|---------|-------------------|
| **Sprint 1** | 1–2 | Observabilidade mínima (`fallback_used`, correlação missão); inventário/higiene de FAILED na fila; runbook cota Gemini |
| **Sprint 2** | 3–4 | Contratos DomainSignal/OpsSignal; secrets; HMAC + replay; testes de contrato do Bridge |
| **Sprint 3** | 5–6 | GitHub MVP (PR, issue, push) → Mission Queue; dedupe; aceitação NEXO |
| **Sprint 4** | 7–8 | Integration Bridge + n8n (1 domínio + OpsSignal Supervisor + egress mínimo de resultado) |
| **Sprint 5** | 9–10 | Memória workspace-scoped + retenção; caps e isolamento multi-workspace |
| **Sprint 6** | 11–12 | Hardening Oracle (backup/restore, TLS, alertas, checklist deploy); spike CEO multi-sinal + critérios Luna |
| **Sprint 7** | ~13 (buffer) | Review DoD Fase 4; gaps; abertura formal da Fase 5 |

**Cadência sugerida:** 1 sprint = 2 semanas; demo operacional ao final de cada sprint (missão real ou sinal real, não só unit test).

---

# 8. Matriz de prioridades

| Item | Prioridade | Impacto | Esforço | Risco | Dependências |
|------|------------|---------|---------|-------|--------------|
| Observabilidade (fallback + correlação) | P0 | Alto | S | Baixo | ai-core, runtime |
| Segurança Bridge (HMAC, secrets, replay) | P0 | Alto | M | Médio | Contratos de evento |
| GitHub → Mission Queue (MVP) | P0 | Muito alto | M | Médio | Queue, mapa workspace, segurança |
| Bridge + n8n (domínio + ops) | P0 | Muito alto | M–L | Médio–alto | Segurança, Queue, n8n VM |
| Memória workspace-scoped | P1 | Alto | M | Médio | Memory package, testes isolamento |
| Multi-workspace (caps + isolamento) | P1 | Alto | M | Médio | Memória, mapa sources |
| Oracle hardening (lab prod) | P1 | Alto | M–L | Médio | Obs, backup docs |
| Evolução CEO multi-sinal | P1 | Alto | M | Médio | Sinais + memória (Fase 4) |
| Luna em operação | P1–P2 | Médio–alto | S–M | Médio | CEO, sinais produto |
| Demais employees (um a um) | P2 | Médio | S/cada | Médio | CEO, sinais, capacidade |
| Aprendizado contínuo | P2 | Alto | M | Médio–alto | Memória, governança |
| Multi-tenant Campus | P3→Fase 6 | Muito alto | XL | Alto | Fases 4–5 maduras |
| Redesign web / chat genérico | Adiado | Baixo agora | L | Baixo | — |

Legenda esforço: **S** ≤1 sem · **M** 2–4 sem · **L** 1–2 meses · **XL** 2+ meses.

---

# 9. Riscos estratégicos

## Técnicos

| Risco | Mitigação |
|-------|-----------|
| Burst de webhooks satura Opera/fila | Caps, agregação, backpressure no Bridge |
| Vazamento de memória/contexto entre workspaces ou tenants | Testes de isolamento obrigatórios; `tenantId` só na Fase 6 |
| Fallback LLM vira “modo permanente” | Billing Gemini + métrica de taxa de fallback com alerta |
| n8n acoplado à inteligência | Revisar P5–P6 em code review; Bridge como aduana |
| Path A vs Path B confundem produção | Documentar: produção = Queue; Assisted = lab |
| Dívida de ADRs/numeração | Consolidar docs sem bloquear engenharia |
| Pacotes legados (`agent-runtime` / `orchestration-engine`) | Auditar uso; deprecar se zumbis |

## Organizacionais

| Risco | Mitigação |
|-------|-----------|
| Pressão por features “vistosas” (UI, Campus cedo) | Gate de aceitação (§10); este Plano Diretor |
| Ativar todos os employees sem sinais | Critério de aceitação por employee |
| Skip de segurança “só na LAN” | HMAC mesmo em localhost de VM compartilhada |
| Escopo infinito na Fase 4 | DoD mensurável (§4); buffer Sprint 7 |
| Perda de Human Oversight | ADR-005; learning sem auto-apply |

---

# 10. Critérios para aceitar novas funcionalidades

Toda proposta (issue, PRD, spike) deve responder **sim** de forma convincente às perguntas abaixo. Um “não” em P1–P6 ou nos princípios (§3) é motivo de rejeição ou adiamento.

1. **Resolve um problema real** do escritório ou da operação (não só curiosidade técnica)?
2. **Preserva a arquitetura** e os princípios P1–P12 / ADRs?
3. **Aumenta a autonomia** do Digital Office (menos roteamento humano)?
4. **Pode ser testada** (unit, contract ou validação operacional)?
5. **É observável** (log/métrica/evento com correlação)?
6. **É reutilizável** (não é one-off acoplado a um canal/employee)?
7. **Qual fase** (4 / 5 / 6) e **qual indicador DoD** ela move?
8. **Qual o custo de não fazer agora** vs risco de fazer cedo demais?
9. **Quem é o owner** da missão de aceitação e qual o cenário feliz?
10. **Introduz PII/segredo?** Se sim, qual a política de retenção e redaction?

---

# 11. Definição oficial de “pronto”

Uma **fase** só é **concluída** quando todos os itens abaixo forem verdadeiros.

### Documentação

- Handbook e/ou ADRs atualizados para o que **passou a existir**.
- Este Plano Diretor: indicadores da fase marcados como atingidos (changelog curto no fim do ciclo).
- Runbook operacional das novas bordas (GitHub/n8n/Oracle) publicado.

### Testes

- Testes automatizados das entregas críticas verdes no CI.
- Pelo menos uma **validação operacional** (missão ou sinal real) registrada.

### Typecheck

- `pnpm typecheck` limpo nos pacotes afetados (idealmente monorepo).

### Observabilidade

- Eventos/métricas das novas capacidades visíveis em runtime de produto.
- Correlação documentada para o fluxo feliz.

### Validação operacional

- Cenário ponta a ponta executado no ambiente alvo (lab/Oracle).
- Critérios mensuráveis da fase (§4 / §5 / §6) checados item a item.

### Arquitetura

- Code review confirma princípios §3.
- Nenhuma regressão: Supervisor sem negócio; Ingress sem escolher employee por nome; Queue como porta oficial.

### Gate de fase

| Fase | Gate adicional |
|------|----------------|
| 4 | F4-01…F4-10 |
| 5 | F5-01…F5-09 |
| 6 | F6-01…F6-08 |

---

# 12. Conclusão — Plano Diretor

A OperaIA.lab encerra a **Fase 3** com um núcleo operacional **comprovado**: Continuous Runtime, Supervisor, Mission Queue, Opera coordenando, Mag executando, consolidação e persistência, Postgres, typecheck limpo, testes verdes, Gemini e fallback LLM.

O próximo salto não é “mais employees na vitrine”. É **abrir os sentidos com disciplina**: GitHub e n8n como bordas, Mission Queue como única porta, Supervisor fiel à infra, memória e workspaces isolados, Oracle confiável — e só então completar o escritório (CEO, Luna, time, aprendizado) até o **Opera Campus**.

Este Plano Diretor é a **referência oficial** para priorização, aceitação de features e encerramento de fases. Desvios exigem atualização explícita deste documento ou de um ADR — nunca “exceção silenciosa” no código.

**Estratégia permanente:**  
*Proteger o núcleo → observar → integrar o mundo com aduana → isolar contexto → completar o Office → escalar Campus.*

---

## Apêndice A — Estado validado ao encerrar a Fase 3

- Typecheck limpo; testes API verdes  
- Continuous Runtime, Supervisor, Workers, heartbeats  
- Mission Queue operacional (COORDINATE → EXECUTE → CONSOLIDATE)  
- Opera + Mag comprovados; consolidação e persistência  
- PostgreSQL operacional  
- Fallback LLM implementado; Gemini integrado (quota externa ≠ falha arquitetural)

## Apêndice B — Sequência estratégica (inalterada)

```text
Observabilidade + Segurança
        ↓
GitHub MVP  ←→  Bridge n8n
        ↓
Memória workspace + Multi-workspace
        ↓
Oracle hardening (lab)
        ↓
CEO → Luna → demais employees
        ↓
Aprendizado contínuo
        ↓
Multi-tenant Campus + Oracle endurecida
```

## Apêndice C — Documentos relacionados

- `docs/engineering-handbook/` — verdade do sistema atual  
- `docs/architecture/adr/` — decisões formais (incl. ADR-007)  
- Desenhos de sessão: GitHub → Digital Office; OperaIA ↔ n8n (planejamento)

---

*Fim do Plano Diretor v1.0 — OperaIA.lab*
