# Digital Team Online — Fase 1
## Plano Técnico Oficial

**Tipo:** arquitetura, implementação controlada e validação humana  
**Status:** Fase 1.1–1.4 implementadas · **Fase 1.5 ACEITE APROVADO** (Gemini)  
**Prioridade:** máxima do projeto (acima de Campus / Lab espacial / Geraí)  
**Referências obrigatórias:**
- [`docs/employee-activation.md`](employee-activation.md)
- [`docs/employee-framework.md`](employee-framework.md)
- [`docs/operaia-ceo.md`](operaia-ceo.md)
- [`docs/opera-campus-baseline-v1.md`](opera-campus-baseline-v1.md) (LOCKED — fora de escopo desta fase)
- [`docs/operaia-lab-fase-2.md`](operaia-lab-fase-2.md) (§10: não autoriza novos funcionários)

**Em caso de conflito com Campus / engine / ECS:** Baseline v1.0 prevalece; esta fase **não** os altera.

---

## 1. Visão Geral

A Fase 1 — **Digital Team Online** transforma a Equipe Digital em um **fluxo operacional completo**, usando **exclusivamente** a arquitetura já aprovada.

Não se trata de criar Employees, Frameworks, providers, produtos ou expansões do Campus.  
Trata-se de **conectar** os componentes existentes para que o fluxo abaixo rode **sem intervenção manual**:

```
Usuário
  → CEO recebe missão
  → CEO entende o objetivo
  → CEO identifica especializações necessárias
  → CEO delega automaticamente (por especialização)
  → Employee Matcher resolve especialistas no Registry
  → Cada especialista executa (intelectual)
  → Cada especialista devolve resultado
  → CEO consolida
  → Missão é registrada (Operations)
  → Usuário recebe uma única resposta consistente (Sala da CEO)
```

**Missão de validação:** missão real do workspace **NEXO**  
Exemplo de objetivo: *"Quero adicionar autenticação ao NEXO."*

**Employees disponíveis hoje (e únicos nesta fase):**

| ID | Nome | Specialization |
|----|------|----------------|
| `operaia-ceo` | Opera | `MANAGEMENT` |
| `cto-mag` | Mag | `SOFTWARE_ENGINEERING` |

A arquitetura deve continuar suportando **N** especialistas. Novos papéis **não** entram nesta fase.

---

## 2. Arquitetura completa do fluxo

### 2.1 Direção arquitetural única (não criar pilhas paralelas)

Hoje existem duas pilhas no monorepo:

| Pilha | Pacotes | Uso atual |
|-------|---------|-----------|
| **Employee Activation** | `employee-framework`, `employee-runtime`, brains (CEO/Mag), `MissionOrchestrator` | Chat CEO + Operations / NEXO |
| **Agent / Workspace** | `agent-runtime`, `workspace-runtime`, `orchestration-engine`, `memory` | Sessões de workspace / kernel paralelo |

**Decisão oficial desta fase:** o caminho operacional da Equipe Digital **convergem** para a arquitetura principal do produto, com o `MissionOrchestrator` + Employee Activation Layer como **núcleo do fluxo de missão**, e Agent Runtime / Workspace Runtime / Memory como **camadas de suporte** a serem alinhadas gradualmente — **sem** inventar um terceiro orquestrador.

