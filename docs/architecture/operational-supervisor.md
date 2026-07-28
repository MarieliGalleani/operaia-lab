# Operational Supervisor

Documento de arquitetura do **Operational Supervisor** no OperaIA.lab.

Define a natureza, os limites e o fluxo **desejados** do componente. Não descreve autonomia total nem garante que todos os mecanismos abaixo estejam implementados; detalhes de implementação e evolução operacional ficam no Handbook e no roadmap.

Complementa: [`docs/engineering-handbook/08-operational-supervisor.md`](../engineering-handbook/08-operational-supervisor.md).

---

## 1. Objetivo

### Por que o Supervisor existe

O Digital Office não pode depender apenas de pedidos humanos pontuais para permanecer em movimento. Workspaces acumulam pendências, missões entram em estados intermediários e a operação precisa de observação contínua.

O **Operational Supervisor** existe para manter **ciclos de operação contínuos**: observar o estado do escritório digital, identificar necessidade operacional e iniciar coordenação — **sem** assumir autoridade estratégica e **sem** substituir a Opera.

### Qual problema resolve

| Problema | Papel arquitetural do Supervisor |
|---|---|
| Escritório parado na ausência de input humano | Manter observação e ciclos operacionais recorrentes |
| Pendências / missões em estados intermediários | Observar sinais e, quando aplicável, iniciar coordenação |
| Falta de sinal para a Opera agir | Poder iniciar missão `COORDINATE` |
| Opacidade do estado operacional | Registrar observação e ciclos (logs / histórico) |

### Relação com o Digital Office

O Digital Office é composto por **Workspace**, **Missions** e **Employees**. O Supervisor é a camada de **infraestrutura operacional** que observa esse conjunto e pode disparar ciclos de coordenação para a **Opera** (CEO Employee). Ele **não** é Employee e **não** substitui a Opera.

```
Digital Office
├── Workspaces (contexto)
├── Missions (unidade operacional)
├── Employees (Opera + specialists)
└── Operational Supervisor (infraestrutura operacional — não é Employee)
```

---

## 2. Natureza do componente

### Definição

```
Supervisor = infraestrutura operacional
```

Camada de runtime/infra do Digital Office responsável por ciclos operacionais contínuos. **Não** implementa contratos do Employee Framework.

### Não é

| Não é | Motivo |
|---|---|
| **Employee** | Sem perfil, brain ou decisão de funcionário digital |
| **Agent** | Não processa briefing de domínio como agente cognitivo |
| **CEO** | Não analisa estratégia nem consolida resultado de negócio |
| **Especialista** | Não executa trabalho de domínio |

### Não substitui a Opera

A Opera permanece o CEO Employee: analisa, decide, prioriza no escopo da missão e delega. O Supervisor apenas observa e, quando necessário, inicia `COORDINATE` para que a Opera atue.

### Diferença entre Supervisor e Opera

| | Operational Supervisor | Opera (CEO Employee) |
|---|---|---|
| Natureza | Infraestrutura operacional | Employee de management |
| Entrada | Estado operacional | Objetivo + briefing de missão |
| Saída | Observação; possível `COORDINATE`; registro | Decisão estratégica, delegação, consolidação |
| Pode priorizar negócio? | Não | Sim (no escopo da missão) |
| Pode escolher specialist? | Não | Sim (via especialização / gate) |

```
Supervisor observa e pode iniciar coordenação
Opera decide e delega
Employees executam especialidade
```

---

## 3. Responsabilidades

Responsabilidades **permitidas** (modelo arquitetural):

1. **Observar estado operacional** — saúde e sinais do workspace, missões e fila/runtime, conforme integrações definidas.
2. **Identificar necessidade de coordenação** — reconhecer quando há atenção operacional que exige a Opera.
3. **Iniciar ciclos `COORDINATE`** — criar missão de coordenação destinada à Opera, com motivo operacional (não estratégico).
4. **Registrar execuções** — logs e histórico do ciclo de supervisão (observação, coordenação iniciada, desfecho do ciclo).

### Escopo explícito

| Supervisor | Opera / Employees |
|---|---|
| Observa | Decide estratégia |
| Identifica necessidade operacional | Define prioridades de negócio |
| Pode iniciar `COORDINATE` | Escolhe especialistas / especialização |
| Registra o ciclo de supervisão | Executa trabalho de domínio e consolida resultado |

---

## 4. Limites

O Supervisor **não**:

