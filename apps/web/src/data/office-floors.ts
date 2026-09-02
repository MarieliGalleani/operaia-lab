import type { MissionFloorResult } from "@/lib/office-floor";

/**
 * Andares do Escritorio Operacional (P1.21). Dev e Automacao tem dado
 * real por tras (originToFloor); Marketing existe como andar na UI
 * porque foi pedido explicitamente, mas nao tem nenhum dado real
 * ainda — nenhuma tela dele finge ter numero que nao existe.
 */
export interface OfficeFloorDef {
  readonly id: "dev" | "automation" | "marketing";
  readonly code: string;
  readonly name: string;
  readonly meta: string;
  readonly missionFloor: MissionFloorResult | null;
  readonly todayRoute: string;
  readonly workRoute: string;
  readonly teamRoute: string;
  readonly signalsRoute: string;
  readonly newWorkRoute: string;
  readonly newWorkLabel: string;
}

export const OFFICE_FLOORS: readonly OfficeFloorDef[] = [
  {
    id: "dev",
    code: "01",
    name: "Desenvolvimento",
    meta: "equipe digital",
    missionFloor: "DEVELOPMENT",
    todayRoute: "/app/floor/dev/command",
    workRoute: "/app/floor/dev/workspaces",
    teamRoute: "/app/floor/dev/team",
    signalsRoute: "/app/floor/dev/signals",
    newWorkRoute: "/app/floor/dev/command/new",
    newWorkLabel: "Nova demanda",
  },
  {
    id: "automation",
    code: "02",
    name: "Automação",
    meta: "escritório",
    missionFloor: "AUTOMATION",
    todayRoute: "/app/floor/automation/command",
    workRoute: "/app/floor/automation/automations",
    teamRoute: "/app/floor/automation/team",
    signalsRoute: "/app/floor/automation/signals",
    newWorkRoute: "/app/floor/automation/command",
    newWorkLabel: "Delegar automação",
  },
  {
    id: "marketing",
    code: "03",
    name: "Marketing",
    meta: "agência",
    missionFloor: null,
    todayRoute: "/app/floor/marketing/command",
    workRoute: "/app/floor/marketing/work",
    teamRoute: "/app/floor/marketing/team",
    signalsRoute: "/app/floor/marketing/signals",
    newWorkRoute: "/app/floor/marketing/command",
    newWorkLabel: "Delegar campanha",
  },
];

export function findFloor(id: string): OfficeFloorDef {
  return OFFICE_FLOORS.find((f) => f.id === id) ?? OFFICE_FLOORS[0]!;
}

export function floorIdFromPath(path: string): OfficeFloorDef["id"] {
  if (path.startsWith("/app/floor/automation")) return "automation";
  if (path.startsWith("/app/floor/marketing")) return "marketing";
  return "dev";
}
