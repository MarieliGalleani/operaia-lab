-- Mission.origin (P1.2B) — causa estrutural de criacao da missao RAIZ.
-- Nullable de proposito: nao ha backfill/heuristica de missoes legadas
-- nesta migration (ver docs/architecture/mission-origin.md).

CREATE TYPE "MissionOrigin" AS ENUM (
  'HUMAN_DEMAND',
  'HUMAN_ADVANCED',
  'CEO_SALA',
  'SCHEDULE_RULE',
  'SUPERVISOR_AUTO',
  'SIGNAL_GITHUB'
);

ALTER TABLE "missions" ADD COLUMN "origin" "MissionOrigin";
