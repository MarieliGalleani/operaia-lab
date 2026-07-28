# ADR-006 — Layout de produção na VM (`/home/ubuntu` vs `/opt`)

| Campo | Valor |
|-------|--------|
| **Status** | Aceito |
| **Data** | 2026-07-28 |
| **Contexto** | Missão 3 — Deploy Oracle Cloud VM |
| **Decisores** | OperaIA / Engenharia |

---

## Contexto

A Oracle Cloud VM hospeda hoje e no futuro **múltiplos componentes**:

- ferramentas administrativas e de automação (ex.: n8n);
- repositórios de infraestrutura e deploy (`operaia-infra`, `operaia-deploy`);
- scripts operacionais do administrador (`ubuntu`);
- aplicações implantadas que devem sobreviver a releases, rollbacks e reboot com contrato systemd claro.

Sem convenção explícita, há risco de misturar código de produção com o home do administrador, dificultando permissões, backup, rollback e futuras apps no mesmo host.

---

## Decisão

### `/home/ubuntu` — área do administrador

**Uso permitido:**

- `operaia-infra`
- `operaia-deploy`
- n8n (e stacks auxiliares já existentes)
- scripts administrativos
- repositórios auxiliares e experimentos

**Uso proibido para esta convenção:**

- instalação de **aplicações implantadas em produção** (runtime systemd, releases, `.env` de app).

O home do `ubuntu` permanece o “bancada” do operador: clone de ferramentas, compose de n8n, playbooks — não o destino do artefato que o systemd reinicia após deploy.

### `/opt` — diretório oficial de aplicações implantadas

A **OperaIA.lab** será instalada em:

```text
/opt/operaia-lab/
├── current      → symlink ao release ativo
├── releases/    → artefatos imutáveis por versão
├── shared/      → .env, logs, backups, runtime (estado entre releases)
└── scripts/     → deploy, rollback, backup (operação na VM)
```

Esta é a **convenção oficial do projeto** para qualquer app implantada nesta VM (OperaIA.lab e futuras apps OperaIA no mesmo host).

---

## Por que `/home/ubuntu` só para infraestrutura

1. **Separação de papéis** — `ubuntu` é conta humana/admin; apps de produção rodam sob usuário de serviço (`operaia`) com least privilege.
2. **Não quebrar o que já existe** — n8n e stacks em Docker no home/admin continuam sem migrar artefatos de produção para o mesmo árvore.
3. **Operação previsível** — o administrador sabe que “tudo que eu edito no home” não é o release que systemd reinicia.
4. **Menor risco em updates do SO** — políticas de backup, quota e limpeza do home não afetam `/opt/operaia-lab/shared`.

---

## Por que aplicações em `/opt`

1. **Padrão Linux** — `/opt` é o local habitual para pacotes e apps adicionais fora do distro; alinhado a FHS.
2. **Layout releases + current** — rollback atômico sem tocar `shared/`; histórico em `releases/`.
3. **systemd** — `WorkingDirectory=/opt/operaia-lab/current`, `EnvironmentFile=/opt/operaia-lab/shared/.env` estáveis entre deploys.
4. **Permissões** — `operaia:operaia` em `/opt/operaia-lab`; `ubuntu` administra via sudo sem ser dono do runtime.
5. **Backup direcionado** — `shared/backups`, `shared/.env` e volume Postgres fora de `releases/`.

---

## Benefícios para manutenção, escalabilidade e futuras aplicações

| Dimensão | Benefício |
|----------|-----------|
| **Manutenção** | Deploy/rollback documentados; um lugar para logs e secrets |
| **Escalabilidade** | Novos releases sem downtime planejado (switch de `current`) |
| **Multi-app** | `/opt/operaia-lab`, `/opt/outra-app` com o mesmo padrão |
| **Onboarding** | ADR + `docs/production/architecture.md` definem onde cada coisa mora |
| **Missão 3 / Go Live** | Deploy na VM sem mover n8n nem Caddy; só provisionar `/opt` |

---

## Consequências

### Positivas

- Clareza operacional entre “admin” e “produção”.
- Compatível com scripts `scripts/deploy.sh`, `infra/bootstrap/`, units em `deploy/systemd/`.
- Facilita checklist de health em `127.0.0.1` antes de DNS/SSL.

### Negativas / trade-offs

- Exige bootstrap de dirs e usuário `operaia` antes do primeiro deploy (`infra/bootstrap/`).
- Operador precisa usar `sudo` ou `sudo -u operaia` para ações em `/opt`.
- Repositórios em `/home/ubuntu` (infra/deploy) devem **apontar** a `/opt` — não duplicar o app.

### O que não muda

- DNS, SSL, Caddy da OperaIA.lab — fora deste ADR (missão Go Live).
- n8n permanece onde já está (tipicamente sob admin/Docker).
- PostgreSQL de produção: Docker Compose versionado (ver `infra/production/docker-compose.postgres.yml`), bind localhost.

---

## Referências

- [docs/production/architecture.md](../production/architecture.md)
- [docs/production/deployment.md](../production/deployment.md)
- [infra/bootstrap/README.md](../../infra/bootstrap/README.md)
- [docs/production/process-role-decision.md](../production/process-role-decision.md)
