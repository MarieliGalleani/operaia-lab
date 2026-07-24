# Digital Team Online — Fase 2
## Preparação para Operação Real · Plano Técnico Oficial

**Tipo:** arquitetura e planejamento · **sem implementação**  
**Status:** aguardando aprovação  
**Pré-requisito:** [`docs/digital-team-online-fase-1.md`](digital-team-online-fase-1.md) — Fase 1.1–1.5 **concluída** (ACEITE Gemini)  
**Referências:**
- [`docs/employee-activation.md`](employee-activation.md)
- [`docs/employee-framework.md`](employee-framework.md)
- [`docs/agent-runtime.md`](agent-runtime.md)
- [`docs/workspace-runtime.md`](workspace-runtime.md)
- [`docs/opera-campus-baseline-v1.md`](opera-campus-baseline-v1.md) (LOCKED — fora de escopo)

**Em caso de conflito com Campus / engine / ECS / Runtime core:** Baseline e contratos existentes prevalecem. Esta fase **não** os altera.

---

## 1. Visão geral

A Fase 1 colocou a Equipe Digital **online no nível intelectual**:

```
Usuário → CEO → Delegação (Specialization) → Especialista → Consolidação → OperationalRun
```

A Fase 2 planeja a evolução controlada de:

| De (Fase 1) | Para (Fase 2+) |
|-------------|----------------|
| Agentes que **analisam e respondem** | Agentes que **executam trabalho operacional com controle** |

**Princípio:** não criar um novo sistema. Evoluir a arquitetura já aprovada.

**Direção oficial de composição:**

```
Employee Runtime
  ↓
Agent Runtime
  ↓
Workspace Runtime
  ↓
Memory
  ↓
Tools / Actions
  ↓
Execution Engine
```

`MissionOrchestrator` permanece o **único orquestrador de missão** da Equipe Digital. Agent Runtime / Memory / Tools entram **como capacidades dentro** do ciclo Employee — nunca como segundo CEO.

### Escopo desta missão de documentação

Definir **como** (arquitetura e ordem), **não** implementar.

### Fora de escopo (explícito)

- Criar novos Employees
- Integrar GitHub ou ferramentas externas
- Automações reais em produção
- Alterar Campus, mapas, ECS, Runtime core
- Criar novas telas / redesign da UI
- Expandir o roster contratado

---

## 2. Estado atual

### 2.1 Operação (Fase 1 — comprovado)

| Capacidade | Estado |
|------------|--------|
| CEO operacional (`operaia-ceo`) | ✓ |
| Delegação por especialização | ✓ |
| Registry + Matcher | ✓ |
| Especialista intelectual (`cto-mag`) | ✓ |
| Consolidação executiva | ✓ |
| Gemini + Deterministic | ✓ |
| Sala da CEO ≡ Operations (mesma execução) | ✓ |
| `OperationalRun` registrado | ✓ |

### 2.2 Roster real vs fila de contratação (UI)

Conforme a tela **Equipe** do Lab (estado observado):

**Contratados (Registry / operação real):**

| Papel | ID | Specialization |
|-------|-----|----------------|
| CEO — Opera | `operaia-ceo` | `MANAGEMENT` |
| CTO — Mag | `cto-mag` | `SOFTWARE_ENGINEERING` |

**Fila de contratação (somente apresentação — `plannedHires`):**

Luna (UX), Atlas (PM), Nexus (Automação), Aurora (Marketing), Orion (Financeiro), Themis (Jurídico), Mercúrio (Comercial).

| Fato | Implicação |
|------|------------|
| Cards “Chegando em breve” | **Não** estão no `EmployeeRegistry` |
| Status `HIRING` | UI/produto; **não** ativam Matcher |
| Arquitetura N-ready | Suporta futuros especialistas **sem** criá-los nesta fase |

A Fase 2 **não** promove a fila a Employees. Continuar apenas com Opera + Mag.

### 2.3 Pilhas paralelas ainda existentes

| Pilha | Uso hoje na missão digital |
|-------|----------------------------|
| Employee Activation (`MissionOrchestrator`) | **Núcleo** do fluxo CEO→Mag |
| Agent Runtime + Memory | Pipeline genérico; **não** no path Employee |
| Workspace Runtime / Sessions | Sessões paralelas; **não** unificadas ao `OperationalRun` |
| Execution Engine | Disponível; Employee path ainda **não** aplica side-effects |

---

## 3. Lacunas da Fase 1

