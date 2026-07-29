# Operational Supervisor — Arquitetura

| Campo | Valor |
|-------|--------|
| **Status** | Proposta de arquitetura — **aguardando aprovação** antes de evolução de código |
| **Versão** | 2.0 |
| **Módulo** | `apps/api/src/modules/runtime/supervisor/` |
| **Runtime** | Continuous Runtime (`CONTINUOUS_RUNTIME_ENABLED`) |
| **Relacionados** | ADR-007, Plano Diretor, Handbook `08-operational-supervisor.md` |

Este documento é a especificação oficial do **Operational Supervisor** do OperaIA.lab.  
Após aprovação, qualquer mudança de código neste módulo deve respeitar as seções abaixo.

---

## 1. Natureza

```
Supervisor = infraestrutura operacional do Digital Office
```

| O Supervisor **é** | O Supervisor **não é** |
|--------------------|-------------------------|
| Serviço de runtime contínuo | Funcionário (Employee) |
| Observador e recuperador de infra | Agente que conversa com usuário |
| Produtor de missões `COORDINATE` para a Opera | CEO / decisor estratégico |
| Registrador de ciclos operacionais | Especialista de domínio |

**Invariante:** o Supervisor **nunca substitui a Opera**.

---

## 2. Responsabilidades

O Supervisor deve:

| # | Responsabilidade | Como |
|---|------------------|------|
| R1 | **Executar ciclos periódicos** | Loop `start` / `stop` com intervalo configurável (`SCHEDULER_INTERVAL_MS`) |
| R2 | **Verificar estado do Workspace** | `WorkspaceScanner` — backlog, bloqueios, waiting, mudanças, atenção |
| R3 | **Verificar missões pendentes** | `MissionScanner` — QUEUED/CREATED/WAITING/RUNNING/BLOCKED/FAILED/STALE/RETRY |
| R4 | **Verificar backlog** | Sinais de tarefas/missões abertas e profundidade de fila (`QueueMonitor`) |
| R5 | **Detectar necessidades operacionais** | Agregar razões neutras (`CoordinationReason`) sem interpretar negócio |
| R6 | **Criar missões para a Opera avaliar** | `CoordinationDispatcher` → enqueue `COORDINATE` com `ownerEmployeeId = Opera` |
| R7 | **Registrar histórico dos ciclos** | Eventos estruturados + snapshot por ciclo (ver §5 e §8) |
| R8 | **Recovery técnico de fila** | Stale RUNNING, WAITING órfão, DAG bloqueado — sem escolher specialist |

### Ciclo canônico (ordem obrigatória)

```
Health Check
    ↓
Workspace Scan
    ↓
Mission Scan
    ↓
Queue / Backlog Scan
    ↓
Recover stale / waiting / blocked (infra)
    ↓
Dispatch COORDINATE (só se houver sinal + health ok)
    ↓
Persistir snapshot + emitir eventos do ciclo
    ↓
Sleep (intervalo)
```

---

## 3. Limites

O Supervisor **não**:

| Proibido | Motivo |
|----------|--------|
| É funcionário / tem brain / briefing de domínio | Natureza de infra |
| Toma decisões estratégicas | Pertence à Opera |
| Conversa com usuário | Sem canal de chat / reply |
| Define prioridades de negócio ou roadmap | Fora do escopo |
| Escolhe especialistas ou especialização | Matcher / Opera |
| Cria missões `EXECUTE` ou `CONSOLIDATE` | Só workers após decisão da Opera |
| Enfileira missão com `owner` ≠ Opera | Bypass da Opera |
| Interpreta objetivo do usuário como plano | Texto de COORDINATE é operacional/neutro |
| Aplica mudança estrutural (learning → produção) | Human Oversight (ADR-005) |
| Usa MissionScheduler / portfolio como fallback de decisão | Planejamento sob demanda da Opera |
| Inventa missão sem sinal operacional | Ciclo encerra sem enqueue |

### Separação de papéis

```
Supervisor observa e (se necessário) cria COORDINATE
Opera analisa e decide
Employees executam especialidade
MissionQueue / Workers realizam a execução técnica
```

---

## 4. Fluxo

### 4.1 Fluxo de ponta a ponta

