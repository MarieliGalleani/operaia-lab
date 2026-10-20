import type { MissionFloorResult } from "@/lib/office-floor";

/**
 * Andares do Escritorio Operacional (P1.21). Dev e Automacao tem dado
 * real por tras (originToFloor); Marketing existe como andar na UI
 * porque foi pedido explicitamente, mas nao tem nenhum dado real
 * ainda — nenhuma tela dele finge ter numero que nao existe.
 */
export interface OfficeFloorDef {
  readonly id: "dev" | "automation" | "marketing" | "store-flow" | "negocio";
  readonly code: string;
  readonly name: string;
  readonly meta: string;
  readonly missionFloor: MissionFloorResult | null;
  readonly todayRoute: string;
  /** Escritorio 3D do andar (Interface 3.0). */
  readonly officeRoute: string;
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
    officeRoute: "/app/floor/dev/office",
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
    officeRoute: "/app/floor/automation/office",
    workRoute: "/app/floor/automation/automations",
    teamRoute: "/app/floor/automation/team",
    signalsRoute: "/app/floor/automation/signals",
    // CTA abre o briefing do Atlas (antes apontava para a propria Hoje).
    newWorkRoute: "/app/floor/automation/clients",
    newWorkLabel: "Briefing para o Atlas",
  },
  {
    id: "marketing",
    code: "03",
    name: "Marketing",
    meta: "agência",
    missionFloor: null,
    todayRoute: "/app/floor/marketing/command",
    officeRoute: "/app/floor/marketing/office",
    workRoute: "/app/floor/marketing/work",
    teamRoute: "/app/floor/marketing/team",
    signalsRoute: "/app/floor/marketing/signals",
    // CTA abre o briefing do Mercurio (antes apontava para a propria Hoje).
    newWorkRoute: "/app/floor/marketing/work",
    newWorkLabel: "Briefing para o Mercúrio",
  },
  {
    // Andar de afiliados com elenco proprio (Flow + Driele). Nao usa a
    // Equipe Digital nem o fluxo de missoes: roda o pipeline do pacote
    // @operaia/store-flow e espera aprovacao humana na Sala de Aprovacao.
    id: "store-flow",
    code: "04",
    name: "Store Flow",
    meta: "afiliados",
    missionFloor: null,
    todayRoute: "/app/floor/store-flow/command",
    officeRoute: "/app/floor/store-flow/office",
    workRoute: "/app/floor/store-flow/work",
    teamRoute: "/app/floor/store-flow/team",
    signalsRoute: "/app/floor/store-flow/signals",
    // Nova rodada agora sai do Painel (CSV direto pelo app).
    newWorkRoute: "/app/floor/store-flow/command",
    newWorkLabel: "Nova rodada",
  },
  {
    // Planilha de vendas -> receita, margem, clientes em risco e prioridade.
    // Dado real: so o que a planilha enviada traz (nada de conector fingido).
    id: "negocio",
    code: "05",
    name: "Negócio",
    meta: "vendas e margem",
    missionFloor: null,
    todayRoute: "/app/floor/negocio/command",
    officeRoute: "/app/floor/negocio/office",
    workRoute: "/app/floor/negocio/work",
    teamRoute: "/app/floor/negocio/team",
    signalsRoute: "/app/floor/negocio/signals",
    newWorkRoute: "/app/floor/negocio/work",
    newWorkLabel: "Enviar planilha",
  },
];

export function findFloor(id: string): OfficeFloorDef {
  return OFFICE_FLOORS.find((f) => f.id === id) ?? OFFICE_FLOORS[0]!;
}

export function floorIdFromPath(path: string): OfficeFloorDef["id"] {
  if (path.startsWith("/app/floor/automation")) return "automation";
  if (path.startsWith("/app/floor/marketing")) return "marketing";
  if (path.startsWith("/app/floor/store-flow")) return "store-flow";
  if (path.startsWith("/app/floor/negocio")) return "negocio";
  return "dev";
}

/** Terreo do predio (Portaria): visao geral + escritorio do CEO. */
export const PORTARIA = {
  code: "T",
  name: "Portaria",
  meta: "térreo",
  homeRoute: "/app/portaria",
  officeRoute: "/app/portaria/office",
} as const;

export function isPortariaPath(path: string): boolean {
  return path === PORTARIA.homeRoute || path.startsWith(`${PORTARIA.homeRoute}/`);
}

/** Ordem do elevador: andar mais alto primeiro, terreo por ultimo. */
export const ELEVATOR_ORDER: readonly OfficeFloorDef[] = [...OFFICE_FLOORS].reverse();
