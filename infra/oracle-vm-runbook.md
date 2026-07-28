# Oracle VM — Runtime Contínuo da Equipe Digital

Ambiente oficial: **Oracle Cloud VM**  
Documentação completa de produção: **[production/ARCHITECTURE.md](./production/ARCHITECTURE.md)**

## Pré-requisitos

- Node.js >= 20, pnpm >= 9
- PostgreSQL acessível (`DATABASE_URL`)
- Repositório em `/opt/operaia-lab`
- `.env` a partir de `infra/production/env.production.example`
- Caddy + DNS `*.operaia.com.br` → IP da VM
- `CONTINUOUS_RUNTIME_ENABLED=true`

## Instalação rápida

```bash
# Bootstrap (root) — ver ARCHITECTURE.md
bash infra/scripts/bootstrap-oracle-vm.sh

# Deploy (usuario operaia)
sudo -u operaia bash infra/scripts/deploy-production.sh
sudo systemctl enable --now operaia-lab-api caddy operaia-backup.timer
bash infra/scripts/production-checklist.sh
```

## Validação local (loopback)

```bash
curl -s http://127.0.0.1:3333/api/v1/health
curl -s http://127.0.0.1:3333/api/v1/production-readiness
curl -s http://127.0.0.1:3333/api/v1/workers
```

## Validação pública (após DNS/TLS)

```bash
curl -sI https://api.operaia.com.br/api/v1/health
curl -s  https://status.operaia.com.br
curl -sI https://lab.operaia.com.br
curl -sI https://operaia.com.br
```

## Após reboot da VM

```bash
sudo systemctl status operaia-lab-api caddy
curl -s http://127.0.0.1:3333/api/v1/workers
```

Critério: serviços `enabled`; workers vivos; missões órfãs recuperadas pelo Continuous Runtime no boot.

## Critério “PC do usuário desligado”

Com API + Caddy só na VM (Security List 80/443), desligar o notebook **não** interrompe workers, scheduler nem heartbeats.

## Variáveis relevantes

| Var | Função |
|-----|--------|
| `CONTINUOUS_RUNTIME_ENABLED` | Liga workers + scheduler |
| `API_HOST=127.0.0.1` | Bind local (Caddy na frente) |
| `VITE_API_URL` | URL pública da API no build do lab |
| `MISSION_STALE_RUNNING_MS` | Recovery de RUNNING órfão |
