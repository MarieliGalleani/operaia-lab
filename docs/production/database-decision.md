# Decisão de banco — PostgreSQL (análise, sem escolha)

**Status:** análise técnica para App Provisioning. **Nenhuma opção foi selecionada.**

A aplicação exige PostgreSQL acessível via `DATABASE_URL` (Prisma). Na Oracle Cloud VM já existem Docker e (via Bootstrap) a opção de PostgreSQL no SO.

---

## Opção 1 — PostgreSQL via Docker Compose

**Referência existente:** `infra/docker-compose.yml` (imagem `postgres:16-alpine`, volume nomeado).

### Prós

- Paridade com desenvolvimento local
- Upgrade de major via tag de imagem
- Isolamento do SO (não mistura clusters apt)
- Volume Docker facilita backup de dados como unidade
- Coexiste naturalmente com n8n já containerizado

### Contras

- Dependência do daemon Docker (ponto único se Docker cair)
- Precisa cuidar de restart policy, healthcheck e rede
- Porta publicada no host deve ser **somente localhost** (risco se `0.0.0.0`)
- Operação de backup exige `docker exec` ou URL apontando ao container
- Observabilidade/métricas do PG ficam no ecossistema container

### Adequação à VM atual

Alta se a política for “tudo que for app data em Compose”, alinhado ao Docker já instalado.

---

## Opção 2 — PostgreSQL instalado no sistema (apt/systemd)

**Referência existente:** `infra/bootstrap/03-install-postgresql.sh`.

### Prós

- Unit `postgresql` nativa, bem integrada a systemd
- Menos uma dependência runtime (Docker) para o datastore crítico
- `pg_dump`/`psql` diretos nos scripts de backup
- Ferramentas de SO (logrotate, monitoring agent) enxergam o serviço facilmente

### Contras

- Divergência do fluxo local (compose)
- Upgrade de major mais cerimonioso
- Dois “mundos” na VM: PG no host + n8n no Docker
- Bootstrap já pode ter instalado PG mesmo que se escolha Compose depois (desperdício ou conflito de porta 5432)

### Adequação à VM atual

Alta se a prioridade for datastore crítico fora do ciclo de vida do Docker.

---

## Critérios sugeridos para a decisão (próxima missão)

| Critério | Pergunta |
|----------|----------|
| RTO/RPO | Backup diário basta ou precisa WAL/PITR? |
| Operação | Time prefere `docker compose` ou `systemctl`? |
| Porta | 5432 livre no host? Conflito com outro PG? |
| Blast radius | Docker reiniciado pode derrubar o banco da Equipe Digital? |
| Paridade | Vale a pena igualar prod ao `infra/docker-compose.yml`? |

---

## Recomendação

**Nenhuma.** Registrar apenas: ambas são viáveis; a missão **Deploy** deve escolher explicitamente uma e fixar `DATABASE_URL` + runbook de backup correspondente.
