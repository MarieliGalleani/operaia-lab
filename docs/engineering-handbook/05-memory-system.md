# 05 — Memory System

> Parte 6 do [OperaIA Engineering Handbook](./README.md)

Este documento registra oficialmente o sistema de **memória operacional** do OperaIA.lab — seu papel na continuidade das operações digitais, contratos, ciclo de integração e regras arquiteturais.

---

## 1. Visão Geral

Memória no OperaIA.lab **não é apenas armazenamento de histórico**. Ela representa **conhecimento operacional acumulado** que permite ao sistema operar com continuidade entre missões, workspaces e ciclos de decisão.

### O que a memória acumula

| Dimensão | Conteúdo |
|---|---|
| **decisões** | Escolhas estratégicas e operacionais produzidas por CEO e especialistas |
| **resultados** | Outputs consolidados, resumos utilizáveis e status de execução |
| **contexto** | Estado do workspace, objetivo da missão e notas relevantes |
| **aprendizados** | Lições organizacionais, critérios de reuso e riscos observados |
| **estado das missões** | Identidade da missão, vínculo com workspace e tipo de registro |

### Continuidade operacional

Sem memória, cada missão seria uma sessão isolada. Com memória, o sistema recupera contexto anterior, injeta conhecimento no briefing atual e persiste resultados para ciclos futuros.

```
Missão N-1 (persistida)  →  Missão N (enriquecida)  →  Missão N+1 (alimentada)
```

A memória transforma o OperaIA.lab de um executor de pedidos pontuais em uma infraestrutura operacional com continuidade.

---

## 2. Papel da Memória na Arquitetura

A memória conecta **passado**, **presente** e **futuro** do ciclo operacional.

### Passado

Recupera o que já aconteceu:

- decisões anteriores;
- resultados de missões concluídas;
- contexto existente do workspace.

Consulta típica: `MemoryStore.search({ text: objective, filter: { workspaceId } })`.

### Presente

Alimenta a missão em andamento:

- análise da missão atual pelo Opera CEO;
- briefing dos funcionários via `memoryNotes` no `EmployeeContext`.

A memória enriquece o presente sem alterar a lógica de decisão dos agentes.

### Futuro

Prepara melhoria contínua:

- recuperação de conhecimento em missões seguintes;
- melhoria operacional (evitar repetição, reutilizar padrões, registrar lições).

```
Passado (search)  →  Presente (injection)  →  Futuro (store)
```

A memória é infraestrutura de continuidade — não substitui orquestração, runtime ou julgamento estratégico.

---

## 3. Package Memory

O pacote `packages/memory` define o **contrato** de memória operacional. Não acopla agentes a uma implementação concreta de persistência.

### Responsabilidades

- **contrato `MemoryStore`** — interface oficial de gravação e consulta;
- **abstração de persistência** — consumidores dependem do contrato, não do banco;
- **consulta de registros** — busca por texto, topK e filtros de metadata;
- **desacoplamento dos agentes** — employees não conhecem nem importam a implementação.

### Componentes

| Componente | Responsabilidade |
|---|---|
| **MemoryRecord** | Unidade de memória: `id`, `content`, `metadata` opcional, `embedding` opcional |
| **MemoryQuery** | Consulta: `text`, `topK`, `filter` (ex.: `workspaceId`) |
| **MemoryStore** | Porta: `store(record)` e `search(query)` → `MemorySearchResult[]` |

### Contrato

```typescript
interface MemoryStore {
  store(record: MemoryRecord): Promise<void>;
  search(query: MemoryQuery): Promise<readonly MemorySearchResult[]>;
}
```

### Desacoplamento

Agentes **não conhecem a implementação da memória**. O `EmployeeRunner` apenas injeta `memoryNotes` no briefing. A carga e a persistência ocorrem na camada de orquestração operacional (`OperationalMissionService`, `mission-memory`), via contrato `@operaia/memory`.

