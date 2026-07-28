# 02 — Agent System

> Parte 3 do [OperaIA Engineering Handbook](./README.md)

Este documento registra oficialmente o sistema de agentes e funcionários digitais do **OperaIA.lab**: seu modelo conceitual, contratos, papéis, fluxo de delegação e regras para extensão.

---

## 1. Visão Geral

O OperaIA.lab não utiliza agentes isolados. O sistema é organizado como uma **organização operacional digital**, onde cada participante possui identidade, papel e limites definidos — funcionando de forma coordenada sob orquestração central.

Agentes genéricos respondem a prompts. Funcionários digitais **executam missões** dentro de um fluxo com análise, delegação, execução e consolidação auditável.

### Conceitos fundamentais

| Conceito | Definição |
|---|---|
| **Agent** | Entidade autônoma capaz de processar contexto e produzir decisões. No OperaIA.lab, agentes são implementados como funcionários digitais com contratos formais. |
| **Employee** | Funcionário digital com identidade, perfil, especialização e limites explícitos. É a unidade operacional do sistema — não um chatbot genérico. |
| **Runtime** | Camada que ativa funcionários, resolve delegações e mapeia tarefas em ações executáveis. Funcionários não se comunicam diretamente; o runtime media toda interação. |
| **Human Supervisor** | Usuário humano que define objetivos, acompanha missões e mantém supervisão sobre decisões estratégicas. O sistema automatiza operação; a supervisão humana permanece nos pontos críticos. |

### Atributos de um agente

Todo funcionário digital no OperaIA.lab possui:

- **identidade** — quem é (`id`, `name`);
- **papel** — função na organização (`role`, `mission`);
- **especialização** — domínio de atuação (`Specialization`);
- **capacidades** — o que pode fazer (`capabilities`, `permissions`);
- **limites** — o que não pode fazer (`limits`).

Esses atributos são declarativos, definidos no `EmployeeProfile` e validados pelo framework antes de qualquer execução.

---

## 2. Modelo de Funcionário Digital

Um funcionário digital é composto por oito componentes estruturais:

### Identity

Identificador único e nome do funcionário. A identidade é imutável em runtime e serve como chave de registro no `EmployeeRegistry`.

```
id: "luna"
name: "Luna"
```

### Profile

Documento declarativo que consolida todos os metadados do funcionário. É a fonte única da verdade sobre quem o funcionário é e como opera.

Definido em `EmployeeProfile` — dados puros, sem lógica de execução.

### Role

Função organizacional do funcionário dentro da equipe digital.

Exemplos: `CEO`, `CTO`, `Product Designer`, `Especialista`.

### Specialization

Rótulo de domínio que classifica a área de atuação. Funcionários informam especialidades necessárias; nunca escolhem outros funcionários por nome.

Valores definidos no enum `Specialization` (ex.: `MANAGEMENT`, `SOFTWARE_ENGINEERING`, `PRODUCT_DESIGN`, `OPERATIONS`).

### Capabilities

Lista declarada de ações que o funcionário pode realizar dentro de seu domínio.

Exemplo:

```
capabilities: [
  "analisar jornadas e usabilidade",
  "propor plano de design",
  "identificar riscos de UX",
]
```

### Policies

Conjunto de regras que governam o comportamento do funcionário em runtime:

- **DelegationPolicy** — quando e como delegar;
- **ResponsePolicy** — formato e qualidade das respostas;
- **QualityPolicy** — critérios de validação de output.

Políticas padrão são fornecidas pelo framework; funcionários podem sobrescrevê-las via `EmployeePolicies`.

### Context

Informações operacionais disponíveis ao funcionário durante a execução. Adaptadas do workspace para o funcionário via `EmployeeBriefing` — um snapshot estruturado do estado atual da missão.

### Execution boundaries

Limites explícitos que definem o que o funcionário **não pode** fazer. São restrições arquiteturais, não sugestões.

Exemplo do Opera CEO:

```
limits: [
  "nao escreve codigo",
  "nao cria telas",
  "nao executa automacoes",
]
```

### Módulos independentes

Cada funcionário é um pacote autônomo em `packages/employees/{employee-name}`. O pacote encapsula perfil, brain e exports — sem dependência de outros funcionários. A composição da equipe ocorre externamente, via `EmployeeRegistry`.

---

## 3. Employee Framework

