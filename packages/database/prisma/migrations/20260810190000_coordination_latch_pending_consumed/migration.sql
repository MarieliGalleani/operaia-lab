-- Gap C.2: estados PENDING/CONSUMED para latch recuperavel.
-- PENDING = borda adquirida, missao ainda nao confirmada.
-- CONSUMED = COORDINATE entregue (edge consumida).

CREATE TYPE "CoordinationLatchStatus" AS ENUM ('PENDING', 'CONSUMED');

ALTER TABLE "coordination_signal_latches"
  ADD COLUMN "status" "CoordinationLatchStatus" NOT NULL DEFAULT 'PENDING';

CREATE INDEX "coordination_signal_latches_status_idx"
  ON "coordination_signal_latches"("status");