Implementações concretas (in-memory, PostgreSQL + pgvector) residem fora do pacote de contrato — substituíveis sem alterar CEO, especialistas ou framework.

---

## 4. Ciclo de Memória

O ciclo oficial de memória em uma missão operacional:

```
Antes da missão:
Context Retrieval
↓
Durante:
Context Injection
↓
Depois:
Memory Persistence
```

### Context Retrieval — Antes da missão

Antes da análise do CEO, o sistema recupera notas relevantes:

```
loadMissionMemoryNotes(memory, { workspaceId, objective })
```

A busca filtra por workspace e usa o objetivo como texto de consulta. O resultado é uma lista de conteúdos (`string[]`) — transporte puro, sem interpretação.

### Context Injection — Durante

As notas entram no `EmployeeContext.memoryNotes`. O `EmployeeRunner` injeta-as no `EmployeeBriefing` (`history` + `additional.memoryContext`).

CEO e especialistas recebem o contexto enriquecido **somente via briefing**. Nenhum funcionário chama `MemoryStore` diretamente.

### Memory Persistence — Depois

Ao concluir a missão, o resumo operacional é persistido:

```
persistMissionMemory(memory, { workspaceId, missionId, objective, summary })
```

Metadata típica:

```
workspaceId, missionId, kind: "operational-run-summary"
```

Aprendizados organizacionais podem complementar a persistência (`kind: "organizational-learning"`) com decisão, resultado, lição e critérios de reuso — sempre via contrato `MemoryStore`.

---

## 5. Integração com Opera CEO

A Opera consulta memória (indiretamente, via `memoryNotes` no contexto) para:

- **entender contexto** — o que já ocorreu no workspace antes do objetivo atual;
- **avaliar decisões anteriores** — padrões e resultados de missões passadas;
- **evitar repetição** — não reprocessar o mesmo diagnóstico sem necessidade;
- **melhorar consolidação** — integrar histórico na resposta executiva final.

### Limite de autoridade

A memória **auxilia decisão**, mas **não substitui o julgamento do CEO**.

- memória informa;
- Opera analisa, decide e consolida;
- CEO Gate e políticas de delegação permanecem soberanos.

Memória sem julgamento produz recuperação cega. Julgamento sem memória produz amnésia operacional. O sistema exige ambos — em camadas separadas.

---

## 6. Integração com Specialists

Especialistas recebem contexto operacional **através do briefing**.

### Regras de acesso

- **não acessam memória diretamente** — zero import de `MemoryStore` em pacotes de employees;
- **runtime controla o que é fornecido** — `EmployeeRunner` + `WorkspaceBriefingAdapter` montam o briefing;
- **contexto é filtrado por missão** — notas relevantes ao objetivo e workspace, não dump completo do store.

### Fluxo

```
MemoryStore.search()
        ↓
memoryNotes (EmployeeContext)
        ↓
EmployeeRunner.attachMemoryNotes()
        ↓
EmployeeBriefing
        ↓
Specialist EmployeeBrain.decide()
```

O especialista opera sobre o que o runtime entregou. Escopo de memória é responsabilidade da orquestração — não do domínio do funcionário.

---

## 7. Tipos de Memória

Categorias conceituais de memória operacional no OperaIA.lab:

| Tipo | Escopo | Uso |
|---|---|---|
| **Mission Memory** | Uma missão específica | Resumo do objetivo, resultado e `missionId` (`operational-run-summary`) |
| **Decision Memory** | Decisões tomadas | Registro de escolha, justificativa e consolidação do CEO |
| **Operational Memory** | Execução e gaps | Resultados de ações, auditoria de execução e lacunas observadas |
| **Workspace Memory** | Workspace ao longo do tempo | Contexto acumulado filtrável por `workspaceId` — continuidade entre missões |

### Mission Memory

Vinculada a um `missionId`. Captura o ciclo completo em forma recuperável — objetivo + resumo utilizável.

### Decision Memory

Preserva o *porquê* das escolhas. Essencial para auditoria e para evitar reprocessar a mesma análise sem novos dados.