O pacote `packages/employee-framework` define os contratos fundamentais do sistema de funcionários digitais. É a fundação sobre a qual todos os employees são construídos.

### Contratos principais

| Contrato | Responsabilidade |
|---|---|
| **Employee** | Interface unificada de qualquer funcionário digital. Expõe `profile` e método `work(input)` que orquestra briefing → decisão → output. |
| **EmployeeBrain** | Cérebro de especialização. A única coisa que um novo funcionário implementa: recebe `EmployeeBriefing` e devolve `EmployeeDecision`. |
| **EmployeeProfile** | Perfil declarativo com identidade, papel, especialização, capacidades, permissões, limites e regras de qualidade. |
| **EmployeeRegistry** | Registro central de funcionários disponíveis. Armazena, lista e resolve entradas por `id`. Fonte oficial dos employees ativos. |
| **EmployeeFactory** | Fábrica que compõe um `Employee` completo a partir de um `EmployeeBlueprint` (perfil + builder do brain) e dependências de runtime. |

### Fluxo de composição

```
EmployeeBlueprint (profile + build)
        ↓
defineEmployee() → RegisteredEmployee
        ↓
EmployeeRegistry.register()
        ↓
EmployeeFactory.create() → Employee
```

### Regra de extensão

Novos funcionários **devem** seguir esses contratos. Criar um funcionário significa:

1. definir um `EmployeeProfile`;
2. implementar um `EmployeeBrain`;
3. registrar via `defineEmployee()`;
4. adicionar ao roster da equipe digital.

Não se escreve infraestrutura — apenas perfil + brain.

---

## 4. Opera CEO

O **Opera** é o agente central do OperaIA.lab. Implementado em `packages/agents` como `operaia-ceo`, opera com especialização `MANAGEMENT`.

### Responsabilidades

- **receber objetivos** — interpretar a intenção do usuário e o estado do workspace;
- **analisar contexto** — avaliar tarefas, prioridades e restrições operacionais;
- **decidir delegação** — determinar se a missão requer um especialista e qual especialização;
- **escolher especialista** — informar a especialidade necessária para resolução via `EmployeeMatcher`;
- **consolidar resultado final** — integrar output do especialista em resposta executiva para o usuário.

### O que Opera não faz

Opera **não executa tarefas técnicas especializadas**. Seus limites explícitos incluem:

- não escreve código;
- não cria telas;
- não executa automações.

Opera **coordena**. Analisa, delega e consolida — o trabalho especializado é responsabilidade dos funcionários de domínio.

---

## 5. Specialist Employees

Especialistas são funcionários digitais com domínio de atuação definido. Executam o trabalho concreto delegado pelo Opera CEO dentro de seus limites operacionais.

### Princípios de operação

**Especialistas não conversam diretamente entre si.** Não há comunicação peer-to-peer entre pacotes de funcionários. Toda coordenação passa pelo runtime e pela orquestração de missões.

**Recebem missões através da orquestração.** O fluxo é: CEO decide delegação → `EmployeeMatcher` resolve especialidade → `EmployeeRunner` ativa o especialista com briefing adaptado.

**Retornam planos e resultados.** O especialista produz `EmployeeDecision` contendo plano de execução, tarefas e recomendações — nunca executa fora de seus limites declarados.

**Possuem limites próprios.** Cada especialista define explicitamente o que não pode fazer. Limites são validados pelo framework e respeitados pelo runtime de execução.

### Exemplo de especialista

```
Luna (Product Designer)
├── specialization: PRODUCT_DESIGN
├── capabilities: análise de UX, plano de design, riscos
└── limits: não escolhe outros funcionários, não decide fora do design
```

---

## 6. Employee Registry

O `EmployeeRegistry` é o catálogo oficial de funcionários ativos no sistema. Funcionários entram no sistema exclusivamente através de registro — nunca por importação direta entre pacotes.

### Registro

Cada funcionário é registrado como `RegisteredEmployee` via `defineEmployee(blueprint)`:

```typescript
export const lunaRegisteredEmployee: RegisteredEmployee =
  defineEmployee(lunaBlueprint);
```

O roster da equipe digital (`packages/employees/digital-team`) consolida todas as entradas e preenche o registry via `registerDigitalTeam()`.

### Identificação

Cada entrada possui `profile.id` único. O registry rejeita registros duplicados com `EmployeeAlreadyRegisteredError`.

### Capabilities