```
┌─────────────────────────────────────────────────────────────┐
│  Interfaces                                                  │
│  · Sala da CEO (UI)                                          │
│  · Operations / Missions (camada operacional)                │
└───────────────────────────┬─────────────────────────────────┘
                            │ mesma execução
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Application Composition (API)                               │
│  · EmployeesApplication / OperationalMissionService          │
│  · WorkspaceSource (snapshot NEXO)                           │
│  · MissionPresenter                                          │
│  · OperationalRunStore (registro)                            │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  MissionOrchestrator  (única orquestração de missão)         │
│  Opera decide → DelegationService → Opera consolida          │
└───────┬─────────────────────────────┬───────────────────────┘
        │                             │
        ▼                             ▼
┌───────────────────┐       ┌───────────────────────────────┐
│ Employee Runtime  │       │ DelegationService             │
│ · EmployeeRunner  │       │ · EmployeeMatcher             │
│ · BriefingAdapter │       │ · resolve por Specialization  │
└─────────┬─────────┘       └───────────────┬───────────────┘
          │                                 │
          ▼                                 ▼
┌───────────────────┐       ┌───────────────────────────────┐
│ Employee Framework│       │ Registry (Opera, Mag, …N)     │
│ · BaseEmployee    │       │ · nunca nomes no CEO          │
│ · EmployeeBrain   │       └───────────────────────────────┘
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ ai-core LLM Stack │  Deterministic (CI) · Gemini (humano)
└───────────────────┘

Direção de convergência (gradual, mesma arquitetura):
  MemoryStore ──────────────► briefing / contexto de missão
  Workspace Runtime ────────► fonte canônica de snapshot (já parcialmente via WorkspaceSource)
  Agent Runtime ────────────► execução de especialista quando side-effects existirem (Fase 2+)
  Orchestration Engine ─────► policies/ciclos se necessário; NÃO duplicar MissionOrchestrator
```

### 2.2 Princípios travados

1. **CEO nunca conhece nomes** — só `Specialization`.
2. **Registry resolve quem executa.**
3. **Uma missão = uma execução = uma resposta consolidada + um registro Operations.**
4. **Sala da CEO é interface; Operations é a camada operacional.**
5. **Execução intelectual nesta fase** — sem GitHub, DB writes de domínio, arquivos, tools externas.
6. **Campus / engine / ECS / providers / schema** fora de escopo.

---

## 3. Sequência de execução

Missão de validação: objetivo NEXO (ex.: autenticação).

| Passo | Ator | Ação | Artefato |
|------:|------|------|----------|
| 0 | Usuário | Envia objetivo (chat **ou** Operations) | `objective` + `workspaceId=nexo` |
| 1 | Application | Carrega `WorkspaceSnapshot` via `WorkspaceSource` | snapshot NEXO (projetos/tarefas) |
| 2 | `MissionOrchestrator` | `runner.run(Opera, context)` | `EmployeeResult` inicial |
| 3 | OperaBrain | Analisa objetivo + snapshot; decide se delega | `EmployeeDecision` + `delegations[]` |
| 4 | Orchestrator | Se há delegações → `DelegationService.run` | — |
| 5 | Matcher | Para cada `Specialization`, resolve no Registry | employee concreto (ex.: Mag) |
| 6 | Runner | Executa cada especialista com briefing focado | `DelegationOutcome[]` |
| 7 | MagBrain (ex.) | Análise / plano / arquitetura (intelectual) | outcome estruturado + narrativa |
| 8 | Orchestrator | `runner.run(Opera, { …, delegationOutcomes })` | `EmployeeResult` final |
| 9 | CeoBrain | Consolida outcomes; `delegations: []` | resposta única |
| 10 | Presenter | Formata reply + workflow para UI | `EmployeeReplyPayload`, `WorkflowPayload` |
| 11 | Operations | Persiste `OperationalRun` (mesmo resultado) | registro auditável |
| 12 | UI / cliente | Exibe **apenas** a resposta consolidada | uma entrega |

**Sem intervenção manual** entre os passos 1–12.

**Modos LLM:**

| Modo | Uso |
|------|-----|
| Deterministic | testes, CI, regressão |
| Provider real (Gemini) | validação humana do fluxo NEXO |

---

## 4. Responsabilidade de cada componente

