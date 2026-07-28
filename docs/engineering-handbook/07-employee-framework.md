# 07 — Employee Framework

> Parte 8 do [OperaIA Engineering Handbook](./README.md)

Este documento registra oficialmente o **Employee Framework** do OperaIA.lab — a fundação contratual sobre a qual todos os funcionários digitais são criados, registrados, ativados e executados.

---

## 1. Visão Geral

O **Employee Framework** (`packages/employee-framework`, `@operaia/employee-framework`) é a base de todos os funcionários digitais do OperaIA.lab.

Depois desta base, nenhum funcionário é criado do zero. Cada novo colaborador **especializa** o framework: declara um perfil, implementa um brain e registra um blueprint. Criar um funcionário vira **configuração**, não desenvolvimento de infraestrutura.

### Objetivo do framework

- eliminar duplicação entre funcionários;
- padronizar contrato, briefing, decisão, qualidade e resposta;
- permitir dezenas de funcionários com o mínimo de código;
- manter funcionários **puros** — apenas domínio de negócio, nunca infraestrutura.

### Princípio central

Todo funcionário:

- trabalha **exclusivamente** sobre um `EmployeeBriefing`;
- **não** conhece banco, Runtime, Execution Engine, Orchestration ou ferramentas;
- produz `EmployeeDecision` no modelo comum;
- informa especialidade ao delegar — nunca escolhe outro funcionário por nome.

---

## 2. Conceito de Funcionário Digital

Um **funcionário digital** é a unidade operacional do OperaIA.lab. Não é um chatbot genérico nem um prompt solto — é um colaborador com identidade, papel, especialização, capacidades e limites explícitos.

### Atributos obrigatórios

| Atributo | Fonte | Descrição |
|---|---|---|
| **Identity** | `EmployeeProfile.id`, `name` | Quem é o funcionário |
| **Role** | `role`, `mission` | Função organizacional e propósito |
| **Specialization** | `specialization` | Domínio de atuação (`Specialization`) |
| **Capabilities** | `capabilities`, `permissions` | O que pode fazer |
| **Limits** | `limits` | O que não pode fazer |
| **Quality rules** | `qualityRules` | Critérios de qualidade da entrega |

### O que um funcionário faz

Recebe briefing → decide → opcionalmente solicita especialidade → produz relatório e resultado de qualidade.

### O que um funcionário não faz

- não executa infraestrutura;
- não chama outros employees diretamente;
- não monta `Action` do Execution Engine;
- não grava memória;
- não conhece HTTP, Prisma ou providers concretos além das deps injetadas no brain (ex.: `LLMProvider`).

---

## 3. Agente, Funcionário e Runtime

| Conceito | Definição | Onde vive |
|---|---|---|
| **Agent** | Entidade capaz de processar contexto e produzir decisões. No OperaIA.lab, agentes de alto nível (ex.: Opera CEO) são implementados **como** funcionários digitais. | `packages/agents`, `packages/employees/*` |
| **Employee** | Contrato formal de funcionário digital: `profile` + `work(input)`. Unidade padronizada da organização digital. | `@operaia/employee-framework` |
| **Runtime** | Camada que ativa funcionários, adapta workspace → briefing, resolve delegações e traduz tarefas em ações. Media toda interação entre employees. | `@operaia/employee-runtime` |

### Diferença operacional

```
Agent (conceito amplo)
        ↓
Employee (contrato formal do framework)
        ↓
Runtime (ativação e mediação)
        ↓
Execution Engine (ações concretas)
```

- **Agent** descreve a ideia de autonomia cognitiva;
- **Employee** formaliza essa ideia em contrato auditável;
- **Runtime** prepara e ativa — sem decidir estratégia.

Sem framework, haveria prompts isolados. Com framework, há organização digital com fronteiras explícitas.

---

## 4. Responsabilidade do Package

### `packages/employee-framework`

Dependência permitida: apenas `@operaia/shared`.

### O package define

- contratos de funcionário (`Employee`, `EmployeeBrain`, `EmployeeProfile`);
- briefing e validação (`EmployeeBriefing`, `BriefingBuilder`, `validateBriefing`);
- modelo de decisão (`EmployeeDecision`, `DelegationRequest`);
- políticas (`DelegationPolicy`, `ResponsePolicy`, `QualityPolicy`) e defaults;
- factory e registry (`EmployeeFactory`, `EmployeeRegistry`, `defineEmployee`);
- especializações de domínio (`Specialization`);
- erros de domínio do framework.

### O package não define

- ativação em workspace (`employee-runtime`);
- execução de ações (`execution-engine`);
- orquestração de missões (`orchestration-engine` / `MissionOrchestrator`);
- implementação concreta de funcionários (CEO em `agents`, Mag e especialistas em `employees/*`);
- persistência ou memória.

O framework é **domínio puro de funcionários**. Infraestrutura e runtime ficam fora.

---

## 5. Contratos Principais

### Employee

Contrato unificado de qualquer funcionário digital:

```typescript
interface Employee {
  readonly profile: EmployeeProfile;
  work(input: EmployeeInput): Promise<EmployeeOutput>;
}
```

- `EmployeeInput` — `{ briefing: EmployeeBriefing }`;
- `EmployeeOutput` — `{ decision, report, quality }`.

A implementação reutilizável é `BaseEmployee`: aplica o pipeline padrão ao redor de um `EmployeeBrain`.

### EmployeeBrain

Cérebro de especialização — a **única** coisa que um novo funcionário implementa:

```typescript
interface EmployeeBrain {
  decide(briefing: EmployeeBriefing): Promise<EmployeeDecision>;
}
```

O brain recebe briefing e devolve decisão. Não valida briefing, não formata relatório, não aplica qualidade — isso é responsabilidade do `BaseEmployee` + políticas.

### EmployeeProfile

Perfil declarativo (dados puros):

```typescript
interface EmployeeProfile {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly mission: string;
  readonly specialization: Specialization;
  readonly capabilities: readonly string[];
  readonly permissions: readonly string[];
  readonly limits: readonly string[];
  readonly qualityRules: readonly string[];
  readonly version?: string;
}
```

Criar um funcionário = preencher este perfil + implementar um brain. Nunca escrever infraestrutura no pacote do employee.

### Pipeline interno (`BaseEmployee.work`)

```
EmployeeInput { briefing }
        ↓
validateBriefing
        ↓
brain.decide(briefing)     ← especialização
        ↓
delegationPolicy.resolve
        ↓
responsePolicy.build       → EmployeeReport
        ↓
qualityPolicy.validate     → QualityResult
        ↓
EmployeeOutput { decision, report, quality }
```

---

## 6. Registry e Factory

### EmployeeFactory

Instancia funcionários a partir de um `EmployeeBlueprint`:

```typescript
interface EmployeeBlueprint<TDeps = void> {
  readonly profile: EmployeeProfile;
  readonly build: (dependencies: TDeps) => EmployeeBrain;
  readonly responsePolicy?: ResponsePolicy;
  readonly qualityPolicy?: QualityPolicy;
  readonly delegationPolicy?: DelegationPolicy;
}
```

`EmployeeFactory.create(blueprint, deps)` monta um `BaseEmployee` com políticas padrão (ou sobrescritas). **Nenhum funcionário deve ser montado manualmente fora da factory.**

### EmployeeRegistry

Catálogo oficial de funcionários disponíveis. Apenas armazena e lista — sem lógica de negócio.

| Operação | Descrição |
|---|---|
| `register(entry)` | Adiciona `RegisteredEmployee` (rejeita id duplicado) |
| `get(id)` / `require(id)` | Resolve por identidade |
| `profiles()` | Lista perfis declarativos |
| `all()` | Lista entradas para matching/discovery |

### defineEmployee

Converte blueprint tipado em entrada registrável:

```
EmployeeBlueprint → defineEmployee() → RegisteredEmployee → Registry.register()
```

`RegisteredEmployee` expõe `profile` (descoberta) + `create(dependencies?)` (instanciação sob demanda).

### Roster oficial

O roster da equipe digital (`@operaia/digital-team`) consolida as entradas e preenche o registry via `registerDigitalTeam()`. Contratar = pacote do employee + **uma** entrada no roster. Matcher, Orchestrator e Framework não mudam.

---

## 7. Lifecycle de um Funcionário

Ciclo de vida oficial:

```
criação → registro → ativação → execução → resultado
```

### 1. Criação

Definir `EmployeeProfile` + `EmployeeBrain` + `EmployeeBlueprint` no pacote `packages/employees/{name}` (ou `packages/agents` para o CEO).

### 2. Registro

Exportar `defineEmployee(blueprint)` e adicionar ao roster `DIGITAL_TEAM_EMPLOYEES`. O composition root (`createDigitalOffice`) registra a equipe no `EmployeeRegistry`.

### 3. Ativação

O `EmployeeRunner` (`employee-runtime`) adapta workspace → briefing, injeta memória/delegação e chama `employee.work({ briefing })`.

### 4. Execução (domínio)

Dentro do framework: validar → decidir → resolver delegações → montar report → validar qualidade.

Delegações solicitadas saem do domínio do funcionário e são resolvidas pelo runtime (`DelegationService` + `EmployeeMatcher`). Ações concretas saem para o `execution-engine` via mapeamento na orquestração — **fora** do framework.

### 5. Resultado

`EmployeeResult` / `EmployeeOutput` retorna ao orquestrador. Opera consolida; memória e `OperationalRun` registram o ciclo.

```
Pacote employee
  → Registry
    → Runner.activate
      → BaseEmployee.work
        → Output
          → Orchestrator / CEO consolidation
```

---

## 8. Como Criar Novos Funcionários

### Estrutura mínima

```
packages/employees/{employee-name}/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts          # exports + RegisteredEmployee
    ├── profile.ts        # EmployeeProfile
    └── {name}-brain.ts   # EmployeeBrain (ou specialist-kit)
```

