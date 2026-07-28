# Rollback — OperaIA.lab (futuro)

**Status:** documentação de App Provisioning. **Não executar** nesta missão.

Script: [`scripts/rollback.sh`](../../scripts/rollback.sh)

---

## Quando usar

- Deploy com health check falho
- Regressão funcional após switch de `current`
- Necessidade de voltar ao release anterior sem rebuild

---

## Fluxo pretendido

```text
1. Identificar release anterior em releases/
2. (Opcional) backup-db.sh antes se houver dúvida de schema
3. Repontar current → releases/<id-anterior>
4. Restart systemd (operaia-api)
5. Validar /api/v1/health e production-readiness
```

**Limite:** rollback de **código** não desfaz migrations destrutivas. Se o schema avançou de forma incompatível, usar [backup.md](./backup.md) / `restore-db.sh` com cuidado e janela de manutenção.

---

## Trava de segurança

`rollback.sh` exige `OPERAIA_ALLOW_DEPLOY=1` (mesmo gate do deploy) para evitar execução acidental em workstations.