| Proibido | Justificativa |
|---|---|
| Toma decisões estratégicas | Pertence à Opera / oversight humano |
| Define prioridades de negócio | Priorização de portfólio/produto não é papel de infra |
| Escolhe especialistas | Matcher / Opera resolvem especialização |
| Substitui aprovação humana | Governança e Human Oversight fora do Supervisor |
| Executa trabalho de domínio | Specialists / engines de execução |
| Altera arquitetura | Exige aprovação e ADR |
| Interpreta objetivo de usuário como plano de domínio | Texto de `COORDINATE` é operacional; Opera interpreta |

Sem necessidade operacional identificada, o Supervisor **não** cria missão e **não** inventa prioridade ou âncora de portfólio.

---

## 5. Fluxo operacional

Fluxo arquitetural canônico:

```
Supervisor
 ↓
Observação
 ↓
Mission COORDINATE
 ↓
Opera analisa
 ↓
Delegação
 ↓
Employees executam
 ↓
Resultado registrado
```

### Leitura do fluxo

1. O Supervisor observa o estado operacional (inclui a identificação de necessidade, quando houver).
2. Havendo necessidade, inicia missão **`COORDINATE`** para a Opera.
3. A Opera analisa o contexto e decide.
4. Segue-se a **delegação** (especialização).
5. **Employees** executam o trabalho de domínio.
6. O **resultado** é registrado no fluxo operacional do Digital Office.

O Supervisor **não** participa da delegação nem da execução especializada. A etapa de observação engloba a detecção de necessidade; a criação de `COORDINATE` só ocorre quando essa necessidade existe.

---

## 6. Ciclo de execução

Modelo de ciclo (arquitetural — não implica automação completa nem autonomia total):

### Loop / scheduler

O Supervisor é pensado como serviço com **loop** ou **scheduler** recorrente:

```
observar → (opcional) iniciar COORDINATE → registrar → aguardar intervalo
```

A execução deve ser **controlada** (sem sobrepor ciclos de forma destrutiva; com start/stop claros quando implementado).

### Intervalos

Intervalos de observação são configuração operacional de infraestrutura, não política de prioridade de negócio.

### Logs e histórico

O modelo prevê:

- logs estruturados do ciclo de supervisão;
- histórico suficiente para rastrear observação e coordenações iniciadas.

Catálogos concretos de eventos, stores e limiares são detalhes de implementação / evolução — não requisito de autonomia total neste documento.

---

## 7. Integrações

Integrações **previstas** no modelo arquitetural (não todas precisam existir de forma completa em um dado momento):

| Integração | Papel esperado |
|---|---|
| **Workspace Runtime / fonte de workspaces** | Contexto para observação de workspaces |
| **Mission Queue** | Leitura de estado operacional; enqueue de `COORDINATE` |
| **Mission Orchestrator** | Continuidade do fluxo após `COORDINATE` (Opera em diante) |
| **Operational Runs** | Registro/auditoria do ciclo missão → resultado (pós-Opera) |
| **Observability** | Logs, métricas e diagnóstico do ciclo do Supervisor |

Planejamento de portfólio e escolha de prioridades **não** são integração do Supervisor; pertencem à Opera (e à supervisão humana quando aplicável).

---

## 8. Estados

Os estados abaixo formam um **modelo arquitetural** do ciclo do Supervisor. **Não** constituem, por si só, uma máquina de estados obrigatoriamente implementada no código.

| Estado | Significado no modelo |
|---|---|
| **IDLE** | Inativo ou entre ciclos |
| **OBSERVING** | Observando estado operacional |
| **COORDINATING** | Iniciando / enfileirando `COORDINATE` |
| **WAITING** | Aguardando intervalo ou continuidade do ciclo |
| **COMPLETED** | Ciclo de supervisão concluído com sucesso no modelo |
| **FAILED** | Ciclo de supervisão falhou no modelo (ex.: bloqueio operacional) |

Esses estados **não** se confundem com o ciclo de vida de uma Mission de domínio nem com o estado cognitivo da Opera.

---

## 9. Princípios

1. **Supervisor observa, não decide.**
2. **Opera decide estratégia.**
3. **Employees executam especialidade.**
4. **Ações precisam ser rastreáveis.**

Invariante:

```
observa → (se necessário) COORDINATE → Opera decide → Employees executam → resultado registrado
```

---

## 10. Evolução futura

Itens **planejados** (não afirmados como capacidade completa atual neste documento de arquitetura):

- melhoria de observabilidade;
- persistência de snapshots;
- políticas de coordenação **estritamente operacionais** (nunca de negócio);
- recuperação automática **controlada** de infraestrutura (com limites explícitos; decisão de negócio permanece com a Opera).

---

*Documento de arquitetura — Operational Supervisor · OperaIA.lab*