Capacidades são declaradas no `EmployeeProfile.capabilities` e `EmployeeProfile.permissions`. São metadados de descoberta — usados para documentação, matching e validação de políticas.

### Specialization

A especialização é o critério primário de resolução. O `EmployeeMatcher` consulta o registry filtrando por `profile.specialization` — nunca por nome ou id de outro funcionário.

### Status operacional

Um funcionário está **ativo** quando registrado no `EmployeeRegistry` e presente no roster `DIGITAL_TEAM_EMPLOYEES`. Funcionários não registrados são invisíveis para orquestração e delegação.

Contratar um novo funcionário = criar pacote + adicionar **uma entrada** ao roster. Matcher, Orchestrator e Framework não mudam.

---

## 7. Funcionários Atuais

Equipe digital validada e operacional:

| Employee | Papel | Responsabilidade |
|---|---|---|
| Opera | CEO | Estratégia e consolidação |
| Mag | CTO | Engenharia e arquitetura |
| Luna | UX/Product | Experiência e produto |
| Atlas | Especialista | Domínio operacional |
| Aurora | Especialista | Domínio operacional |
| Nexus | Especialista | Domínio operacional |
| Themis | Especialista | Domínio operacional |
| Mercúrio | Especialista | Domínio operacional |
| Orion | Especialista | Domínio operacional |

---

## 8. Fluxo de Delegação

O fluxo oficial de delegação de missões no OperaIA.lab:

```
User Objective
↓
Opera CEO Analysis
↓
Delegation Decision
↓
Employee Matcher
↓
Specialist Employee
↓
Execution Plan
↓
CEO Consolidation
```

### User Objective

O usuário define o objetivo operacional. Pode ser uma tarefa, uma análise ou uma missão complexa.

### Opera CEO Analysis

Opera recebe o objetivo junto com o snapshot do workspace. Analisa contexto, prioridades e complexidade.

### Delegation Decision

Opera decide se a missão pode ser resolvida diretamente (dentro de seus limites de gestão) ou se requer delegação a um especialista. Em caso de delegação, informa a `Specialization` necessária — nunca o nome de um funcionário.

### Employee Matcher

O `EmployeeMatcher` consulta o `EmployeeRegistry` e resolve a especialidade para o primeiro funcionário compatível. A resolução de "quem executa" vive fora do domínio dos funcionários.

### Specialist Employee

O especialista é ativado via `EmployeeRunner` com briefing adaptado. Seu `EmployeeBrain` processa o contexto e produz `EmployeeDecision` com plano de execução.

### Execution Plan

O plano é mapeado em ações concretas pelo `EmployeeActionMapper` e executado pelo Execution Engine dentro dos limites do especialista.

### CEO Consolidation

Opera recebe o resultado da execução, integra com o contexto original e produz resposta consolidada em linguagem executiva para o usuário.

---

## 9. Regras para Novos Employees

### Package independente

Cada funcionário deve ser um pacote independente em `packages/employees/{employee-name}`. Estrutura mínima:

```
packages/employees/{employee-name}/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── profile.ts
    └── {name}-brain.ts
```

### Sem importação direta entre employees

Funcionários **não importam** outros pacotes de `packages/employees/*`. Dependências permitidas: `@operaia/employee-framework`, `@operaia/ai-core`, `@operaia/shared`.

### Comunicação somente via runtime

Interação entre funcionários ocorre exclusivamente através de orquestração e delegação mediada pelo runtime. Não há chamadas diretas entre brains ou pacotes de funcionários.

### Capacidades declaradas

Toda capacidade deve estar explicitamente listada em `EmployeeProfile.capabilities` e `EmployeeProfile.permissions`. Capacidades implícitas ou não documentadas violam o contrato do framework.

### Limites explícitos

Todo funcionário deve declarar `EmployeeProfile.limits`. Limites são obrigatórios — definem as fronteiras de execução e protegem o sistema contra atuação fora de domínio.

### Mudanças no framework exigem decisão arquitetural

Alterações em `@operaia/employee-framework` impactam todos os funcionários existentes e futuros. Qualquer mudança nos contratos (`Employee`, `EmployeeBrain`, `EmployeeProfile`, `Registry`, `Factory`) deve ser documentada neste Handbook antes da implementação.

---

> **Referências:** [01 — Architecture](./01-architecture.md) · [README — Core Philosophy](./README.md#2-core-philosophy)
