# Operational Supervisor

Documento de arquitetura do **Operational Supervisor** no OperaIA.lab.

Define a natureza, os limites e o fluxo do componente, alinhados à implementação em `apps/api/src/modules/runtime/supervisor/`. Diferencia o que **existe atualmente** do que permanece **evolução futura**. Não descreve autonomia total nem substitui a Opera.

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
| Pendências / missões em estados intermediários | Observar sinais; recuperar infra de fila quando aplicável; iniciar coordenação |
| Falta de sinal para a Opera agir | Iniciar missão `COORDINATE` |
| Opacidade do estado operacional | Registrar observação e ciclos (logs / eventos / snapshots locais) |

### Relação com o Digital Office

O Digital Office é composto por **Workspace**, **Missions** e **Employees**. O Supervisor é a camada de **infraestrutura operacional** que observa esse conjunto e dispara ciclos de coordenação para a **Opera** (CEO Employee). Ele **não** é Employee e **nunca substitui a Opera**.

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

Camada de runtime/infra do Digital Office responsável por ciclos operacionais contínuos. **Não** implementa contratos do Employee Framework. Localização de referência: módulo `supervisor` sob o Continuous Runtime da API.

### Não é

| Não é | Motivo |
|---|---|
| **Employee** | Sem perfil, brain ou decisão de funcionário digital |
| **Agent** | Não processa briefing de domínio como agente cognitivo |
| **CEO** | Não analisa estratégia nem consolida resultado de negócio |
| **Especialista** | Não executa trabalho de domínio |

### Nunca substitui a Opera

**Invariante obrigatório:** o Supervisor **nunca** substitui a Opera.

A Opera permanece o único CEO Employee no fluxo: analisa, decide, prioriza no escopo da missão e delega. O Supervisor observa, pode recuperar estado técnico de fila e inicia `COORDINATE` para que a **Opera** atue. Qualquer bypass (enqueue para specialist, prioridade de negócio, plano de domínio) viola esta arquitetura.

### Diferença entre Supervisor e Opera

| | Operational Supervisor | Opera (CEO Employee) |
|---|---|---|
| Natureza | Infraestrutura operacional | Employee de management |
| Entrada | Estado operacional | Objetivo + briefing de missão |
| Saída | Observação; `COORDINATE`; registro; recovery técnico de fila | Decisão estratégica, delegação, consolidação |
| Pode priorizar negócio? | Não | Sim (no escopo da missão) |
| Pode escolher specialist? | Não | Sim (via especialização / gate) |

```
Supervisor observa e coordena via COORDINATE
Opera decide e delega
Employees executam especialidade
```

---

## 3. Duas responsabilidades centrais

O Supervisor possui **duas responsabilidades** arquiteturais:

### 3.1 Observação operacional

- Percorrer sinais de workspace, missões e fila/runtime.
- Verificar saúde operacional dos componentes do Digital Office.
- Identificar necessidade de atenção **sem** executar missão de domínio.

### 3.2 Coordenação via `COORDINATE` para a Opera

- Quando há necessidade operacional, criar missão `COORDINATE` com destinatário Opera.
- Motivo operacional neutro (não estratégico).
- Sem sinal: encerrar o ciclo **sem** criar missão e **sem** inventar prioridade ou âncora de portfólio.

Essas duas responsabilidades definem o núcleo. Demais capacidades (recovery técnico, health detalhado, eventos, snapshots) apoiam o núcleo sem alterar quem decide.

---

## 4. Responsabilidades e recovery técnico

### Responsabilidades permitidas

1. **Observar estado operacional** — scans de workspace, missão e fila; health operacional.
2. **Identificar necessidade de coordenação** — sinais que exigem a Opera.
3. **Iniciar ciclos `COORDINATE`** — destinando à Opera.
4. **Registrar o ciclo** — logs, eventos e snapshots locais.
5. **Recuperação técnica de fila** (infraestrutura) — ver abaixo.

### Recovery técnico de fila

A recuperação técnica de fila (ex.: missões running stale, waiting parents, blocked DAG) **pode existir** como responsabilidade de **infraestrutura** do Supervisor (e/ou do Continuous Runtime no boot).

Permitido somente se:

| Condição | Exigência |
|---|---|
| Não toma decisão de negócio | Não interpreta objetivo nem escolhe roadmap |
| Não escolhe especialistas | Não define `owner` specialist nem especialização |
| Não altera prioridades | Não copia/converte prioridade de projeto/portfólio |

Recovery técnico **desbloqueia estado operacional**; a decisão sobre o que fazer a seguir continua com a **Opera** (via `COORDINATE` quando houver sinal).

### Escopo explícito

| Supervisor | Opera / Employees |
|---|---|
| Observa | Decide estratégia |
| Identifica necessidade operacional | Define prioridades de negócio |
| Inicia `COORDINATE` | Escolhe especialistas / especialização |
| Recovery técnico de fila | Executa trabalho de domínio e consolida resultado |
| Registra o ciclo de supervisão | — |