```
ContinuousRuntime.start()
        ↓
SupervisorLoop (periódico)
        ↓
Observação (health + workspace + missões + backlog/fila)
        ↓
Recovery técnico (opcional)
        ↓
[sinal operacional?] ──não──► registrar ciclo → sleep
        │
       sim
        ↓
MissionQueue.enqueue(COORDINATE, owner=Opera, dedupe=true)
        ↓
EmployeeWorker (Opera) claim
        ↓
QueuedMissionExecutor (COORDINATE → EXECUTE → CONSOLIDATE)
        ↓
Opera decide → Matcher → Specialists → Resultado (resultJson + MissionEvent)
```

### 4.2 Objetivo da missão criada pelo Supervisor

O texto/objetivo de `COORDINATE` deve ser **operacional e neutro**, por exemplo:

- necessidade de atenção no workspace X;
- missão parada / bloqueada / aguardando;
- backlog detectado;
- congestão de fila;
- acompanhamento periódico.

**Não** deve conter plano técnico, escolha de Mag/Luna, prioridade de produto ou interpretação de pedido de usuário.

### 4.3 Gate de health

Se o health geral for `fail`, o Supervisor:

1. registra `HEALTH_FAIL`;
2. **não** dispara novos `COORDINATE`;
3. ainda pode executar recovery técnico seguro (desbloqueio de infra), conforme política.

---

## 5. Eventos

Eventos oficiais do ciclo (contrato de observabilidade):

| Evento | Quando |
|--------|--------|
| `SUPERVISOR_STARTED` | Loop iniciado |
| `SUPERVISOR_STOPPED` | Loop parado |
| `HEALTH_CHECK` | Início/fim da verificação de health |
| `HEALTH_OK` | Health aceitável |
| `HEALTH_FAIL` | Health bloqueante |
| `WORKSPACE_SCANNED` | Scan de workspaces concluído |
| `MISSION_SCANNED` | Scan de missões concluído |
| `QUEUE_SCANNED` | Scan de fila/backlog concluído |
| `RECOVERY_CREATED` | Recovery técnico aplicado |
| `COORDINATION_CREATED` | Missão `COORDINATE` enfileirada |
| `SNAPSHOT_PERSISTED` | Snapshot do ciclo gravado no store |
| `SUPERVISOR_CYCLE` | Resumo do ciclo (diagnóstico) |
| `SUPERVISOR_SLEEP` | Aguardando próximo intervalo |

### Razões de coordenação (`CoordinationReason`)

Sinais **operacionais** permitidos (não são prioridade de negócio):

- `novo_workspace`
- `missao_parada` / `missao_bloqueada` / `missao_aguardando`
- `retry` / `recuperacao`
- `backlog`
- `mudanca_importante`
- `congestionamento_fila`
- `acompanhamento_periodico`

---

## 6. Integração com Mission Queue

A **Mission Queue é a única porta** pela qual o Supervisor cria trabalho (ADR-007).

| Operação | Permitido? | Detalhe |
|----------|------------|---------|
| Ler profundidade / status / missões | Sim | Observação |
| `recoverStaleRunning` / `recoverWaitingParents` / `recoverBlockedDag` | Sim | Infra |
| `enqueue` `COORDINATE` com owner Opera | Sim | Única criação de missão |
| `enqueue` `EXECUTE` / `CONSOLIDATE` | **Não** | |
| `enqueue` com owner specialist | **Não** | |
| Escolher `priority` de produto | **Não** | Usar default operacional / dedupe |
| Claim / execute missão | **Não** | Workers |

### Contrato de enqueue

```
workspaceId     = workspace com sinal
objective       = texto operacional neutro (razão + contexto mínimo)
ownerEmployeeId = Opera (CEO_EMPLOYEE_ID)
missionKind     = COORDINATE (implícito no enqueue raiz)
dedupe          = true
```

Após o enqueue, o Supervisor **não** acompanha a decisão da Opera. O Continuous Runtime (workers) processa a fila.

---

## 7. Pontos de segurança

