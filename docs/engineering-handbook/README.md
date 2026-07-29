# OperaIA Engineering Handbook

Documentação técnica oficial do **OperaIA.lab**.

Este Handbook é a referência de engenharia do repositório. Ele define a arquitetura atual, os princípios técnicos, os limites de responsabilidade entre componentes e as regras para evolução do sistema.

O documento deve refletir somente capacidades existentes ou arquiteturas formalmente definidas. Funcionalidades futuras devem ser identificadas como evolução, não como implementação concluída.

---

# 1. Visão Geral

## Objetivo do OperaIA.lab

O **OperaIA.lab** é uma plataforma de **Digital Office** baseada em agentes digitais.

Seu objetivo é criar uma estrutura operacional capaz de:

- receber objetivos;
- analisar contexto;
- delegar responsabilidades;
- executar ações controladas;
- registrar resultados;
- manter rastreabilidade operacional.

O OperaIA.lab não é uma coleção de chatbots independentes.

A arquitetura utiliza:

- Modular Monolith;
- Runtime de Employees;
- Mission Orchestration;
- LLM Infrastructure;
- Workspace Context;
- Execução controlada.

---

# 2. Conceito de Digital Office

O Digital Office representa uma organização operacional composta por:

## Workspace

Contexto de trabalho contendo:

- projeto;
- informações operacionais;
- tarefas;
- histórico;
- estado atual.

## Employees

Funcionários digitais com:

- identidade;
- papel;
- especialização;
- capabilities;
- limites de atuação.

## Missions

Unidades operacionais que transformam objetivos em ciclos executáveis.

Fluxo conceitual:

Workspace
↓
Mission
↓
Employee
↓
Execution
↓
Result


---

# 3. Princípios de Engenharia

## Modular Monolith

O padrão arquitetural principal é um monorepo modular utilizando fronteiras claras entre domínios.

Características:

- módulos independentes;
- contratos explícitos;
- baixo acoplamento;
- evolução incremental.

---

## TypeScript como linguagem principal

O código utiliza TypeScript como linguagem principal.

Preferências:

- contratos tipados;
- interfaces claras;
- validações explícitas;
- redução de acoplamento.

---

## Organização por packages

Responsabilidades devem permanecer separadas.

Estrutura:
apps/
packages/


Apps representam aplicações finais.

Packages representam capacidades reutilizáveis e domínios internos.

---

## Código orientado a domínio

Cada domínio deve possuir responsabilidades claras.

Evitar:

- lógica de negócio espalhada;
- dependência direta entre camadas;
- regras críticas dentro de controllers.

---

## Mudanças pequenas e rastreáveis

Toda alteração deve:

- possuir objetivo claro;
- ser testável;
- manter histórico compreensível.

---

## Documentação antes de grandes mudanças

Alterações arquiteturais importantes devem possuir documentação antes ou durante sua implementação.

Decisões relevantes devem ser registradas em ADRs.

---

# 4. Arquitetura Atual

Estrutura principal:
operaia-lab/

apps/
├── api/
└── web/

packages/
├── shared/
├── database/
├── ai-core/
├── agents/
├── memory/
├── agent-runtime/
├── workspace-runtime/
├── employee-framework/
├── employee-runtime/
├── execution-engine/
├── orchestration-engine/
└── employees/


---

# 5. Componentes Principais

## API

Local:
apps/api


Responsabilidade:

- composition root;
- exposição HTTP;
- integração dos módulos;
- execução operacional do Digital Office.

---

## Database

Local:
packages/database


Responsabilidade:

- Prisma;
- schema;
- migrations;
- acesso persistente.

---

## AI Core

Local:
packages/database

Responsabilidade:

- Prisma;
- schema;
- migrations;
- acesso persistente.

---

## AI Core

Local: 
packages/ai-core


Responsabilidade:

- contratos LLM;
- providers;
- Gemini;
- fallback;
- policies;
- observabilidade.

---

## Employee Framework

Local:
packages/employee-framework


Responsabilidade:

- contratos de Employees;
- registry;
- lifecycle;
- capabilities.

---

## Employee Runtime

Local:
packages/employee-runtime


Responsabilidade:

- ativação;
- briefing;
- delegação;
- resolução de employees.

---

## Mission System

**Fonte oficial:** `MissionQueue` ([ADR-007](../architecture/adr/ADR-007-mission-system-consolidation.md)).

Responsabilidade: transformar objetivos em ciclos operacionais persistidos e auditáveis.

Componentes oficiais:

- Mission (Prisma / fila);
- Mission Queue;
- QueuedMissionExecutor + Workers;
- Execution Plan / Actions / Executors;
- Memory (+ Learning).

**Assisted Execution** (`MissionOrchestrator` + `OperationalRun` sync) é **legado temporário** (kill-switch `ASSISTED_QUEUE_MODE=false`). Caminho oficial: Mission Queue (`ASSISTED_QUEUE_MODE=true`, default).