| Componente | Responsabilidade nesta fase | Não faz |
|------------|----------------------------|---------|
| **Sala da CEO (UI)** | Coletar objetivo; exibir resposta consolidada + workflow | Orquestrar; conhecer Mag; registrar missão sozinha |
| **Operations / Missions** | Disparar a **mesma** execução; listar/consultar runs | Regras de cérebro de Employee |
| **EmployeesApplication** | Adaptar ask → contexto → orchestrator → presenter | Persistência operacional (deve **compartilhar** a execução com Operations) |
| **OperationalMissionService** | Rodar orchestrator + gaps + LLM events + `OperationalRunStore` | Inventar funcionários |
| **MissionOrchestrator** | Encadear decide → delega → consolida | Conhecer nomes; regras de negócio de brain |
| **EmployeeRunner** | Briefing → Employee → Output | Matching |
| **WorkspaceBriefingAdapter** | `WorkspaceSnapshot` → `EmployeeBriefing` | Expor infra ao Employee |
| **EmployeeMatcher** | `Specialization` → entry no Registry | Escolher por nome |
| **DelegationService** | Executar N delegações; outcomes (matched / unmatched) | Side-effects externos |
| **EmployeeRegistry** | Catálogo dos Employees existentes | Criar papéis novos |
| **Opera (CeoBrain)** | Analisar, pedir especializações, consolidar | Hardcode de IDs de colegas |
| **Mag (MagBrain)** | Execução intelectual de `SOFTWARE_ENGINEERING` | Tools / commits / DB |
| **LLM Stack (ai-core)** | Narrativa / complete com policy + fallback | Decidir especialização (fica no brain determinístico + contexto) |
| **WorkspaceSource** | Snapshot do workspace NEXO | Orquestração |
| **WorkflowStore / Presenter** | Visibilidade do fluxo para UI | Fonte da verdade operacional (Operations é o registro) |
| **Memory / Agent Runtime / Workspace Runtime** | Direção de convergência (ver §5); uso mínimo alinhado, sem nova pilha | Substituir MissionOrchestrator |

---

## 5. Fluxo entre Runtime, Employee Runtime, Workspace e Memory

### 5.1 Estado atual (fato)

- **Employee Runtime** já executa o fluxo CEO → Mag → consolidação.
- **Workspace** chega como `WorkspaceSnapshot` (via `WorkspaceSource` / mappers) — já é o contrato de trabalho do Employee.
- **Memory** (`MemoryStore`) está ligado ao **Agent Runtime / Workspace Runtime**, **não** ao `EmployeeRunner`.
- **Agent Runtime** não é chamado pelo `MissionOrchestrator`.

### 5.2 Direção oficial (convergência)

Uma única linha de produto:

```
Workspace (fonte de verdade do projeto)
    → Snapshot / Briefing
    → MissionOrchestrator + Employee Runtime
    → (futuro) Memory como contexto recuperável da missão/sede
    → (futuro) Agent Runtime para execução com tools/side-effects
```

| Camada | Papel na Fase 1 | Papel pós–Fase 1 |
|--------|-----------------|------------------|
| Workspace Runtime / Source | Fornecer snapshot NEXO confiável | Continuar como fonte canônica de workspace |
| Employee Runtime | **Núcleo** da missão digital | Continua núcleo de decisão/delegação/consolidação |
| Memory | Planejar ponto de injeção no briefing (sem RAG obrigatório no aceite) | Persistência/recuperação de decisões da sede |
| Agent Runtime | Não obrigatório para aceite intelectual | Especialista com tools / efeitos |
| Orchestration Engine | Não duplicar missão | Policies avançadas se necessário |

**Regra:** qualquer evolução deve **alimentar** o fluxo Employee/MissionOrchestrator — nunca criar um segundo “CEO orchestrator”.

---

## 6. Como ocorre a delegação

Contrato já aprovado (`employee-activation.md`):

