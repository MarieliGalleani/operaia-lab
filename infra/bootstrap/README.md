# Bootstrap de infraestrutura — Oracle Cloud VM (OperaIA.lab)

**Missão:** preparar a VM de produção de forma **reproduzível e idempotente**.  
**Fora de escopo:** publicar a aplicação, Caddy, DNS, clone, `.env`, build, migrations, API.

> Não execute estes scripts a partir do Windows de desenvolvimento como “deploy remoto”.  
> Copie o diretório `infra/bootstrap/` para a VM (ou use o repo já presente) e rode **lá**, como root.

---

## Árvore

```text
infra/bootstrap/
├── 01-install-node.sh
├── 02-install-pnpm.sh
├── 03-install-postgresql.sh
├── 04-create-directories.sh
├── 05-create-production-user.sh
├── 06-prepare-runtime.sh
├── bootstrap.sh
└── README.md
```

---

## Descrição dos scripts

| Script | Função |
|--------|--------|
| `01-install-node.sh` | Instala **Node.js 22.x** (LTS, `engines.node >=20`) via NodeSource. Idempotente por major. Override: `NODE_MAJOR=20`. |
| `02-install-pnpm.sh` | Instala **pnpm@11.11.0** (campo `packageManager` do monorepo) via Corepack, com fallback `npm -g`. Override: `PNPM_VERSION=…`. |
| `03-install-postgresql.sh` | Instala **PostgreSQL** (server + contrib + client), enable/start systemd. **Não** cria banco/role da app. |
| `04-create-directories.sh` | Cria `/opt/operaia-lab/{releases,shared,logs,backups,runtime}`. |
| `05-create-production-user.sh` | Cria usuário/grupo de sistema **`operaia`**. Preserva **`ubuntu`**. |
| `06-prepare-runtime.sh` | Cria `runtime/{logs,pid,socket,uploads,cache,tmp}` + ownership. |
| `bootstrap.sh` | Orquestra os passos na ordem segura de dependências. |

---

## Como executar

Na Oracle Cloud VM (Ubuntu 24.04 ARM64), como root:

```bash
# Se os scripts já estão no host (ex.: pasta copiada):
cd /path/to/infra/bootstrap
sudo bash ./bootstrap.sh
```

Passos isolados (também idempotentes):

```bash
sudo bash ./05-create-production-user.sh
sudo bash ./04-create-directories.sh
sudo bash ./01-install-node.sh
sudo bash ./02-install-pnpm.sh
sudo bash ./03-install-postgresql.sh
sudo bash ./06-prepare-runtime.sh
```

Variáveis opcionais:

| Variável | Default | Uso |
|----------|---------|-----|
| `NODE_MAJOR` | `22` | Major do Node (NodeSource) |
| `PNPM_VERSION` | `11.11.0` | Versão exata do pnpm |
| `OPERAIA_USER` | `operaia` | Usuário de produção |
| `OPERAIA_ROOT` | `/opt/operaia-lab` | Raiz de produção |

---

## O que será instalado / criado

- Node.js (major LTS alvo) + npm + corepack  
- pnpm@11.11.0  
- PostgreSQL (pacotes distro) + serviço `postgresql` enabled/active  
- Usuário/grupo `operaia`  
- Árvore:

```text
/opt/operaia-lab/
├── releases/
├── shared/
├── logs/
├── backups/
└── runtime/
    ├── logs/
    ├── pid/
    ├── socket/
    ├── uploads/
    ├── cache/
    └── tmp/
```

## O que NÃO é feito (propositalmente)

- Alterar Caddy existente  
- Alterar DNS  
- Clone do monorepo  
- Criar `.env`  
- Criar database/role da aplicação  
- `pnpm install` / build / migrations  
- Instalar ou iniciar unit `operaia-lab-api`  
- Tocar em Docker / n8n / Oracle Monitoring  

---

## Pendências — próxima missão

1. Disponibilizar o monorepo em `/opt/operaia-lab` (clone ou release artifact)  
2. Criar `.env` de produção (a partir de `infra/production/env.production.example`)  
3. Criar role + database PostgreSQL da app  
4. Install / build / migrate  
5. systemd da API + Continuous Runtime  
6. Integração Caddy **sem** quebrar n8n  
7. DNS `lab` / `api` / `status`  
8. Checklist go-live e prova 24/7  

---

## Checklist de validação (após rodar na VM)

```bash
# Usuário
id operaia
getent passwd ubuntu   # deve continuar existindo

# Toolchain
node -v                # v22.x (ou NODE_MAJOR escolhido), major >= 20
pnpm -v                # 11.11.0

# PostgreSQL (servidor up; sem DB da app ainda)
systemctl is-enabled postgresql
systemctl is-active postgresql
pg_isready
# NÃO deve existir ainda (próxima missão):
#   sudo -u postgres psql -c '\l' | grep operaia_lab

# Diretórios
sudo ls -la /opt/operaia-lab
sudo ls -la /opt/operaia-lab/runtime
# owner esperado: operaia:operaia

# Não regredir serviços já auditados
systemctl is-active caddy
# n8n conforme o unit/container usado na VM
docker ps   # se n8n estiver em Docker

# Confirmar ausência de publicação prematura
systemctl status operaia-lab-api 2>&1 | head  # unit ainda não deve existir
test ! -f /opt/operaia-lab/.env && echo "sem .env (ok nesta missão)"
```

Reexecutar `sudo bash ./bootstrap.sh` deve terminar com exit `0` sem quebrar a VM.