| # | Controle | Descrição |
|---|----------|-----------|
| S1 | **Sem bypass da Opera** | Toda missão criada pelo Supervisor é `COORDINATE` para Opera |
| S2 | **Sem decisão de negócio** | Code review / testes rejeitam escolha de specialist, prioridade de produto, plano |
| S3 | **Health gate** | Health `fail` → sem novos COORDINATE |
| S4 | **Dedupe** | Evita storm de COORDINATE idênticos |
| S5 | **Sem I/O de usuário** | Sem endpoints de chat; sem reply; sem LLM de conversa |
| S6 | **Sem secrets de domínio** | Supervisor não chama GitHub/n8n/WhatsApp; só estado interno + fila |
| S7 | **Auditoria do ciclo** | Eventos + snapshot por ciclo; correlação com `missionId` quando COORDINATE é criado |
| S8 | **Isolamento de workspace** | Sinais e enqueue sempre com `workspaceId` explícito — sem misturar contextos |
| S9 | **Human Oversight** | Mudanças estruturais / apply de learning fora do Supervisor |
| S10 | **Congestão** | Em evolução: não disparar novos COORDINATE se profundidade de fila ultrapassar limiar operacional |

### Testes de invariante (obrigatórios na implementação)

1. Ciclo sem sinal → **zero** enqueue.  
2. Ciclo com sinal → enqueue só `COORDINATE` + owner Opera.  
3. Health fail → **zero** COORDINATION_CREATED.  
4. Nenhum caminho chama specialist por nome.  
5. Eventos do ciclo emitidos na ordem esperada.

---

## 8. Histórico dos ciclos

### Requisito

Cada ciclo deve deixar trilha auditável:

- timestamp / número do ciclo;
- resumo de health;
- contagens de scan (workspaces em atenção, missões, depths);
- recoveries aplicados;
- coordenações criadas (`missionId`);
- eventos emitidos.

### Estado atual vs alvo desta evolução

| Capacidade | Hoje | Alvo após aprovação |
|------------|------|---------------------|
| Eventos em processo | Sim (store in-memory) | Manter + **persistência durável** |
| Snapshots in-memory | Sim (cap limitado) | Manter + **persistência durável** |
| Exposição em `GET /api/v1/runtime` | Parcial | Completar histórico recente estável |
| Métricas exportáveis | Não | Evolução posterior (não bloqueia v2) |

A implementação pós-aprovação deve priorizar **histórico durável dos ciclos** sem alterar responsabilidades nem limites deste documento.

---

## 9. Componentes (mapa)

| Componente | Papel |
|------------|-------|
| `SupervisorLoop` | Orquestra o ciclo periódico |
| `HealthMonitor` | Health de runtime / registry / memory / queue / execution |
| `WorkspaceScanner` | Estado e atenção por workspace |
| `MissionScanner` | Missões pendentes / stale / retry |
| `QueueMonitor` | Backlog e congestão da fila |
| `RecoveryCoordinator` | Recovery técnico |
| `CoordinationDispatcher` | Cria `COORDINATE` para Opera |
| `SnapshotGenerator` + SnapshotStore | Histórico do ciclo |
| EventStore + Logger | Eventos estruturados |
| `ContinuousRuntime` | Boot: readiness → recovery inicial → workers → Supervisor |

---

## 10. Critérios de aceite (pós-aprovação)

A evolução será considerada pronta quando:

1. Documentação e código respeitam §§2–7.  
2. Histórico de ciclos persiste além do restart do processo.  
3. Testes de invariante (§7) verdes.  
4. Validação operacional: Supervisor emite `COORDINATION_CREATED` → missão COMPLETED/FAILED auditável na Mission Queue — **sem** intervenção manual no meio do ciclo.  
5. Nenhuma nova interface de usuário.  
6. Typecheck + testes do módulo Supervisor verdes.

---

## 11. Fora de escopo

- Novas UIs / chat com Supervisor  
- Multi-tenant Campus  
- Integração GitHub/n8n **dentro** do Supervisor (ingress externo é Bridge → Queue; Supervisor só reage a estado interno)  
- Ativar MissionScheduler como decisor  
- Redesign do Path A Assisted (exceto se necessário para não violar ADR-007)

---

## 12. Aprovação

| Decisão | Status |
|---------|--------|
| Arquitetura deste documento | **Aguardando aprovação** |
| Implementação / evolução de código | **Bloqueada até aprovação** |

Após aprovação explícita, a implementação seguirá este documento na ordem:

1. Fechar gaps de histórico durável dos ciclos  
2. Reforçar testes de invariante e segurança  
3. Validação operacional com Continuous Runtime  

---

*Operational Supervisor · OperaIA.lab · Documento de arquitetura v2.0*
