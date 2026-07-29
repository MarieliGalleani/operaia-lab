# 09 — Architecture Decisions

> Parte 10 do [OperaIA Engineering Handbook](./README.md)

Este documento registra as **principais decisões arquiteturais (ADR)** do OperaIA.lab. Cada ADR captura contexto, decisão, motivação, consequências positivas e trade-offs aceitos — formando a memória oficial de por que o sistema é como é.

| ADR | Título | Status |
|---|---|---|
| ADR-001 | Modular Monolith como arquitetura base | Aceito |
| ADR-002 | Funcionários digitais isolados por domínio | Aceito |
| ADR-003 | Opera CEO como camada de decisão estratégica | Aceito |
| ADR-004 | Separação entre domínio, runtime e infraestrutura | Aceito |
| ADR-005 | Human Oversight como princípio de operação | Aceito |
| ADR-006 | Operational Supervisor como infraestrutura operacional | Aceito |

> ADRs em `docs/architecture/adr/` complementam este índice (deploy, Mission System, memória). Este documento cobre as decisões **centrais do sistema operacional digital**.

| ADR (architecture/) | Título | Status |
|---|---|---|
| [ADR-007](../architecture/adr/ADR-007-mission-system-consolidation.md) | MissionQueue como fonte oficial | Aceito (fases em curso) |
| [ADR-008](../architecture/adr/ADR-008-memory-three-layers.md) | Memória em três camadas (M1/M2/M3) | Proposto — aguarda aprovação |
| [ADR-009](../architecture/adr/ADR-009-domain-signal-layer.md) | Domain Signal Layer | Aceito — S1+S2+S3.1; convert/webhook HTTP pendentes |
| Proposta | [Arquitetura de memória](../architecture/memory-architecture.md) | Proposta técnica (sem código) |
| Proposta | [Domain Signal Layer](../architecture/domain-signal-layer.md) | Especificação técnica (S1+S2 no código) |
| Contrato | [GitHub Signal Contract S3.0](../architecture/github-signal-contract.md) | Contrato de domínio — Bridge ainda não |

---

## ADR-001 — Modular Monolith como arquitetura base

| Campo | Valor |
|---|---|
| **Status** | Aceito |
| **Área** | Arquitetura de sistema / monorepo |

### Contexto

O OperaIA.lab precisa organizar múltiplas capacidades — funcionários digitais, orquestração, execução, memória, API e persistência — sem a complexidade operacional precoce de uma malha de microserviços. Ao mesmo tempo, o código não pode colapsar em um monólito acoplado que impeça evolução por domínio.

### Decisão tomada

Adotar **Modular Monolith** em monorepo (pnpm workspaces):

- um artefato deployável principal (`apps/api`);
- fronteiras internas explícitas via `packages/*`;
- um banco operacional compartilhado;
- pacotes com contratos e direção de dependência controlada.

### Motivo da decisão

- simplicidade operacional (um deploy, um processo, um banco);
- velocidade de iteração no estágio atual do produto;
- preservação de bounded contexts que permitem extração futura sem reescrita de domínio;
- alinhamento com a natureza do Digital Office — um escritório coeso, não uma rede de serviços soltos.

### Consequências positivas

- onboarding e debugging mais simples;
- transações e consistência locais mais fáceis;
- evolução de pacotes sem coordenar deploys distribuídos;
- caminho claro para extrair módulos depois, se necessário.

### Trade-offs aceitos

- limites de módulo dependem de disciplina de engenharia (não de rede);
- escala horizontal por serviço ainda não é nativa;
- um fault no processo afeta o artefato inteiro;
- ownership de pacotes exige governança no monorepo.

---

## ADR-002 — Funcionários digitais isolados por domínio

| Campo | Valor |
|---|---|
| **Status** | Aceito |
| **Área** | Employee System / domínio |

### Contexto

Agentes genéricos tendem a acoplar papéis, compartilhar estado e chamar uns aos outros diretamente. Isso quebra especialização, dificulta auditoria e transforma a organização digital em um grafo de prompts.

### Decisão tomada

Cada funcionário digital é um **pacote independente** (`packages/employees/{name}` ou agente em `packages/agents`) que:

- implementa contratos do Employee Framework;
- declara especialização, capacidades e limites;
- **não importa** outros employees;
- comunica apenas via runtime (Matcher / Delegation / Orchestration).

