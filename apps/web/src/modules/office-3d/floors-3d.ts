/**
 * Escritorio 3D (Interface 3.0) — planta de cada andar.
 *
 * Cada andar tem as suas salas e mesas. Quem senta em cada mesa vem do
 * elenco do andar (`cast`); o status (trabalhando/livre) vem ao vivo do
 * Command Center na view. Nada aqui e dado de negocio: so layout.
 */

export type Office3DFloorId = "portaria" | "dev" | "automation" | "marketing" | "store-flow";

export type RoomKind =
  | "meeting"
  | "servers"
  | "lounge"
  | "copa"
  | "kanban"
  | "ceo"
  | "reception"
  | "control"
  | "studio"
  | "shop"
  | "approval";

export interface RoomDef {
  readonly kind: RoomKind;
  readonly x: number;
  readonly z: number;
}

export interface DeskDef {
  readonly x: number;
  readonly z: number;
}

export interface CastMember {
  /** employeeId da API quando existe; elenco proprio (Store Flow) usa um id local. */
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly color: string;
  readonly skin: string;
  readonly hair: string;
  readonly longHair?: boolean;
  readonly robot?: boolean;
  /** true quando o status vem do Command Center (Equipe Digital). */
  readonly live: boolean;
}

export interface Office3DFloor {
  readonly id: Office3DFloorId;
  readonly code: string;
  readonly title: string;
  readonly accent: string;
  readonly rooms: readonly RoomDef[];
  readonly desks: readonly DeskDef[];
  /** Quem trabalha neste andar, na ordem das mesas. */
  readonly cast: readonly string[];
  /** Quem senta na sala do CEO (so o terreo). */
  readonly ceo?: string;
  /** Pontos para onde quem esta livre costuma ir (copa, lounge). */
  readonly hangouts: readonly (readonly [number, number])[];
}

export const CAST: Readonly<Record<string, CastMember>> = {
  "operaia-ceo": { id: "operaia-ceo", name: "Opera", role: "CEO · coordena o prédio", color: "#5b8cff", skin: "#f1d3b3", hair: "#2b1d14", live: true },
  aurora: { id: "aurora", name: "Aurora", role: "Finanças", color: "#c3e86b", skin: "#c98f63", hair: "#1b130d", live: true },
  themis: { id: "themis", name: "Themis", role: "Jurídico", color: "#e0a3ff", skin: "#e8b98f", hair: "#5a3a22", live: true },
  "cto-mag": { id: "cto-mag", name: "Mag", role: "CTO · coordena o andar", color: "#8b7bff", skin: "#f1d3b3", hair: "#20160f", live: true },
  luna: { id: "luna", name: "Luna", role: "Product Designer", color: "#ff8fb1", skin: "#e8b98f", hair: "#3a2318", longHair: true, live: true },
  nexus: { id: "nexus", name: "Nexus", role: "Product Manager", color: "#ffb35c", skin: "#c98f63", hair: "#111111", live: true },
  atlas: { id: "atlas", name: "Atlas", role: "Especialista em automação", color: "#3ddc97", skin: "#8d5a3b", hair: "#0e0a08", live: true },
  orion: { id: "orion", name: "Orion", role: "Operações", color: "#5cd0ff", skin: "#f1d3b3", hair: "#7a4b23", live: true },
  mercurio: { id: "mercurio", name: "Mercúrio", role: "Marketing", color: "#ffd25c", skin: "#e8b98f", hair: "#2b1d14", live: true },
  "sf-driele": { id: "sf-driele", name: "Driele", role: "Escritora de ofertas", color: "#ff9d7a", skin: "#c98f63", hair: "#4a2a16", longHair: true, live: false },
  "sf-flow": { id: "sf-flow", name: "Flow", role: "Robô de ofertas", color: "#5cd0ff", skin: "#c9d3e6", hair: "#c9d3e6", robot: true, live: false },
};

