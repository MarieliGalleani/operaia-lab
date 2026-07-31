-- Action Runtime A.4.1: persiste target da acao no ledger.

ALTER TABLE "action_executions"
  ADD COLUMN "target" TEXT NOT NULL DEFAULT '';