### Operational Memory

Registra o *como* da execução: planos, resultados normalizados e gaps. Complementa o `OperationalRun` com conhecimento reutilizável.

### Workspace Memory

É a dimensão temporal do workspace. Missões sucessivas no mesmo workspace herdam contexto via filtro `{ workspaceId }`.

Na prática, o contrato unifica essas categorias em `MemoryRecord` + `metadata.kind`. A tipagem conceitual guia organização e consulta — não exige schemas separados no pacote de contrato.

---

## 8. Auditoria e Rastreamento

Memória operacional deve ser **rastreável**. Cada registro relevante carrega origem e vínculos.

### O que a memória registra

| Campo de rastreio | Descrição |
|---|---|
| **origem da informação** | `metadata.kind` (ex.: `operational-run-summary`, `organizational-learning`) |
| **missão relacionada** | `metadata.missionId` |
| **agente envolvido** | Indireto via `OperationalRun` / participantes da missão (CEO, especialistas) |
| **resultado produzido** | Conteúdo do registro (`content`) — resumo, decisão, lição |

### Por que importa

Sem origem rastreável, memória vira ruído. Com rastreamento:

- auditoria reconstrói o ciclo;
- consultas filtram por workspace e missão;
- aprendizado organizacional permanece atribuível.

A memória complementa o `OperationalRun` — não o substitui. O run é o artefato completo da missão; a memória é o conhecimento recuperável derivado dele.

---

## 9. Arquitetura Futura

O contrato `MemoryStore` foi desenhado para evolução sem quebrar consumidores. Visão arquitetural futura (sem implementação neste documento):

### Busca semântica

Consultas por similaridade de significado, não apenas match textual. `MemoryQuery.text` já é a entrada canônica para esse caminho.

### Embeddings

`MemoryRecord.embedding` já existe no contrato como campo opcional — preparado para vetores sem alterar a interface pública.

### RAG (Retrieval-Augmented Generation)

Pipeline: recuperar registros relevantes → injetar no briefing → gerar decisão com contexto factual. O fluxo atual (retrieval → injection → persistence) é a base estrutural do RAG operacional.

### PostgreSQL + pgvector

Implementação concreta candidata: persistência em PostgreSQL com índice vetorial (`pgvector`). A troca ocorre atrás de `MemoryStore` — CEO, specialists e runtime permanecem inalterados.

```
@operaia/memory (contrato estável)
        ↓
InMemoryMemoryStore (atual / testes)
        ↓
PostgresPgvectorMemoryStore (futuro)
```

Regra: implementar infra nova **sem alterar o contrato nem os consumidores**.

---

## 10. Regras Arquiteturais

### Agentes não gravam memória diretamente

Employees e brains não chamam `MemoryStore.store()`. Persistência ocorre na camada operacional (`persistMissionMemory`, `recordMissionLearning`) após consolidação da missão.

### Memória deve passar por contratos

Todo acesso usa `@operaia/memory` (`MemoryStore`). Nenhum módulo de domínio importa Prisma, filesystem ou cliente vetorial diretamente para memória operacional.

### Contexto deve respeitar limites

Notas injetadas no briefing respeitam escopo de missão e workspace (`filter`, `topK`). Dump completo do store no briefing viola isolamento e limites operacionais.

### Informações devem possuir origem rastreável

Todo registro persistido deve incluir metadata mínima (`workspaceId`, `missionId`, `kind`). Registros sem origem são rejeitados em revisão arquitetural.

### Memória não substitui decisões estratégicas

Recuperar contexto não é decidir. O Opera CEO permanece responsável por análise, delegação e consolidação. Memória informa — julgamento permanece humano-supervisionado e centrado no CEO.

---

> **Referências:** [03 — Mission Orchestration](./03-mission-orchestration.md) · [04 — Runtime and Execution](./04-runtime-and-execution.md) · [01 — Architecture](./01-architecture.md)
