# 08 — Operational Supervisor

> Parte 9 do [OperaIA Engineering Handbook](./README.md)

Este documento registra oficialmente o **Operational Supervisor** do OperaIA.lab — a camada de supervisão operacional contínua que observa workspaces, identifica necessidade de missões e inicia ciclos sem substituir o julgamento estratégico do Opera CEO.

---

## 1. Visão Geral

O **Operational Supervisor** é o mecanismo de **supervisão operacional contínua** do OperaIA.lab. Sua função é manter o escritório digital em movimento: verificar estado, detectar pendências, iniciar missões quando necessário e registrar a execução — em ciclos recorrentes.

Na implementação atual, esse papel é realizado pela composição de runtime contínuo em `apps/api`:

| Componente | Papel no Supervisor |
|---|---|
| **ContinuousRuntime** | Orquestra readiness, recovery, workers e scheduler |
| **MissionScheduler** | Ciclo periódico: snapshot → health → insights → enqueue |
| **MissionQueue / Workers** | Fila e execução assíncrona das missões iniciadas |
| **Improvement Engine** | Observa portfolio e gera insights (não decide) |

O Supervisor **não é uma interface de usuário**. É infraestrutura operacional que garante continuidade entre missões solicitadas pelo humano e o acompanhamento automático do estado dos workspaces.

### Princípio

```
Supervisor observa e inicia
CEO analisa e decide
Specialists executam domínio
Engine realiza ações
```

---

## 2. O que é o Operational Supervisor

O Operational Supervisor é a camada responsável por:

- observar o estado operacional dos workspaces e do portfolio;
- analisar pendências, capacidade e saúde operacional;
- identificar quando novas missões são necessárias;
- iniciar ciclos operacionais (enqueue de missões, tipicamente `COORDINATE` para a Opera);
- registrar execução e aguardar o próximo ciclo.

Ele transforma o Digital Office de um sistema **reativo apenas a pedidos humanos** em um sistema também **proativo na operação contínua** — sem assumir autoridade estratégica.

### O que ele produz

| Produz | Não produz |
|---|---|
| Snapshots de portfolio | Decisões estratégicas |
| Insights de melhoria | Planos de domínio especializados |
| Missões enfileiradas para o CEO | Regras de negócio novas |
| Registro de ciclos e métricas | Substituição do julgamento humano/CEO |

---

## 3. Por que ele não é um Employee

O Operational Supervisor **não é um Employee** e não implementa os contratos do Employee Framework.

| Employee | Operational Supervisor |
|---|---|
| Possui `EmployeeProfile` e `EmployeeBrain` | Não possui perfil nem brain |
| Decide sobre briefing de missão | Observa estado e inicia ciclos |
| Produz `EmployeeDecision` | Produz enqueue + insights + métricas |
| Vive em `packages/employees/*` ou `agents` | Vive na camada de runtime da API (`ContinuousRuntime`, `MissionScheduler`) |
| Especializa domínio | Especializa operação contínua |

### Razão arquitetural

Funcionários digitais **pensam e decidem** dentro de missões. O Supervisor **coordena a existência de missões** ao longo do tempo.

Se o Supervisor fosse um Employee:

- misturaria infraestrutura de polling/fila com domínio cognitivo;
- competiria com o CEO por decisões estratégicas;
- acoplaria o Employee Framework a timers, capacity e recovery.

Por isso permanece **fora** do modelo de funcionário — como runtime operacional, não como colaborador digital.

---

## 4. Supervisor, CEO e Specialists

| Papel | Responsabilidade | Autoridade |
|---|---|---|
| **Operational Supervisor** | Observar, detectar necessidade, iniciar ciclos, registrar | Operacional contínua |
| **Opera CEO** | Analisar, decidir, delegar, consolidar | Estratégica / coordenação |
| **Specialist Employees** | Executar domínio especializado dentro de limites | Especialização |

### Diferenças claras

**Supervisor** — "há trabalho / risco / capacidade? iniciar missão?"

**CEO** — "dado este objetivo e contexto, o que fazer e a quem delegar?"

**Specialist** — "dentro do meu domínio, qual plano e quais ações?"

```
Operational Supervisor
        ↓ (enfileira missão COORDINATE)
Opera CEO
        ↓ (delega por Specialization)
Specialist Employee
        ↓ (plano)
Execution Engine
```

O Supervisor alimenta a Opera; a Opera governa a missão; o especialista entrega domínio. Nenhum substitui o outro.

---

## 5. Responsabilidade Operacional Contínua

O Supervisor existe para garantir **continuidade operacional**:

- workspaces ACTIVE não ficam órfãos sem acompanhamento;
- pendências sem missão aberta geram ciclo de atenção;
- capacidade saturada evita enqueue excessivo (throttle);
- missões órfãs / stale podem ser recuperadas no start do runtime;
- insights de portfolio são injetados no contexto da Opera.

### Ciclo de vida do ContinuousRuntime

```
Production Readiness
        ↓
Recovery (stale / waiting / DAG)
        ↓
Workers start
        ↓
Scheduler start (ticks periódicos)
        ↓
Snapshot contínuo do estado
```

A responsabilidade é **manter o sistema operando** — não **definir o que a empresa deve ser**.

---

## 6. Ciclo de Supervisão

Ciclo oficial de supervisão operacional:

```
verificar estado do workspace
↓
analisar pendências
↓
identificar missões necessárias
↓
iniciar ciclos operacionais
↓
registrar execução
↓
aguardar próximo ciclo
```

### 1. Verificar estado do workspace

