import type { MissionFloorResult } from "@/lib/office-floor";

/**
 * Andares reais do Escritorio Operacional (P1.19). Limitado aos 2 floors
 * que de fato existem no dominio hoje (router.ts + MissionFloor no
 * backend) — "Marketing" nao entra: nao existe MissionOrigin, rota nem
 * tipo que o sustente (ver auditoria P1.19, achado critico #1).
 */
export interface OfficeFloorDef {
  readonly id: "dev" | "automation";
  readonly code: string;
  readonly name: string;
  readonly missionFloor: MissionFloorResult;
  readonly routeBase: string;
  readonly newWorkLabel: string;
  readonly newWorkRoute: string;
  readonly accent: "blue" | "cyan";
}

export const OFFICE_FLOORS: readonly OfficeFloorDef[] = [
  {
    id: "dev",
    code: "DEV",
    name: "Desenvolvimento",
    missionFloor: "DEVELOPMENT",
    routeBase: "/app/floor/dev",
    newWorkLabel: "Nova demanda",
    newWorkRoute: "/app/floor/dev/command/new",
    accent: "blue",
  },
  {
    id: "automation",
    code: "AUT",
    name: "Automação",
    missionFloor: "AUTOMATION",
    routeBase: "/app/floor/automation",
    newWorkLabel: "Delegar automação",
    newWorkRoute: "/app/floor/automation/command",
    accent: "cyan",
  },
];

export function findFloor(id: string): OfficeFloorDef {
  return OFFICE_FLOORS.find((f) => f.id === id) ?? OFFICE_FLOORS[0]!;
}
