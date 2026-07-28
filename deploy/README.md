# Deploy artifacts — App Provisioning

Templates e scripts para a missão **Deploy** (ainda não executar).

```text
deploy/
└── systemd/
    ├── operaia-api.service          ← caminho atual (monólito)
    ├── operaia-runtime.service      ← futuro (ConditionPathExists flag)
    ├── operaia-worker.service       ← futuro
    └── operaia-scheduler.service    ← futuro

scripts/   (raiz do monorepo)
├── deploy.sh
├── rollback.sh
├── backup-db.sh
└── restore-db.sh
```

Documentação: `docs/production/`.