| # | Lacuna | Impacto |
|---|--------|---------|
| L1 | Memory **não** alimenta `EmployeeBriefing` / CEO antes de delegar | Decisões sem histórico de missões anteriores |
| L2 | Especialista não recebe **contexto histórico** além do snapshot + motivo da delegação | Mag “recomeça” a cada missão |
| L3 | `OperationalRun` é auditável, mas a missão **não vira trabalho persistente** no domínio (tasks/projeto) | Resposta intelectual sem rastro operacional no board |
| L4 | Sem Tools / Actions no ciclo Employee | Não cria tarefa, não atualiza projeto, não lê artefatos |
| L5 | Agent Runtime desconectado do Employee path | Risco de segunda orquestração se mal integrado |
| L6 | Workspace Runtime (sessions) paralelo ao Operations | Duas noções de “unidade de trabalho” |
| L7 | Roster pequeno | Só `SOFTWARE_ENGINEERING` além de gestão — esperado e aceito |

A Fase 2 endereça L1–L6 **por planejamento e implementação gradual controlada**; L7 permanece até decisão explícita de contratação (fora desta fase).

---

## 4. Arquitetura alvo

### 4.1 Papel de cada camada (convergência)

```
┌─────────────────────────────────────────────────────────────┐
│ Interfaces (Sala da CEO / Operations) — inalteradas na UX   │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ MissionOrchestrator (único)                                  │
│ Opera decide → Delegation → Opera consolida                  │
└───────┬───────────────────────────────┬─────────────────────┘
        ▼                               ▼
┌───────────────────┐         ┌───────────────────────────────┐
│ Employee Runtime  │         │ DelegationService + Matcher   │
│ Runner + Briefing │         │ Specialization → Registry     │
└─────────┬─────────┘         └───────────────┬───────────────┘
          │                                   │
          ▼                                   ▼
┌───────────────────────────────────────────────────────────────┐
│ Enrichment (Fase 2)                                            │
│ · MemoryStore.search → contexto no briefing                    │
│ · (opcional) Agent Runtime por especialista p/ plan+actions    │
└─────────┬───────────────────────────────┬─────────────────────┘
          ▼                               ▼
┌───────────────────┐         ┌───────────────────────────────┐
│ Workspace Source  │         │ Tools / Actions (controladas) │
│ Snapshot + (futuro│         │ propostas → Execution Engine  │
│ persistência)     │         │ com policy / aprovação        │
└───────────────────┘         └───────────────────────────────┘
```

### 4.2 Regras travadas

1. **Não** duplicar `MissionOrchestrator`.
2. CEO **nunca** escolhe Employee por nome — só `Specialization`.
3. Tools **propõem** ações; execução passa por policy / Execution Engine (controle).
4. Novos especialistas = entradas no Registry (futuro) — **zero** nesta fase.
5. Campus / ECS / mapas / Runtime core **intocados**.

---

## 5. Fluxo futuro

### 5.1 Missão com memória e trabalho persistente (alvo)

```
Usuário
  → CEO recebe missão + workspaceId
  → Memory: recupera missões / decisões / fatos relevantes do workspace
  → CEO analisa (snapshot + memória)
  → CEO identifica Specialization(s)
  → Matcher resolve especialista(s)
  → Especialista recebe briefing + fatia de memória + objetivo focado
  → Especialista (intelectual e/ou Agent Runtime):
        · analisa
        · (futuro) propõe Actions (criar tarefa, atualizar projeto, …)
  → Execution Engine aplica Actions permitidas (com controle)
  → Outcomes voltam ao CEO
  → CEO consolida
  → OperationalRun + (opcional) vínculo a Session / tasks persistidas
  → Usuário recebe resposta única
```

### 5.2 Exemplos de Actions futuras (não implementar agora)

| Action (conceitual) | Domínio | Controle |
|---------------------|---------|----------|
| Criar tarefa | Tasks / Workspace | Policy + tenant/workspace |
| Atualizar projeto | Projects | Campos permitidos apenas |
| Analisar documento | Knowledge / Memory | Read-only primeiro |
| Consultar dados | Snapshot / DB read | Sem writes arbitrários |
| Gerar relatório | Report / OperationalRun | Persistência auditável |

---

## 6. Integração Employee Runtime + Agent Runtime

### 6.1 Modelo recomendado

| Papel | Responsável |
|-------|-------------|
| Ciclo de missão (quem fala com quem) | **Employee Runtime** + `MissionOrchestrator` |
| Pipeline genérico (memory → tools → LLM → actions) | **Agent Runtime** |
| Quando usar Agent Runtime | **Dentro** da execução do especialista (e, se útil, enriquecimento do CEO) — como motor de um turno, não como orquestrador de equipe |

### 6.2 Opções de encaixe (decisão na implementação, após aprovação)