---

## 5. Limites

O Supervisor **não**:

| Proibido | Justificativa |
|---|---|
| Toma decisões estratégicas | Pertence à Opera / oversight humano |
| Define prioridades de negócio | Priorização de portfólio/produto não é papel de infra |
| Escolhe especialistas | Matcher / Opera resolvem especialização |
| Substitui a Opera | Invariante: Supervisor nunca substitui Opera |
| Substitui aprovação humana | Governança e Human Oversight fora do Supervisor |
| Executa trabalho de domínio | Specialists / engines de execução |
| Altera arquitetura | Exige aprovação e ADR |
| Interpreta objetivo de usuário como plano de domínio | Texto de `COORDINATE` é operacional; Opera interpreta |
| Usa MissionScheduler / portfolio como fallback de decisão | Planejamento sob demanda permanece com a Opera |

Sem necessidade operacional identificada, o Supervisor **não** cria missão e **não** inventa prioridade ou âncora de portfólio.

---

## 6. Fluxo operacional

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

1. O Supervisor observa o estado operacional (inclui identificação de necessidade e, quando aplicável, recovery técnico de fila).
2. Havendo necessidade, inicia missão **`COORDINATE`** para a Opera.
3. A Opera analisa o contexto e decide.
4. Segue-se a **delegação** (especialização).
5. **Employees** executam o trabalho de domínio.
6. O **resultado** é registrado no fluxo operacional do Digital Office.

O Supervisor **não** participa da delegação nem da execução especializada. A Opera **nunca** é substituída neste fluxo.

---

## 7. Ciclo de execução

### Loop

O Supervisor opera como serviço com loop recorrente no Continuous Runtime:

```
observar (+ health / scans)
  → recovery técnico de fila (quando aplicável)
  → (opcional) iniciar COORDINATE
  → registrar (eventos / snapshot local)
  → aguardar intervalo
```

Execução controlada: `start` / `stop`; proteção contra sobreposição de ciclos.

### Intervalos

Intervalos de observação são configuração operacional de infraestrutura, não política de prioridade de negócio.

### Logs e histórico

O ciclo registra observação e coordenações iniciadas via logs estruturados, eventos e snapshots **locais** (em processo). Persistência durável e métricas avançadas são evolução — ver §11.

---

## 8. Integrações

| Integração | Papel |
|---|---|
| **Fonte de workspaces** (`WorkspaceSource`) | Contexto para observação de workspaces |
| **Mission Queue** | Leitura de estado; recovery técnico; enqueue de `COORDINATE` |
| **Workers / Continuous Runtime** | Boot do loop; processamento da fila após enqueue |
| **Mission Orchestrator / QueuedMissionExecutor** | Continuidade do fluxo após `COORDINATE` (Opera em diante) |
| **Operational Runs** | Registro/auditoria do ciclo missão → resultado (pós-Opera) |
| **Observability** | Logs e eventos do ciclo do Supervisor |

Planejamento de portfólio e escolha de prioridades **não** são integração do Supervisor; pertencem à Opera.

---

## 9. Estados

Os estados abaixo formam um **modelo arquitetural** do ciclo do Supervisor. **Não** constituem, por si só, uma máquina de estados obrigatoriamente espelhada 1:1 no código (a implementação pode usar flags como `running` / `ticking`).

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

## 10. Princípios

1. **Supervisor observa, não decide estratégia.**
2. **Supervisor nunca substitui a Opera.**
3. **Opera decide estratégia.**
4. **Employees executam especialidade.**
5. **Ações precisam ser rastreáveis.**
6. **Recovery técnico de fila não é decisão de negócio.**

Invariante:

```
observa → (recovery técnico se aplicável) → (se necessário) COORDINATE
  → Opera decide → Employees executam → resultado registrado
```

---

## 11. Estado atual vs evolução futura

### Existe atualmente

Capacidades presentes na implementação do módulo Supervisor / Continuous Runtime:

| Capacidade | Papel |
|---|---|
| **Scans** | Workspace, mission e queue |
| **Health operacional** | Verificação de componentes do runtime/office |
| **Snapshots locais** | Snapshot do ciclo em store in-memory |
| **Eventos** | Logs/eventos estruturados do ciclo |
| **Recovery técnico** | Recuperação de estados de fila (stale / waiting / blocked), sem decisão de negócio |

### Evolução futura

Itens **planejados** — não tratar como capacidade completa atual neste documento:

| Evolução | Descrição |
|---|---|
| **Persistência durável** | Snapshots e eventos além da memória de processo |
| **Métricas avançadas** | Exportação, painéis, correlação operacional |
| **Políticas operacionais formais** | Engine de políticas estritamente operacionais (timeout, congestão, heartbeat), wired de forma explícita — nunca regras de negócio |

---

*Documento de arquitetura — Operational Supervisor · OperaIA.lab*
