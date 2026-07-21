# Virtual Office — Experiência do OperaIA.lab

> ⚠️ **DOCUMENTO LEGADO (histórico).** Descreve a implementação anterior
> (`modules/interactive-office`, Canvas 2D + DOM), que **será aposentada**. A
> arquitetura vigente é a **Plataforma de Mundo Virtual (WorldEngine)** descrita
> em [`operaia-2.0-experience.md`](./operaia-2.0-experience.md). Mantido apenas
> como registro das Sprints 8–9.

> Sprint 8 — Criar a experiência do escritório virtual.
> Sprint 8.1 — **Immersive Virtual Office**: evoluir de dashboard para um
> escritório digital vivo, organizado em **salas**.
> Sprint 8.2 — **Interactive Office**: um escritório **isométrico vivo** com
> salas por departamento, funcionários que se **movimentam**, mudam de **estado**
> e uma encenação visível da delegação da CEO.
> Sprint 9 — **Empresa digital completa**: escritório com Recepção, Sala de
> Reuniões, Biblioteca e Área de Descanso; **estações de trabalho** (mesa,
> cadeira e monitor que acende ao produzir); salas clicáveis para "entrar" em
> qualquer departamento; `AnimationController`, `TimelinePanel`, `OfficeWorld`
> (preparado para múltiplos andares) e uma **identidade visual própria**.
> Regra principal: não construir um painel de IA. Construir **um escritório
> digital onde a IA trabalha**.

## Visão do escritório

O Virtual Office (`apps/web`) é a camada de experiência onde a fundadora,
Marieli, entra na sua empresa digital. Ela não vê engines, runtimes ou agentes —
ela **caminha por salas**: a Sala da CEO, a Sala dos funcionários, os projetos
(cada um uma sala) e a Central de atividades. A sensação central é:
_"Existe uma empresa trabalhando comigo."_

O CEO — Opera é a porta de entrada: a **Sala da CEO** é a tela inicial (`/office`),
com o campo "O que vamos fazer hoje?" — uma conversa executiva, não um chat comum.
Opera analisa, envolve os especialistas nos bastidores e devolve um relatório.

## Interactive Office — o escritório vivo

A tela de entrada (`/office`) é o **Interactive Office**
(`src/modules/interactive-office`): um escritório **isométrico** em tiles (2:1)
com um andar completo — **Recepção**, **Sala da CEO**, **Sala de Reuniões**,
os departamentos (Tecnologia, Produto, Design, Marketing, Automação, Comercial,
Financeiro, Jurídico), a **Biblioteca** e a **Área de Descanso**. Cada funcionário
ocupa a sua sala com uma **estação de trabalho** (mesa, cadeira e monitor que
**acende** enquanto ele produz), um avatar (cabeça + corpo), uma **plaquinha de
estado** e o nome "Cargo — Nome" ao passar o mouse. Os projetos aparecem como
**salas** clicáveis numa faixa comum ao sul, e o nome de cada sala é um atalho
para **entrar** nela. A paleta índigo/executiva é própria do OperaIA.lab (a
recepção exibe a marca), para que a captura de tela seja reconhecível.

O escritório é **vivo**:

- **Movimentação** — quando a CEO delega, o especialista **caminha** até a Sala
  Executiva (via `MovementEngine`, caminho em "L" com transição CSS), recebe o
  briefing, volta à sua sala para executar e retorna para entregar o resultado.
- **Estados** — cada funcionário tem um estado visual (Disponível, Pensando,
  Analisando, Planejando, Desenvolvendo, Em reunião, Aguardando, Bloqueado,
  Offline), que muda a cor do avatar e a `StatusBubble`. Quem carrega uma tarefa
  ganha um `TaskIndicator`.
- **Interação** — clicar num funcionário abre a **sala dele** (missão, projetos,
  tarefas, histórico, última decisão, status); clicar na CEO abre a **Sala
  Executiva** (a conversa executiva); clicar num projeto abre a **sala do
  workspace** com apenas a equipe envolvida.
- **Timeline** — o `ActivityLayer` mostra a linha do tempo ao vivo (horário +
  ator + evento) enquanto o fluxo acontece.

O fluxo **Usuário → CEO → análise → delegação → funcionário → execução → retorno
→ CEO → usuário** é **encenado visualmente** pelo `ScenarioDirector` quando a
usuária conversa com a Opera — narração do trabalho real (a resposta vem do
`OfficeService.askCeo`), não lógica de negócio inventada.

O ambiente estático (piso, salas, móveis, rótulos) é desenhado em **canvas 2D**;
os avatares, bolhas e projetos são componentes Vue posicionados por cima via
projeção isométrica — sem WebGL, sem game-loop pesado (a caminhada é uma
transição CSS; a respiração/idle é animação CSS).