1. CeoBrain analisa objetivo + tasks/plano do briefing.
2. Emite `delegations: [{ specialization, reason, … }]` — **somente especialização**.
3. `DelegationService` itera pedidos.
4. `EmployeeMatcher` consulta Registry por `Specialization`.
5. Se matched → Runner executa especialista com briefing focado (`objective` = motivo da delegação).
6. Se unmatched → `DelegationOutcome.matched = false` (CEO fica ciente; fluxo não quebra).

**Exemplo correto:**
```ts
delegate({ specialization: "SOFTWARE_ENGINEERING", reason: "…" })
```

**Proibido:**
```ts
delegate({ employeeId: "cto-mag" }) // ou qualquer nome
```

Hoje o registry só cobre `SOFTWARE_ENGINEERING` além de `MANAGEMENT`. A arquitetura permanece **N-ready**; a Fase 1 valida com Mag.

---

## 7. Como ocorre a consolidação

1. Orchestrator só chama o segundo `runner.run(Opera)` se `outcomes.length > 0`.
2. Outcomes entram no contexto (`delegationOutcomes`) e no briefing (`additional`).
3. CeoBrain.consolidate:
   - lê resultados dos especialistas;
   - sintetiza **uma** decisão / mensagem;
   - zera novas delegações nesse passo (`delegations: []`).
4. Presenter expõe `final` como única voz ao usuário.
5. UI da Sala da CEO mostra o conteúdo consolidado — não as narrativas brutas dos especialistas como resposta principal (elas podem aparecer no workflow/audit).

---

## 8. Como ocorre o registro da missão

**Decisão aprovada:** a mesma execução gera:

1. **Resposta consolidada** na Sala da CEO  
2. **Registro** em Operations (`OperationalRun`: objetivo, mission, reply, workflow, llmEvents, gaps, timestamps)

### 8.1 Estado atual (bloqueio a resolver na implementação)

| Caminho | Executa Orchestrator? | Registra OperationalRun? |
|---------|----------------------|---------------------------|
| `POST /employees/:id/ask` (Sala da CEO) | Sim | **Não** (hoje) |
| `POST /operations/missions` / `…/nexo` | Sim | Sim |

### 8.2 Modelo alvo da Fase 1 (conexão, não feature nova)

```
UI Sala da CEO ──┐
                 ├──► Única execução de missão ──► MissionOrchestrator
Operations ──────┘              │
                                ├─► reply consolidada → UI
                                └─► OperationalRunStore.save → Operations
```

Ambos os canais representam **a mesma missão** (mesmo `workspaceId`, mesmo `objective`, mesmo resultado auditável). A Sala da CEO permanece interface; Operations permanece a camada operacional.

Detalhe de wiring (porta compartilhada / serviço único) fica para a **ordem de implementação** (§10) — sem novo framework.

---

## 9. Bloqueios existentes

Itens que **impedem** declarar a Fase 1 completa hoje:

| # | Bloqueio | Impacto |
|---|----------|---------|
| B1 | Chat CEO e Operations **não compartilham** o mesmo registro de missão | Violam decisão “mesma missão nos dois caminhos” |
| B2 | Pilha Agent/Memory **desconectada** do Employee path | Risco de arquitetura paralela se evoluir errado; aceitável intelectualmente, mas a convergência deve ser planejada (esta fase) e iniciada sem duplicar orquestração |
| B3 | Validação humana Gemini vs CI deterministic precisam do **mesmo** critério de fluxo | Aceite ambíguo se só um modo for exercitado |
| B4 | UI pode hardcodar workspace NEXO / não refletir `OperationalRun` | Usuário não “vê” o registro operacional |
| B5 | Especialista sem match (especialização futura) | Outcome unmatched — OK arquiteturalmente; Fase 1 só valida especializações existentes |
| B6 | Execução ainda só intelectual | **Não é bloqueio** desta fase (decisão explícita); vira escopo Fase 2 |

**Não são bloqueios desta fase:** ausência de novos Employees; ausência de tools/GitHub; Campus locked.

---

## 10. Ordem recomendada de implementação