### Passos obrigatórios

1. **Perfil** — preencher `EmployeeProfile` com specialization, capabilities, permissions, limits e qualityRules.
2. **Brain** — implementar `EmployeeBrain.decide()` retornando `EmployeeDecision`.
3. **Blueprint** — `{ profile, build: (deps) => new Brain(deps) }`.
4. **Registro** — `defineEmployee(blueprint)` e entrada no roster `digital-team`.
5. **Dependências** — apenas `@operaia/employee-framework`, `@operaia/shared` e, se necessário, `@operaia/ai-core` / `@operaia/specialist-kit`.

### O que não fazer

- não importar outros pacotes de `packages/employees/*`;
- não acessar `MemoryStore`, Prisma ou Execution Engine;
- não escolher funcionários por nome em delegações;
- não reimplementar `BaseEmployee.work` — especializar o brain.

### Especialização via specialist-kit

Especialistas operacionais podem usar `@operaia/specialist-kit` (`defineSpecialistPackage`) para reduzir boilerplate, mantendo o mesmo contrato do framework.

---

## 9. Regras de Isolamento entre Employees

### Isolamento de pacote

Cada funcionário é um package independente. Comunicação peer-to-peer entre pacotes de employees é **proibida**.

### Isolamento de decisão

Funcionários nunca escolhem outros funcionários. Delegam apenas `Specialization` + motivo (`DelegationRequest`). A resolução de *quem* executa vive no `EmployeeMatcher`.

### Isolamento de infraestrutura

Employees não importam runtime, engine, orchestration ou database. Fronteiras:

| Permitido | Proibido |
|---|---|
| `@operaia/employee-framework` | `@operaia/employee-runtime` |
| `@operaia/shared` | `@operaia/execution-engine` |
| `@operaia/ai-core` (deps do brain) | `@operaia/database`, Prisma direto |
| `@operaia/specialist-kit` | import de outro employee |

### Isolamento de entrada

Única entrada de trabalho: `EmployeeBriefing`. Adaptação `Workspace → Briefing` ocorre no runtime (`WorkspaceBriefingAdapter` / `BriefingBuilder`), nunca dentro do funcionário.

### Isolamento de saída

Saída padronizada: `EmployeeDecision` + `EmployeeReport` + `QualityResult`. Tradução para `Action` / `ExecutionPlan` ocorre no `EmployeeActionMapper` (runtime) e na orquestração — fora do framework.

Violar isolamento acopla domínio a infraestrutura e impede evolução independente da equipe digital.

---

## 10. Relação com Runtime, Agents e Execution Engine

### `@operaia/employee-framework` (este documento)

Define **o que é** um funcionário e **como** ele decide. Domínio puro.

### `@operaia/employee-runtime`

Define **como ativar** o funcionário:

- `EmployeeRunner` — briefing + `work()`;
- `DelegationService` / `EmployeeMatcher` — resolve especialidades;
- `EmployeeActionMapper` — `EmployeeTask` → `Action`.

O runtime depende do framework. O framework **não** depende do runtime.

### `@operaia/agents`

Implementa o Opera CEO como employee do framework (`ceoBlueprint`, `CeoBrain`, `ceoRegisteredEmployee`). É um consumidor do framework — não um substituto.

### `@operaia/execution-engine`

Executa `ExecutionPlan` após o domínio ter decidido. Employees não conhecem o engine. A ponte é runtime + orquestração.

```
┌──────────────────────┐
│ employee-framework   │  contratos + BaseEmployee
└──────────┬───────────┘
           │ implementam
┌──────────▼───────────┐     ┌────────────────────┐
│ agents / employees/* │     │ employee-runtime   │
│ (CEO, Mag, specs)    │────►│ (ativa / delega)   │
└──────────────────────┘     └─────────┬──────────┘
                                       │ mapeia
                             ┌─────────▼──────────┐
                             │ execution-engine   │
                             │ (executa ações)    │
                             └────────────────────┘
```

### Direção de dependências

```
shared ← employee-framework ← agents / employees/*
                           ← employee-runtime ← apps/api
                           ← (indireto) execution via runtime/orquestração
```

Dependências apontam para o domínio. O framework permanece estável na base da pirâmide de funcionários.

---

## 11. Regras Arquiteturais

- todo funcionário implementa os contratos do framework;
- a especialização ocorre no `EmployeeBrain`, não no pipeline;
- montagem apenas via `EmployeeFactory` / `defineEmployee`;
- registro apenas via `EmployeeRegistry` + roster oficial;
- isolamento entre employees é obrigatório;
- mudanças nos contratos do framework exigem decisão documentada neste Handbook antes da implementação.

---

> **Referências:** [02 — Agent System](./02-agent-system.md) · [04 — Runtime and Execution](./04-runtime-and-execution.md) · [01 — Architecture](./01-architecture.md) · [03 — Mission Orchestration](./03-mission-orchestration.md)