Construir snapshot de portfolio (`buildWorkspacePortfolioSnapshot`): projetos ativos, tarefas pendentes, missões abertas, capacidade e health.

### 2. Analisar pendências

Improvement Engine observa portfolio, profundidade da fila, aprendizados e aprovações pendentes — gera **insights**, não decisões.

### 3. Identificar missões necessárias

Exemplos de gatilhos:

- portfolio ACTIVE requer `COORDINATE` de acompanhamento;
- projeto ACTIVE sem missão aberta e com pendências;
- regras de schedule recorrentes (`ScheduleRule`) vencidas.

### 4. Iniciar ciclos operacionais

Enqueue na `MissionQueue` com `ownerEmployeeId` = Opera CEO. Objetivo inclui âncora de portfolio e insights — a Opera recebe contexto preparado, não uma ordem de execução técnica.

### 5. Registrar execução

Workers consomem a fila; `QueuedMissionExecutor` executa fases da missão, persiste memória/aprendizado e atualiza estado da fila. O Supervisor observa via logs, depths, readiness e snapshot.

### 6. Aguardar próximo ciclo

Após o tick, o scheduler aguarda `schedulerIntervalMs` e repete. Se capacidade estiver saturada, adia novo `COORDINATE`.

```
MissionScheduler.tick()
  → Snapshot → Health → Insights
  → enqueue (se necessário)
  → log do ciclo
  → wait(interval)
```

Comentário canônico do scheduler: **não decide — só inicia o ciclo e alimenta a Opera com Insights**.

---

## 7. Relação com Mission Orchestrator

| Operational Supervisor | Mission Orchestrator |
|---|---|
| Decide *quando* iniciar um ciclo | Coordena *como* a missão flui |
| Enfileira objetivos para a Opera | CEO → delegação → plano → execução → consolidação |
| Opera em loop contínuo (timer) | Opera por missão (request/queue item) |

O Supervisor **não substitui** o Mission Orchestrator. Ele **alimenta** a fila/contexto a partir do qual o orquestrador (via `QueuedMissionExecutor` / `MissionOrchestrator`) executa o fluxo oficial de missão.

```
Supervisor (quando)
        ↓
Mission Queue
        ↓
Orchestrator / Executor (como)
        ↓
CEO + Specialists + Engine
```

---

## 8. Relação com Digital Office

O Digital Office é a camada organizacional. O Operational Supervisor é a camada de **continuidade** sobre esse escritório.

- usa `DigitalOffice` (registry, runner, matcher, delegation) via workers/executor;
- observa workspaces através de `WorkspaceSource` e repositórios de projeto/tarefa;
- não redefine composição da equipe — apenas inicia trabalho para a equipe já composta.

Sem Digital Office, não há equipe para ativar. Sem Supervisor, o escritório só opera quando o humano dispara missões manualmente.

```
Digital Office (composição)
        ↓
Operational Supervisor (continuidade)
        ↓
Missões → Funcionários → Resultados
```

---

## 9. Relação com Memory System

O Supervisor **não grava memória como Employee**. A integração ocorre no ciclo de execução das missões que ele inicia:

| Momento | Papel da memória |
|---|---|
| Antes da missão | `loadMissionMemoryNotes` + learning notes no contexto da Opera |
| Depois da missão | `persistMissionMemory` / `recordMissionLearning` |

O Supervisor usa contagens e sinais (ex.: `learningCount`) como input do Improvement Engine — observação, não interpretação estratégica.

Memória informa o CEO na missão. O Supervisor apenas garante que missões contínuas existam para consumir e alimentar essa memória.

---

## 10. Limites de Atuação

Limites arquiteturais obrigatórios do Operational Supervisor:

### Não toma decisões estratégicas

Não prioriza produto, não escolhe roadmap, não define visão. Pode enfileirar "acompanhar / priorizar workspace" — a Opera decide o conteúdo estratégico da resposta.

### Não substitui o CEO

Missões contínuas têm a Opera como owner (`CEO_EMPLOYEE_ID`). O Supervisor inicia; a Opera analisa, delega e consolida.

### Não cria regras de negócio

Não altera políticas de domínio, contratos de employee, especializações ou limites de especialistas. Improvement Engine gera insights; Governance trata mudanças estruturais sob processo próprio — fora do papel de "decidir como o negócio opera".

### Limites adicionais

- não executa ações do Execution Engine diretamente;
- não chama specialists por nome;
- não contorna Mission Queue / Orchestrator;
- não opera sem Production Readiness quando workers estão habilitados.

```
Permitido                         Proibido
─────────                         ────────
Observar portfolio                Decidir estratégia
Gerar insights                    Substituir Opera
Enfileirar COORDINATE             Delegar a especialistas
Throttle por capacidade           Inventar regras de domínio
Recuperar missões órfãs           Executar infraestrutura de negócio
```

---

## 11. Regras Arquiteturais

- o Operational Supervisor é runtime contínuo, **não** Employee;
- autoridade estratégica permanece no Opera CEO e na supervisão humana;
- missões iniciadas pelo Supervisor seguem o mesmo fluxo auditável de qualquer missão;
- insights observam — não mandam;
- composição do Digital Office e contratos do Employee Framework permanecem intactos;
- mudanças no papel do Supervisor devem ser documentadas neste Handbook antes da implementação.

---

> **Referências:** [03 — Mission Orchestration](./03-mission-orchestration.md) · [06 — Digital Office](./06-digital-office.md) · [05 — Memory System](./05-memory-system.md) · [02 — Agent System](./02-agent-system.md)