### Motivo da decisão

- preservar bounded contexts por domínio (engenharia, produto, finanças, etc.);
- permitir contratar novos funcionários sem alterar o núcleo;
- garantir que delegação ocorra por `Specialization`, não por nome;
- manter testabilidade e substituição individual de brains.

### Consequências positivas

- crescimento da equipe digital sem reescrever o framework;
- isolamento de falhas e mudanças de prompt/lógica;
- matching previsível via `EmployeeRegistry`;
- conformidade com o princípio "Agents are not isolated bots" — coordenados, mas não acoplados.

### Trade-offs aceitos

- mais pacotes e boilerplate inicial por funcionário;
- comunicação indireta pode parecer "mais longa" que uma chamada direta;
- descoberta de capacidades depende de registry/roster bem mantidos;
- duplicação controlada de padrões entre specialists (mitigada por `specialist-kit`).

---

## ADR-003 — Opera CEO como camada de decisão estratégica

| Campo | Valor |
|---|---|
| **Status** | Aceito |
| **Área** | Decisão / orquestração cognitiva |

### Contexto

Sem um ponto único de análise e consolidação, missões se fragmentam: múltiplos specialists respondem em paralelo, o usuário recebe ruído e não há porta-voz executivo. Por outro lado, concentrar toda execução técnica no CEO cria um "super-agente" sem limites.

### Decisão tomada

A **Opera** é a camada oficial de **decisão estratégica e consolidação**:

- recebe objetivos;
- analisa contexto (workspace, memória, insights);
- aplica CEO Gate (delegar ou responder);
- solicita especialidades via `DelegationRequest`;
- consolida o resultado final para o usuário.

Opera **não** executa tarefas técnicas especializadas (código, telas, automações de domínio).

### Motivo da decisão

- um único ponto de julgamento coordenador por missão;
- separação clara entre estratégia e especialização;
- resposta executiva consistente (porta-voz Opera);
- limites explícitos evitam que o CEO vire executor genérico.

### Consequências positivas

- fluxo oficial previsível: Análise → Delegação → Execução → Consolidação;
- especialistas permanecem focados no domínio;
- auditoria atribui decisões estratégicas ao CEO;
- Human Oversight tem um interlocutor claro.

### Trade-offs aceitos

- latência adicional no ciclo (CEO antes e depois dos specialists);
- qualidade da missão depende fortemente do CEO Gate e do briefing;
- risco de gargalo cognitivo se o CEO for sobrecarregado (mitigado por delegação e fila);
- consultants/advisory paths precisam de heurísticas cuidadosas para não delegar em excesso.

---

## ADR-004 — Separação entre domínio, runtime e infraestrutura

| Campo | Valor |
|---|---|
| **Status** | Aceito |
| **Área** | Camadas / dependências |

### Contexto

Misturar decisão de domínio, ativação de runtime e persistência no mesmo módulo cria acoplamento rígido: employees conhecem Prisma, brains montam Actions, e trocar LLM ou memória exige reescrever funcionários.

### Decisão tomada

Separar o sistema em três planos:

| Plano | Pergunta | Exemplos |
|---|---|---|
| **Domínio** | O que deve acontecer? | `employee-framework`, `agents`, `employees/*` |
| **Runtime** | Como preparar e coordenar? | `employee-runtime`, `execution-engine`, `orchestration-engine` |
| **Infraestrutura** | Como persistir e integrar? | `database`, `memory`, `ai-core`, `shared` |

`apps/api` é o **composition root** — único lugar que monta os planos.

### Motivo da decisão

- funcionários puros (briefing in / decision out);
- execução controlada e auditável via Execution Engine;
- contratos (`MemoryStore`, `LLMProvider`) substituíveis sem quebrar domínio;
- alinhamento com Clean Architecture nos módulos da API.

### Consequências positivas

- testabilidade por camada;
- evolução independente de providers e stores;
- fronteiras claras em code review;
- redução de "atalhos" que quebram auditabilidade.

### Trade-offs aceitos

- mais indirection (adapters, mappers, ports);
- curva de aprendizado inicial da direção de dependências;
- risco de over-engineering se ports forem criados sem necessidade real;
- composição concentrada na API exige disciplina para não virar "god object" (mitigado por módulos e factories).

---

## ADR-005 — Human Oversight como princípio de operação