| Opção | Descrição | Prós | Contras |
|-------|-----------|------|---------|
| **A — Adapter no Runner** | `EmployeeRunner` opcionalmente chama Agent Runtime para montar contexto/actions | Um ponto de integração | Cuidado para não vazar tools ao CEO cedo demais |
| **B — Brain do especialista** | Mag (e futuros) usam Agent Runtime via porta injetada | Isola complexidade no especialista | Cada brain precisa do mesmo contrato |
| **C — Só pós-Fase 2a memória** | Primeiro Memory no briefing; Agent Runtime na subfase seguinte | Menor risco | Atraso em Actions |

**Recomendação de plano:** começar por **memória no briefing (C parcial)** e, em seguida, **A ou B** para Actions — sempre com `MissionOrchestrator` intacto.

### 6.3 O que Agent Runtime **não** faz nesta fase

- Não substitui DelegationService / Matcher.
- Não cria Employees.
- Não executa GitHub / tools externas.

---

## 7. Memory strategy

### 7.1 Objetivo

Permitir que:

1. O **CEO consulte contexto antes de delegar**.
2. O **especialista receba contexto histórico** relevante à delegação.

### 7.2 Fontes candidatas (reutilizar contratos `@operaia/memory`)

| Fonte | Conteúdo | Prioridade |
|-------|----------|------------|
| `OperationalRun` concluídos do workspace | Objetivos, especializações, resumos, gaps | Alta |
| Decisões / reports dos brains | Fatos já consolidados pela Opera | Alta |
| Snapshot atual | Tasks, progresso, equipe | Já existe |
| Documentos / knowledge | Fase posterior | Baixa nesta fase |

### 7.3 Pontos de injeção

| Momento | Quem | O que entra no briefing |
|---------|------|-------------------------|
| Antes do 1º `runner.run(Opera)` | Application / Runner enrichment | Top-K memórias do `workspaceId` + objetivo |
| Antes do especialista | DelegationService / Briefing focado | Memórias filtradas pela specialization / task |
| Após consolidação | Writer | Persistir resumo da missão na MemoryStore |

### 7.4 Princípios

- Employees continuam vendo só **briefing** (nunca infra).
- Memory é **recuperação**, não segundo orquestrador.
- Deterministic nos testes: MemoryStore in-memory / fixtures.

---

## 8. Workspace strategy

### 8.1 Como uma missão vira trabalho persistente

Hoje: missão = `OperationalRun` (auditoria) + resposta na UI.  
Alvo: missão **pode** gerar artefatos de domínio no workspace, com controle.

| Etapa | Artefato | Persistência |
|-------|----------|--------------|
| 1 (já existe) | `OperationalRun` | Store operacional |
| 2a | Vínculo `missionId` ↔ `workspaceId` explícito na UI/ops | Já implícito no run |
| 2b | Actions aprovadas → Task / Project updates | Prisma / repositórios existentes |
| 2c (opcional) | `WorkspaceSession` alinhada ao `OperationalRun` | Workspace Runtime — **sem** duplicar orquestração |

### 8.2 Regra de unificação

- **Uma missão de equipe** = um `OperationalRun` (fonte de auditoria da Digital Team).
- Workspace Runtime sessions: ou **espelham** o run, ou ficam para fluxos Agent-only — **não** criar terceiro tipo de missão.
- `WorkspaceSource` / snapshot continua alimentando o Employee path.

### 8.3 UI

Sem novas telas nesta fase. A tela Equipe / Workspace / Sala da CEO **consomem** os mesmos dados quando a persistência existir; não redesenhar Campus nem Equipe.

---

## 9. Execution strategy

### 9.1 Níveis de execução (graduais)

| Nível | Capacidade | Fase |
|-------|------------|------|
| 0 | Intelectual (análise / plano / consolidação) | **Feito (Fase 1)** |
| 1 | Memória no briefing | Fase 2 (primeira implementação) |
| 2 | Actions **propostas** no outcome (ainda sem apply) | Fase 2 |
| 3 | Actions **aplicadas** via Execution Engine + policy (criar tarefa, atualizar projeto, …) | Fase 2+ controlada |
| 4 | Tools externas (GitHub, etc.) | **Explicitamente fora** até nova aprovação |

### 9.2 Controle obrigatório em Actions reais

- Allowlist de action types.
- Escopo por `workspaceId`.
- Auditoria no `OperationalRun` (o que foi proposto vs aplicado).
- Modo deterministic: actions simuladas / no-op em CI.
- Rollback: não aplicar Actions se policy negar.

### 9.3 Exemplos mapeados ao domínio existente

