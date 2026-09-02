/**
 * Espelha apps/api/src/modules/runtime/mission-origin.ts#originToFloor.
 * A fonte de verdade fica no backend (P1.2B) — esta funcao replica a
 * mesma regra pura porque o campo `origin` ja vem no payload de
 * GET /missions?format=flat (Prisma sem select explicito retorna a
 * coluna), mas nao existe endpoint dedicado que devolva o floor pronto.
 *
 * NULL nunca vira "DEVELOPMENT" por padrao: origem desconhecida/legada
 * ou missao-filha (que nunca carrega origin) fica UNKNOWN, explicito.
 */
export type MissionOriginValue =
  | "HUMAN_DEMAND"
  | "HUMAN_ADVANCED"
  | "CEO_SALA"
  | "SCHEDULE_RULE"
  | "SUPERVISOR_AUTO"
  | "SIGNAL_GITHUB";

export type MissionFloorResult = "DEVELOPMENT" | "AUTOMATION" | "UNKNOWN";

const AUTOMATION_ORIGINS: ReadonlySet<string> = new Set<MissionOriginValue>([
  "SCHEDULE_RULE",
]);

export function originToFloor(
  origin: string | null | undefined,
): MissionFloorResult {
  if (!origin) {
    return "UNKNOWN";
  }
  return AUTOMATION_ORIGINS.has(origin) ? "AUTOMATION" : "DEVELOPMENT";
}