O menu lateral representa as **áreas do escritório**, não abas de um dashboard:

| Área | Rota | View |
| --- | --- | --- |
| 🏢 Escritório (isométrico vivo) | `/office` | `InteractiveOfficePage` (módulo `interactive-office`) |
| 👩🏻‍💼 Sala da CEO | `/office/sala-ceo` | `ExecutiveRoom` |
| 👥 Equipe | `/office/equipe` | `EmployeeRoom` |
| 🚀 Projetos (salas) | `/office/projetos` · `/office/projetos/:id` | `ProjectsView` · `WorkspaceRoom` |
| 📡 Central de atividades | `/office/atividades` | `ActivityCenter` |
| 📚 Conhecimento | `/office/conhecimento` | `KnowledgeView` |
| ⚙️ Configurações | `/office/configuracoes` | `SettingsView` |

O fluxo de trabalho (delegação) é representado visualmente pelo `WorkflowViewer`
nos estágios canônicos: **Pensando → Analisando → Delegando → Executando →
Revisando → Concluído**, junto da cadeia de atores (ex.: Opera → Análise → Mag →
Plano técnico → Resultado).

## Stack

- **Vue 3** (Composition API + `<script setup>`) + **Vite** + **TypeScript**.
- **vue-router** para a navegação do escritório (`/office/*`).
- **Vitest** + **@vue/test-utils** para os testes.
- Sem backend novo: a UI consome dados por um **contrato** (`OfficeService`),
  hoje atendido por uma implementação mockada.

## Estrutura

```
apps/web/src/
  types/office.ts            Modelos de UI (Employee, Project, Task, ...)
  data/
    dto.ts                   DTOs "de fio" (o que cada sistema do backend entrega)
    gateways/                Portas (contratos), uma por sistema do backend
      workspace-gateway.ts           -> Workspace Runtime
      sessions-gateway.ts            -> Sessions
      employee-registry-gateway.ts   -> Employee Registry
      employee-runtime-gateway.ts    -> Employee Runtime (statuses, ask, workflow)
      orchestration-events-gateway.ts-> Orchestration Events
      office-gateways.ts             Bundle OfficeGateways
    adapters/
      mock-gateways.ts       Implementação mock de todas as portas (seed local)
      http-gateways.ts       Implementação HTTP contra a API real
      http-client.ts         Cliente fetch (base /api/v1)
    mappers.ts               DTO -> modelo de UI (fronteira de tradução)
    presentation.ts          Avatar/rótulos + vagas preparadas (concern da UI)
    ceo-responder.ts         Resposta executiva determinística do CEO (mock)
    projects.ts              Seed local de workspaces/tarefas/eventos (mock)
    office-service.ts        Contrato consumido pela UI
    composite-office-service.ts  Fachada sobre os gateways (implementa OfficeService)
    mock-office-service.ts   Fachada + gateways mock (testes/dev)
    office-container.ts      Composition root (escolhe mock ou HTTP) + officeService
  composables/useOffice.ts   Estado reativo compartilhado + fetchWorkflow
  layouts/OfficeLayout.vue   Sidebar + conteúdo
  components/                EmployeeProfileCard, ActivityStream, WorkflowViewer,
                             ExecutiveChat, WorkspaceView, ProjectCard, TaskBoard, ...
  views/                     ExecutiveRoom, EmployeeRoom, WorkspaceRoom,
                             ActivityCenter, ProjectsView, ... (rotas do menu)
  modules/interactive-office/  Escritório isométrico vivo (a tela /office)
    types.ts                 Contratos do escritório (estado, sala, evento)
    config/office-config.ts  Salas (grid), especialidade→sala, estados visuais
    data/                    Providers desacopláveis (troca mock ⇄ API)
      office-provider.ts       Contrato do provider (load + askExecutive)
      employee/workspace/event-provider.ts  Mapeiam OfficeService → escritório
      mock-provider.ts · api-provider.ts · provider-factory.ts
    engine/
      movement-engine.ts     Movimentação (waypoints + duração), cancelável
      scenario-director.ts   Encena a delegação visível (CEO → especialista)
      animation-controller.ts  Estado → animação/monitor (sem DOM/canvas)
    render/
      projection.ts          Projeção isométrica 2:1 (fit/centro)
      primitives.ts          Losango, caixa isométrica, sombra (compartilhado)
      draw-desk.ts           Estação de trabalho (mesa, cadeira, monitor)
      draw-office.ts         Piso, salas, móveis, estações e identidade (canvas)
    composables/useInteractiveOffice.ts  Orquestra provider + engine + estado
    components/              OfficeWorld, OfficeMap, EmployeeAvatar, StatusBubble,
                             TaskIndicator, ActivityLayer (ticker), TimelinePanel,
                             ConversationPanel, ExecutiveRoom, EmployeeProfile,
                             EmployeeRoom (estação), DepartmentRoom, MeetingRoom,
                             WorkspaceRoom, OfficeShell
    InteractiveOfficePage.vue  Entrada da rota /office
```