export const OFFICE_3D_FLOORS: Readonly<Record<Office3DFloorId, Office3DFloor>> = {
  portaria: {
    id: "portaria",
    code: "T",
    title: "TÉRREO · PORTARIA",
    accent: "#c4b2ff",
    rooms: [
      { kind: "ceo", x: -7.5, z: -3.8 },
      { kind: "reception", x: 3, z: 3.6 },
      { kind: "meeting", x: 7.5, z: -4 },
      { kind: "lounge", x: -3, z: 4.4 },
    ],
    desks: [
      { x: -1.5, z: -3.2 },
      { x: 1.5, z: -3.2 },
    ],
    cast: ["aurora", "themis"],
    ceo: "operaia-ceo",
    hangouts: [[-3, 3.2], [3, 2.2]],
  },
  dev: {
    id: "dev",
    code: "01",
    title: "ANDAR 01 · DESENVOLVIMENTO",
    accent: "#5b8cff",
    rooms: [
      { kind: "meeting", x: 7, z: -4 },
      { kind: "servers", x: -9.5, z: 4 },
      { kind: "lounge", x: 2.5, z: 4.2 },
      { kind: "copa", x: 8.2, z: 4.6 },
      { kind: "kanban", x: -2, z: -6.85 },
    ],
    desks: [
      { x: -7, z: -3.2 },
      { x: -4, z: -3.2 },
      { x: -1, z: -3.2 },
      { x: -7, z: 0.2 },
      { x: -4, z: 0.2 },
      { x: -1, z: 0.2 },
    ],
    cast: ["cto-mag", "luna", "nexus"],
    hangouts: [[6.8, 3.2], [2.5, 2.8]],
  },
  automation: {
    id: "automation",
    code: "02",
    title: "ANDAR 02 · AUTOMAÇÃO",
    accent: "#3ddc97",
    rooms: [
      { kind: "control", x: -6.5, z: -4.2 },
      { kind: "servers", x: -9.5, z: 4 },
      { kind: "meeting", x: 7, z: -4 },
      { kind: "copa", x: 8, z: 4.6 },
    ],
    desks: [
      { x: -1.5, z: 0.5 },
      { x: 1.5, z: 0.5 },
      { x: -1.5, z: 3.3 },
      { x: 1.5, z: 3.3 },
    ],
    cast: ["atlas", "orion"],
    hangouts: [[6.6, 3.2], [-6.5, -2.2]],
  },
  marketing: {
    id: "marketing",
    code: "03",
    title: "ANDAR 03 · MARKETING",
    accent: "#ffd25c",
    rooms: [
      { kind: "studio", x: -7, z: -3.5 },
      { kind: "meeting", x: 7, z: -4 },
      { kind: "lounge", x: 3.5, z: 4 },
      { kind: "copa", x: -8, z: 4.6 },
    ],
    desks: [
      { x: -1.5, z: -2.5 },
      { x: 1.5, z: -2.5 },
      { x: -1.5, z: 0.8 },
      { x: 1.5, z: 0.8 },
    ],
    cast: ["mercurio"],
    hangouts: [[-8, 3.2], [3.5, 2.6]],
  },
  "store-flow": {
    id: "store-flow",
    code: "04",
    title: "ANDAR 04 · STORE FLOW",
    accent: "#ff9d7a",
    rooms: [
      { kind: "shop", x: -7, z: -3.5 },
      { kind: "approval", x: 6.5, z: -4 },
      { kind: "lounge", x: 4, z: 4 },
      { kind: "copa", x: -8, z: 4.6 },
    ],
    desks: [
      { x: -1.5, z: -2.5 },
      { x: 1.5, z: -2.5 },
      { x: -1.5, z: 0.8 },
      { x: 1.5, z: 0.8 },
    ],
    cast: ["sf-driele", "sf-flow"],
    hangouts: [[-5, 1.8], [4, 2.6]],
  },
};

export function floorCastIds(floor: Office3DFloor): readonly string[] {
  return floor.ceo ? [floor.ceo, ...floor.cast] : floor.cast;
}