| Campo | Valor |
|---|---|
| **Status** | Aceito |
| **Área** | Governança / operação |

### Contexto

Sistemas de agentes podem deslizar para autonomia opaca: ações sem rastreio, decisões sem responsável humano e otimização local sem direção estratégica. O OperaIA.lab opera como escritório digital da organização — automação sem oversight viola confiança e accountability.

### Decisão tomada

**Human Oversight** é princípio arquitetural obrigatório:

- humanos definem objetivos e direção estratégica;
- o sistema automatiza análise, delegação, execução e consolidação;
- ações e missões são rastreáveis (`OperationalRun`, eventos, memória);
- decisões estratégicas permanecem supervisionáveis — não escondidas em specialists ou no Supervisor.

### Motivo da decisão

- responsabilidade final permanece humana;
- auditabilidade como requisito, não feature opcional;
- alinhamento com Digital Office e CEO Gate;
- prevenção de autonomia absoluta sem mandato.

### Consequências positivas

- confiança operacional e capacidade de auditoria;
- papéis claros: humano dirige, sistema opera;
- governança de mudanças estruturais (approvals) cabe no modelo;
- documentação e produto compartilham a mesma narrativa de accountability.

### Trade-offs aceitos

- nem todo passo é fully hands-off (e não deve ser);
- ciclos contínuos ainda precisam de telemetria e revisão humana periódica;
- governança adiciona fricção a mudanças estruturais (aceitável);
- definição de "crítico" vs "automático" exige calibração contínua.

---

## ADR-006 — Operational Supervisor como infraestrutura operacional

| Campo | Valor |
|---|---|
| **Status** | Aceito |
| **Área** | Runtime contínuo / operações |

### Contexto

Um Digital Office apenas reativo (só responde quando o humano pede) deixa workspaces ACTIVE sem acompanhamento, pendências órfãs e capacidade ociosa ou saturada sem sinal. Por outro lado, transformar o "supervisor" em Employee criaria um segundo CEO competindo por decisão estratégica.

### Decisão tomada

O **Operational Supervisor** é **infraestrutura operacional**, não Employee:

- implementado via `ContinuousRuntime` + `SupervisorLoop` (+ queue/workers);
- componentes: HealthMonitor, WorkspaceScanner, MissionScanner, QueueMonitor, RecoveryCoordinator, CoordinationDispatcher;
- observa, detecta, agenda `COORDINATE` para a Opera, recupera estados e dispara ciclos;
- **não** contém regras de negócio;
- **não** interpreta objetivos, **não** escolhe especialistas, **não** cria planos, **não** toma decisões.

Ciclo: Health → Workspace Scan → Mission Scan → Queue Scan → Recovery → Coordination Dispatch → Sleep.

Decisão de negócio permanece na Opera (CEO), nos specialists ou em políticas de domínio configuráveis.

### Motivo da decisão

- continuidade operacional sem confundir papéis cognitivos;
- alimentar a Opera com contexto (insights, portfolio) em vez de executar domínio;
- preservar Employee Framework limpo de timers, capacity e recovery;
- permitir throttle, readiness e recovery como preocupações de runtime.

### Consequências positivas

- escritório digital proativo e auditável;
- separação clara Supervisor / CEO / Specialists;
- missões contínuas reutilizam o mesmo fluxo de orquestração e memória;
- Production Readiness e recovery entram no start controlado do runtime.

### Trade-offs aceitos

- complexidade operacional adicional (fila, workers, scheduler);
- risco de enqueue excessivo se capacity/throttle falharem (mitigado por dedupe e limites);
- insights de baixa qualidade podem poluir objetivos (mitigado por CEO Gate e consolidação);
- operação contínua exige observabilidade e configuração de intervalos.

---

## Como usar este documento

1. **Antes** de mudar arquitetura central, verificar se a mudança contradiz um ADR aceito.
2. Se contradisser, **atualizar ou substituir** o ADR neste Handbook (e registrar o motivo).
3. Novas decisões estruturais devem ganhar um ADR aqui **antes** da implementação — conforme a [Development Rule](./README.md#6-development-rule).

---

> **Referências:** [01 — Architecture](./01-architecture.md) · [02 — Agent System](./02-agent-system.md) · [07 — Employee Framework](./07-employee-framework.md) · [08 — Operational Supervisor](./08-operational-supervisor.md) · [README](./README.md)
