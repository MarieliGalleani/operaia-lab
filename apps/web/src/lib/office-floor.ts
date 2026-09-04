/**
 * Espelha apps/api/src/modules/runtime/mission-origin.ts#originToFloor.
 * A fonte de verdade fica no backend (P1.2B) — esta funcao replica a
 * mesma regra pura porque o campo `origin` ja vem no payload de
 * GET /missions?format=flat (Prisma sem select explicito retorna a
 * coluna), mas nao existe endpoint dedicado que devolva o floor pronto.
 *
 * NULL nunca vira "DEVELOPMENT" por padrao: origem desconhecida/legada
 * ou missao-filha (que nunca carrega origin) fica UNKNOWN, explicito.
 * MARKETING nunca resolve por essa funcao — nao existe MissionOrigin
 * que aponte pra ela hoje (ver P1.19/P1.21 audit).
 */
export type MissionFloorResult = "DEVELOPMENT" | "AUTOMATION" | "UNKNOWN";

const AUTOMATION_ORIGINS: ReadonlySet<string> = new Set(["SCHEDULE_RULE"]);

export function originToFloor(
  origin: string | null | undefined,
): MissionFloorResult {
  if (!origin) {
    return "UNKNOWN";
  }
  return AUTOMATION_ORIGINS.has(origin) ? "AUTOMATION" : "DEVELOPMENT";
}

/**
 * Especialidade -> andar, para segmentar a Equipe (P1.21 fix). Mesma
 * ideia de originToFloor: uma regra pura e honesta, sem inventar andar
 * pra especialidade que ainda nao tem um.
 *
 * MANAGEMENT (Opera/CEO) nao entra no mapa de proposito: o CEO coordena
 * todos os andares (ver docs/operaia-ceo.md), entao aparece em todos —
 * nao e "nao segmentado", e um papel transversal real.
 *
 * FINANCE/LEGAL/OPERATIONS/UX_DESIGN/PRODUCT/COMMERCIAL tambem ficam de
 * fora: nao existe andar pra eles ainda (so Dev/Automacao/Marketing),
 * entao nao aparecem em nenhum andar em vez de serem empurrados pra um
 * errado.
 */
export type EmployeeFloorId = "dev" | "automation" | "marketing";

const FLOOR_BY_SPECIALIZATION: Readonly<Record<string, EmployeeFloorId>> = {
  SOFTWARE_ENGINEERING: "dev",
  PRODUCT_DESIGN: "dev",
  PRODUCT_MANAGEMENT: "dev",
  AUTOMATION: "automation",
  MARKETING: "marketing",
};

export function specializationToFloor(
  specialization: string,
): EmployeeFloorId | null {
  return FLOOR_BY_SPECIALIZATION[specialization] ?? null;
}

/** Roster de um andar: especialistas do andar + CEO (papel transversal). */
export function employeesForFloor<T extends { readonly specialization: string }>(
  employees: readonly T[],
  floorId: EmployeeFloorId,
): readonly T[] {
  return employees.filter(
    (e) =>
      e.specialization === "MANAGEMENT" ||
      specializationToFloor(e.specialization) === floorId,
  );
}
