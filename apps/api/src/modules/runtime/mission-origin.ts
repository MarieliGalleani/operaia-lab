import type { MissionOrigin } from "@operaia/database";

/**
 * Andar operacional (P1.2 — Floor Isolation). Unico ponto de derivacao —
 * o frontend NUNCA reimplementa esta regra nem sobe a arvore de missoes
 * pra descobrir o andar; consome o resultado ja resolvido pelo backend.
 *
 * NULL nao vira "DEVELOPMENT" por padrao: origem desconhecida/legada fica
 * como UNKNOWN, explicito, nunca inferido por heuristica de objective,
 * timestamp ou workspace (ver docs/architecture/mission-origin.md).
 */
export type MissionFloor = "DEVELOPMENT" | "AUTOMATION" | "UNKNOWN";

const AUTOMATION_ORIGINS: ReadonlySet<MissionOrigin> = new Set(["SCHEDULE_RULE"]);

export function originToFloor(origin: MissionOrigin | null | undefined): MissionFloor {
  if (!origin) {
    return "UNKNOWN";
  }
  return AUTOMATION_ORIGINS.has(origin) ? "AUTOMATION" : "DEVELOPMENT";
}