## Arquitetura de dados (mock ⇄ API real)

A UI **nunca** fala com a rede diretamente. O fluxo é sempre:

```
Componentes → useOffice → OfficeService (fachada)
                              │
                              ▼
                        OfficeGateways (5 portas)
                     ┌────────┴─────────┐
              mock-gateways        http-gateways
              (seed local)        (API /api/v1)
```

Cada sistema do backend tem uma **porta** dedicada:

| Porta | Sistema do backend |
| --- | --- |
| `WorkspaceGateway` | Workspace Runtime |
| `SessionsGateway` | Sessions |
| `EmployeeRegistryGateway` | Employee Registry |
| `EmployeeRuntimeGateway` | Employee Runtime (Activation Layer) |
| `OrchestrationEventsGateway` | Orchestration Events |

Os **DTOs** (`dto.ts`) representam o formato da API; os **mappers** (`mappers.ts`)
traduzem DTO → modelo de UI. Uma mudança no formato da API é absorvida nos
mappers/adapters, **sem tocar em componentes**.

## Componentes reutilizáveis

| Componente | Papel |
| --- | --- |
| `OfficeLayout` / `SidebarNav` | Estrutura do escritório + navegação por áreas (salas). |
| `ExecutiveChat` | Conversa executiva com o CEO — Opera (cabeçalho opcional; usado dentro da Sala da CEO). |
| `EmployeeProfileCard` | Cartão do funcionário: cargo — nome, especialidade, status, projetos envolvidos e última ação. |
| `WorkspaceView` / `ProjectCard` | Projeto como sala: objetivo, status, progresso, equipe e decisões. |
| `TaskBoard` | Visão executiva de tarefas: Backlog / Em andamento / Concluído. |
| `ActivityStream` | Linha do tempo viva (horário + ator + evento). |
| `WorkflowViewer` | Fluxo de delegação: estágios canônicos + cadeia de atores. |
| `StatCard` | Indicadores do escritório (projetos ativos, funcionários, tarefas). |

### Interactive Office (módulo `interactive-office`)

| Componente / peça | Papel |
| --- | --- |
| `OfficeShell` | Layout: mundo (mapa) + dock (painel de sala) + linha do tempo. |
| `OfficeWorld` | Contêiner do andar (mapa + ticker + seletor de andares). |
| `OfficeMap` | Canvas do ambiente + overlay de avatares, salas e projetos (cliques). |
| `EmployeeAvatar` | Avatar do funcionário (estado → cor/pose), com bolha, balão e tarefa. |
| `StatusBubble` / `TaskIndicator` | Estado visual e “carregando tarefa”. |
| `ExecutiveRoom` / `ConversationPanel` | Sala Executiva: a conversa com a CEO. |
| `EmployeeProfile` | Bloco de identidade (avatar, cargo — nome, especialidade, status). |
| `EmployeeRoom` | Estação de trabalho: missão, objetivos, agenda, tarefas, ferramentas, histórico. |
| `DepartmentRoom` / `MeetingRoom` | Entrar num departamento / na sala de reuniões (quem está lá). |
| `WorkspaceRoom` | Sala do projeto (apenas a equipe envolvida). |
| `ActivityLayer` (ticker) / `TimelinePanel` | Último evento sobre o mapa / linha do tempo completa no dock. |
| `MovementEngine` | Movimentação pura (waypoints + duração), cancelável. |
| `AnimationController` | Traduz estado em animação/monitor, sem tocar em DOM/canvas. |
| `ScenarioDirector` | Encena a delegação visível (não é regra de negócio). |
| Providers (`Mock`/`Api` + `Employee`/`Workspace`/`Event`) | Dados desacoplados: trocar mock por API é trocar o provider (`VITE_USE_REAL_API`). |

**Camadas separadas:** Dados (providers) → Estado (`types` + composable) →
Movimentação (`engine`) → Renderização (`render` + componentes). Nenhuma regra de
negócio mora na renderização, e o mapa escala para dezenas de funcionários e
salas apenas acrescentando dados e definições de sala em `config`.

> **Identidade dos funcionários:** o cargo aparece **sempre antes do nome**
> (`CTO — Mag`), nunca `Mag (CTO)`. Metadados visuais (emoji, rótulos, vagas
> preparadas) vivem em `data/presentation.ts`.