> Implementação **somente após aprovação** deste plano. Ordem = conectar o existente.

1. **Contrato de missão única**  
   Definir/usar um ponto de aplicação compartilhado: “rodar missão (workspaceId, objective, employeeId porta-voz)” → `MissionResult` + persistência Operations + payload UI.

2. **Unificar canais**  
   Sala da CEO e Operations passam a chamar esse ponto (sem segundo orquestrador).

3. **Garantir snapshot NEXO**  
   WorkspaceSource confiável para a missão de validação (já existente; validar ponta a ponta).

4. **Exercitar fluxo de delegação por especialização**  
   Objetivo NEXO que force `SOFTWARE_ENGINEERING` → Mag → consolidação Opera.

5. **Modo Deterministic**  
   Testes/CI cobrindo: decide → match → execute → consolidate → register.

6. **Modo Gemini (humano)**  
   Mesma missão NEXO; conferir resposta única + run em Operations.

7. **Alinhamento de convergência (mínimo necessário)**  
   Documentar/aplicar o ponto de encaixe Memory/Agent **sem** obrigar tools; evitar qualquer novo caminho paralelo de “missão”.

8. **Aceite formal**  
   Checklist §11.

**Fora desta ordem:** Campus, ECS, engine, novos Employees, providers novos, side-effects.

---

## 11. Critérios de aceite

A Fase 1 está **aceita** somente se **todos** os itens abaixo forem verdadeiros:

### Fluxo

- [x] Dado o objetivo NEXO (ex.: autenticação), o CEO analisa sem intervenção manual.
- [x] A delegação usa **apenas** `Specialization` (nunca ID/nome de Employee).
- [x] O Matcher resolve `SOFTWARE_ENGINEERING` → Mag via Registry.
- [x] Mag devolve resultado intelectual estruturado.
- [x] Opera consolida em **uma** resposta.
- [x] O usuário vê essa resposta na **Sala da CEO**.

### Registro e canais

- [x] A mesma execução aparece como missão em **Operations**.
- [x] Disparar via Sala da CEO e via Operations produz o **mesmo tipo** de artefato (missão registrada + resposta consolidada).
- [x] Não há passo manual entre envio do objetivo e a entrega.

### Modos LLM

- [x] Suite deterministic/CI verde no fluxo completo.
- [x] Validação humana com Gemini conclui o mesmo fluxo com resposta coerente.

### Escopo negativo (não regredir)

- [x] Nenhum Employee novo criado.
- [x] Nenhum Framework novo.
- [x] Campus / engine / ECS / Baseline intocados.
- [x] Sem integração GitHub / tools / efeitos persistentes de implementação.

### Missão de validação oficial

```
Objetivo: "Quero adicionar autenticação ao NEXO."
Workspace: nexo
Porta-voz: operaia-ceo
Especialista esperado (hoje): SOFTWARE_ENGINEERING → Mag
Saída: 1 resposta consolidada + 1 OperationalRun
```

---

## 12. Riscos

| Risco | Mitigação |
|-------|-----------|
| Continuar com dois caminhos (chat vs ops) divergentes | Serviço/aplicação única de missão (§8.2, §10.1–2) |
| Tentação de “usar Agent Runtime” criando segundo fluxo | Agent Runtime só como executor futuro **dentro** do especialista; MissionOrchestrator permanece único |
| CEO “conhecer” Mag por atalho de código | Code review: só `Specialization` nas decisions |
| Aceite só em deterministic (falso positivo narrativo) | Critério dual: CI + run Gemini humano |
| Expandir para side-effects cedo | Travado na Fase 2 (§13) |
| Pressão por novos Employees (UX, Legal, …) | Explicitamente fora; unmatched specialization é sinal, não contratação automática |

---

## 13. O que fica para a Fase 2