Fluxo oficial:

```
COORDINATE → Opera → Delegation → Matcher → EXECUTE → CONSOLIDATE → Execution → Memory
```


---

# 6. Employee Framework

## O que é um Employee

Um Employee é uma unidade operacional digital.

Possui:

- identidade;
- função;
- capabilities;
- limites;
- contrato de execução.

Um Employee não deve conhecer diretamente:

- HTTP;
- banco;
- detalhes de infraestrutura.

Ele recebe contexto e produz decisões estruturadas.

---

# Employees atuais

## Opera

Função:

CEO / Management

Responsabilidade:

- análise;
- coordenação;
- decisões estratégicas.

---

## Mag

Função:

CTO / Software Engineering

Responsabilidade:

- análise técnica;
- planejamento de engenharia;
- decisões dentro do domínio técnico.

---

Outros Employees existem no roster e representam futuras especializações executáveis.

---

# 7. Agent Runtime

O Agent Runtime é responsável pela execução base dos agentes.

Responsabilidades:

- carregar agente;
- preparar contexto;
- executar processamento;
- integrar LLM;
- registrar resultado.

Fluxo:
Context
↓
Agent
↓
LLM
↓
Response
↓
Execution Result


---

# 8. LLM Architecture

Camada:
packages/ai-core


Responsabilidades:

## Provider

Contrato abstrato para modelos de linguagem.

## Gemini

Provider atualmente integrado.

## Fallback

Permite recuperação quando um provider falha.

## Policies

Controle técnico de execução:

- validações;
- limites;
- segurança operacional.

## Observabilidade

Registro de:

- chamadas;
- erros;
- uso;
- métricas.

---

# 9. Regras Operacionais

## Agentes não alteram arquitetura sem aprovação

Mudanças estruturais precisam ser documentadas e aprovadas.

---

## Decisões estratégicas pertencem à Opera

Outros componentes:

- Supervisor;
- Runtime;
- Matcher;
- Engines;

não tomam decisões estratégicas.

---

## Código precisa passar pelos testes

Toda alteração deve manter a qualidade do sistema.

---

## Mudanças precisam ser documentadas

Novas capacidades ou mudanças arquiteturais devem atualizar:

- Handbook;
- ADRs;
- documentação relacionada.

---

# 10. Development Workflow

Fluxo padrão:
Alteração
↓
Teste
↓
Review
↓
Commit
↓
Deploy


Práticas:

- commits pequenos;
- não versionar segredos;
- manter testes funcionando;
- documentar mudanças relevantes.

---

# 11. Evolução Planejada

Próximas evoluções:

## Operational Supervisor

Arquitetura definida para supervisão contínua da operação.

Objetivo:

- observar estado do sistema;
- identificar necessidade de coordenação;
- iniciar ciclos operacionais.

O Supervisor não substitui a Opera e não toma decisões estratégicas.

---

## Memory System Evolution

Evolução da capacidade de:

- armazenar contexto;
- recuperar informações;
- melhorar ciclos operacionais.

---

## Human Approval Workflow

Fluxo formal para aprovação humana antes de:

- mudanças estruturais;
- alterações críticas;
- decisões sensíveis.

---

## Novos Employees Executáveis

Evolução do roster atual para funcionários digitais com:

- runtime próprio;
- capabilities;
- execução real.

---

# Estado Atual Documentado

Capacidades existentes:

- Modular Monolith;
- Employee Framework;
- Opera CEO;
- Mag CTO;
- Mission System;
- Mission Queue;
- Execution Engine;
- Agent Runtime;
- LLM Stack;
- Digital Office API;
- Workspace Runtime.

---

# Referências oficiais

| Documento | Papel |
|-----------|--------|
| Este Handbook | **Como o sistema funciona hoje** |
| [Plano Diretor](../architecture/plano-diretor-operaia-lab.md) | **Para onde vamos** — fases, critérios, prioridades e definição de pronto |
| [Operational Cycle Proof](../architecture/operational-cycle-proof.md) | Prova de que a Mission Queue é o coração operacional (Fase 3 DoD) |
| [Operational Resilience Proof](../architecture/operational-resilience-proof.md) | Prova de recovery/dedupe/reclaim sob falha operacional |
| [Operational Memory Continuity Proof](../architecture/operational-memory-continuity-proof.md) | Prova de continuidade M1 após restart (briefing) |
| [Domain Signal Layer](../architecture/domain-signal-layer.md) | Arquitetura de sinais externos — S1+S2 no código |
| [GitHub Signal Contract S3.0](../architecture/github-signal-contract.md) | Contrato de domínio GitHub — Bridge ainda não |
| [ADR-009](../architecture/adr/ADR-009-domain-signal-layer.md) | Decisão formal: Domain Signal Layer |
| [ADRs](../architecture/adr/) | Decisões arquiteturais vinculantes |

---

**OperaIA Engineering Handbook**

Referência oficial de engenharia do OperaIA.lab.