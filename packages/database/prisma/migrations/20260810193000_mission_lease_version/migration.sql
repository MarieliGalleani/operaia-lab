-- MQ-2: ownership de execucao via leaseVersion (geracao de claim/recover).
-- attempt permanece exclusivamente como budget de retry/maxAttempts.

ALTER TABLE "missions"
  ADD COLUMN "leaseVersion" INTEGER NOT NULL DEFAULT 0;