| Tema | Fase 1 | Fase 2+ |
|------|--------|---------|
| Side-effects (GitHub, arquivos, DB de implementação, tools) | Não | Sim |
| Agent Runtime na execução do especialista | Direção apenas | Integração efetiva |
| Memory no briefing de missão | Direção / encaixe mínimo | RAG / histórico da sede |
| Novos Employees | Não | Somente com decisão explícita de produto |
| Múltiplas especializações no mesmo ciclo (UX + Eng + …) | Arquitetura N-ready; validar com as existentes | Quando houver Employees no Registry |
| Campus / mapas / hub vertical | Suspenso | Fora desta missão |
| Billing / auth de produto / multiplayer | Fora | Fora |

---

## Decisões aprovadas (resumo operacional)

| # | Decisão |
|---|--------|
| 1 | Validar **Sala da CEO** e **Operations** — mesma missão |
| 2 | Sem novos Employees; delegação por **especialização**; N-ready |
| 3 | Convergir para arquitetura principal (Employee + Agent + Workspace + Memory + Orchestrator) — sem pilhas paralelas |
| 4 | Execução **intelectual** basta; sem side-effects |
| 5 | Entrega = resposta consolidada **e** registro Operations |
| 6 | LLM dual: Deterministic + Gemini |

---

## Fase 1.5 — Validação Humana Gemini

**Status:** ACEITE APROVADO  
**Data da validação:** 2026-07-23  
**Modo:** Provider real (Gemini) · sem alteração de código nesta subfase

### Missão utilizada

```
Quero adicionar autenticação ao NEXO.
```

Workspace: `nexo` · Porta-voz: `operaia-ceo`

### Canais validados

| Canal | Endpoint |
|-------|----------|
| Sala da CEO | `POST /employees/operaia-ceo/ask` |
| Operations | `POST /operations/missions` (mesmo `objective`) |

### Resultado

Ambos executaram o mesmo fluxo operacional:

```
THINKING
  ↓
ANALYZING
  ↓
DELEGATING
  ↓
EXECUTING
  ↓
REVIEWING
  ↓
DONE
```

| Item | Valor |
|------|--------|
| Especialista utilizado | `cto-mag` |
| Especialização | `SOFTWARE_ENGINEERING` |
| Consolidação | `operaia-ceo` |
| OperationalRun | `status: completed` (duas execuções registradas) |
| Status da subfase | **ACEITE APROVADO** |

**Nota:** com Gemini, o texto consolidado pode variar entre runs; o aceite compara **comportamento operacional** (especialização, Mag, consolidação CEO, registro), não igualdade literal de texto.

**Métricas da validação humana (aprox.):** ~21–24 s por canal · ~6 eventos LLM por execução · ~12 completes no total dos dois caminhos.

---

## Estado atual da Equipe Digital

A Equipe Digital está **operacional** no Lab, com a arquitetura aprovada conectada ponta a ponta.

### Disponível

- ✓ CEO operacional (`operaia-ceo`)
- ✓ Delegação automática (por especialização)
- ✓ Registry de especialistas
- ✓ Execução de especialistas (intelectual)
- ✓ Consolidação executiva
- ✓ Provider Gemini (validação humana / produto)
- ✓ Provider deterministic (testes / CI / regressão)
- ✓ Registro operacional das missões (`OperationalRun`)

### Limitações conhecidas

- Roster inicial pequeno
- Apenas CEO + CTO disponíveis no Registry (`operaia-ceo`, `cto-mag`)
- Sem ferramentas externas
- Sem side-effects reais
- Sem execução GitHub / arquivos / banco de implementação
- Memória avançada ainda em evolução (fora do caminho crítico da Fase 1)

---

## Próximo passo

A Fase 1 — Digital Team Online (1.1 → 1.5) está **concluída e documentada**.

Qualquer **Fase 2** (side-effects, tools, Agent Runtime na execução, novos Employees, etc.) exige **aprovação explícita** e plano próprio — sem expandir escopo por inércia.