## Fluxo do usuário

1. Marieli abre `/office` e vê o **escritório isométrico vivo** (Interactive
   Office): cada especialista na sua sala/departamento, com estado e presença, e
   os projetos como salas. Ela clica num personagem ou projeto para entrar na sala
   e, ao conversar com a Opera, vê a delegação **acontecer** (o especialista anda
   até a Sala Executiva, executa e retorna).
2. Entra na **Sala da CEO — Opera**: avatar, cargo, status, última atividade e o
   campo "O que vamos fazer hoje?".
3. Ela conversa sobre objetivos; Opera responde no formato executivo (resumo,
   projetos, riscos, próximas ações). Ao lado, o **fluxo em andamento**
   (`WorkflowViewer`) e as **atividades recentes** (`ActivityStream`).
4. Vai à **Sala dos funcionários** e vê cada especialista: status, especialidade,
   projetos envolvidos e última ação (Mag ativo; Luna, Atlas, Nexus... preparados).
5. Entra em um **projeto como sala** (ex.: 🚀 NEXO): objetivo, equipe, decisões,
   fluxo de delegação, tarefas e histórico.
6. Acompanha tudo em tempo real na **Central de atividades**.

## Funcionários

Ativos (correspondem aos funcionários reais no Employee Registry):

- 👩🏻‍💼 **CEO — Opera** (Gestão)
- 👩🏻‍💻 **CTO — Mag** (Engenharia de Software)

Vagas preparadas (crescimento do escritório, `active: false`):

- 🎨 Luna (UX/Product) · 📋 Atlas (Produto) · ⚙️ Nexus (Automação)
- 📈 Aurora (Marketing) · 💰 Orion (Financeiro) · ⚖️ Themis (Jurídico)
- 🤝 Mercúrio (Comercial)

Adicionar um funcionário na UI é acrescentar o perfil no gateway (mock ou API) e,
para as vagas preparadas, um item em `data/presentation.ts` — os componentes se
ajustam sozinhos. A estrutura está pronta para dezenas de especialistas.

## Como conectar dados reais

Os adapters HTTP já existem (`adapters/http-gateways.ts`) e mapeiam os
endpoints da API. Para ligar a API real basta configurar o ambiente:

```bash
# apps/web/.env  (veja .env.example)
VITE_USE_REAL_API=true
VITE_API_URL=http://localhost:3333/api/v1
```

O `office-container.ts` (composition root) passa a montar `createHttpGateways()`
no lugar de `createMockGateways()`. **Nenhum componente, view, composable,
mapper ou fachada muda** — apenas a origem dos gateways.

Endpoints consumidos pelos adapters HTTP:

| Porta | Endpoints |
| --- | --- |
| Sessions | `POST /workspaces/:id/sessions`, `GET /workspaces/:id/sessions/:sid` (já existem) |
| Workspace Runtime | `GET /workspaces`, `GET /workspaces/:id`, `GET /workspaces/:id/tasks` |
| Employee Registry | `GET /employees`, `GET /employees/:id` |
| Employee Runtime | `GET /employees/statuses`, `POST /employees/:id/ask`, `GET /workspaces/:id/workflow` |
| Orchestration Events | `GET /workspaces/:id/events` (e, futuramente, SSE via `subscribe`) |

As sessões já funcionam hoje; os demais endpoints seguem o mesmo padrão e serão
expostos pelo backend em sprints futuras. Como a origem é opt-in, o mock
permanece o padrão e nada quebra enquanto os endpoints não existem.

## Design principles

Empresa, confiança, profissionalismo e organização. A interface evita
deliberadamente a estética de "chatbot", "lista de bots" ou "playground de IA":
o usuário entra em **salas**, os funcionários têm cargo — nome, especialidade e
projetos; os projetos são salas com progresso e decisões; a CEO fala em linguagem
executiva e o trabalho aparece acontecendo (Activity Stream + Workflow Viewer).

## Evolução futura

- **Dados reais:** ligar `VITE_USE_REAL_API=true` assim que os endpoints de
  Workspace Runtime, Employee Registry, Employee Runtime e Events existirem.
- **Workflow ao vivo:** hoje o `WorkflowViewer` consome um snapshot; a porta
  `getWorkflow` está pronta para receber estados reais de delegação do Employee
  Runtime e, com `subscribe` (SSE), atualizar em tempo real.
- **Novas contratações:** promover as vagas preparadas (Luna, Atlas, Nexus, ...)
  a funcionários reais no Employee Registry — a UI já as exibe.
- **Escritório autônomo:** conectar a Sala da CEO a sessões reais para que a
  conversa executiva dispare orquestração de verdade e o resultado retorne como
  relatório na própria sala.