| Intenção | Camada | Persistência candidata |
|----------|--------|------------------------|
| Criar tarefa | Execution Engine → Task repository | Já existe módulo tasks |
| Atualizar projeto | Project repository | Já existe módulo projects |
| Gerar relatório | Presenter + Memory write | OperationalRun + MemoryStore |
| Consultar dados | Snapshot / read APIs | Sem write |
| Analisar documento | Memory search + LLM | Read-only |

---

## 10. Ordem de implementação

> Somente após aprovação deste plano. Ordem = evoluir o existente.

### Fase 2.0 — Preparação (docs / contratos)

1. Congelar este documento como referência.
2. Listar ports Memory já existentes vs gaps mínimos no briefing.

### Fase 2.1 — Memory no path Employee

1. Injetar `MemoryStore` na composition do Lab Runtime (sem mudar Campus).
2. Enrichment do briefing do CEO (search por objetivo + workspace).
3. Enrichment do briefing do especialista (fatia da delegação).
4. Após consolidação: store do resumo da missão.
5. Testes deterministic + 1 validação Gemini opcional.

### Fase 2.2 — Missão → trabalho persistente (sem tools externas)

1. Definir Action types internos allowlisted (`CreateTask`, `UpdateProjectField`, …).
2. Especialista (Mag) ou pipeline Agent Runtime **propõe** actions no outcome.
3. Policy gate + Execution Engine aplica o permitido.
4. `OperationalRun` registra propostas e resultados.
5. Board NEXO reflete tarefas criadas/atualizadas (telas existentes).

### Fase 2.3 — Alinhamento Workspace Runtime (opcional / se necessário)

1. Mapear Session ↔ OperationalRun **ou** documentar fronteira clara.
2. Evitar dois orquestradores.

### Explicitamente depois (nova aprovação)

- Novos Employees (promover fila Luna/Atlas/…).
- GitHub / tools externas.
- Automações contínuas.
- Novas telas.

---

## 11. Critérios de aceite

A Fase 2 estará **aceita** (quando implementada) se:

### Memória

- [ ] CEO recebe contexto recuperado da Memory **antes** de delegar (briefing enriquecido).
- [ ] Especialista recebe fatia histórica relevante na delegação.
- [ ] Resumo da missão é gravável/recuperável em missões seguintes do mesmo workspace.

### Persistência operacional

- [ ] Pelo menos um tipo de Action interna (ex.: criar tarefa) pode ser proposto e, sob policy, aplicado.
- [ ] `OperationalRun` continua sendo a auditoria da missão.
- [ ] Deterministic/CI cobre o fluxo sem rede.

### Arquitetura

- [ ] Um único `MissionOrchestrator` de missão de equipe.
- [ ] Delegação ainda só por `Specialization`.
- [ ] Nenhum Employee novo; Registry continua Opera + Mag.
- [ ] Campus / ECS / mapas / Runtime core intocados.
- [ ] Sem GitHub / tools externas.

### Aceite negativo

- [ ] Fila “Chegando em breve” permanece apresentação até decisão de contratação.
- [ ] Nenhuma tela nova obrigatória para o aceite.

---

## 12. Riscos

| Risco | Mitigação |
|-------|-----------|
| Agent Runtime virar segundo orquestrador | Usar só como pipeline interno; MissionOrchestrator manda no ciclo |
| Memory ruidosa degradar delegação | Top-K + filtro por workspace; testes com fixtures |
| Actions prematuras quebrarem dados | Allowlist + policy + audit; começar com CreateTask |
| Pressão para “contratar” a fila da UI | Travado neste doc; N-ready sem criar agora |
| Duplicar missão (Session vs OperationalRun) | Uma fonte de auditoria Digital Team = OperationalRun |
| Escopo expandir para Campus | Baseline LOCKED; fora desta fase |
| Custo Gemini em testes de memória | Deterministic default; Gemini só validação pontual |

---

## Decisões de produto (Fase 2)

| # | Decisão |
|---|--------|
| 1 | Evoluir arquitetura existente — sem sistema paralelo |
| 2 | Ordem: Memory → Actions internas → (depois) tools externas |
| 3 | Continuar apenas Opera + Mag no Registry |
| 4 | Fila de contratação da UI ≠ Employees reais |
| 5 | Side-effects reais com controle (policy + Execution Engine) |
| 6 | Campus / ECS / Runtime core / mapas fora de escopo |

---

## Próximo passo

Este documento é o **plano técnico oficial** da Fase 2 — Digital Team Online (Preparação para Operação Real).

**NÃO implementar** até aprovação explícita.

Após aprovação, iniciar pela **Fase 2.1 (Memory no path Employee)**, na ordem do §10.
