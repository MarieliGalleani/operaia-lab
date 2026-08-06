# Validation Suite — Sprint A.V + A.5.3

Suíte oficial de validação ponta a ponta do **OperaIA.lab**.

Objetivo: comprovar que a arquitetura operacional da Sprint A funciona integrada — da entrada da mensagem até execução, auditoria e resposta — e que o hardening A.5.3 protege a operação.

Esta suíte **não** adiciona funcionalidades de produto.

---

## Pacote

`@operaia/validation-suite`

### Como executar

```bash
pnpm validate:sprint-a
# ou
pnpm --filter @operaia/validation-suite validate
pnpm --filter @operaia/validation-suite test
```

Artefato: [`sprint-a-operational-proof.md`](./sprint-a-operational-proof.md)

---

## Cenários

**A.V (12):** roteamento, OPERATIONAL_REVIEW, TECH/BUG/INFRA, Action Runtime, Policy, isolamento, ledger, recovery.

**A.5.3 (6):** memory 80/95/100%, soft-fail, FIFO eviction, WAITING órfãos, alertas Supervisor, health HEALTHY.

---

## Docs de operação

- [FAILURE-POLICY.md](../operations/FAILURE-POLICY.md)
- [HEALTH.md](../operations/HEALTH.md)
- [ALERTS.md](../operations/ALERTS.md)
- [MAINTENANCE.md](../operations/MAINTENANCE.md)
