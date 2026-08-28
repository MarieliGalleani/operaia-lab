/**
 * ESCRITORIO como DADO — Sede OperaIA.lab (studio compacto, ~6 pessoas).
 *
 * Camada: DOMINIO. Apenas um `MapManifest` generico. A engine nao conhece
 * "escritorio": lê paredes/portas/janelas/piso de `area.enclosure`, mobília de
 * `area.decorations` e decoração solta de `floor.entities`.
 *
 * Planta enxuta (grade 3×2 = 6 ambientes com identidade). Ambientes privativos
 * (CEO, Reunião, Lab IA) têm paredes; áreas colaborativas (Recepção, Espaço de
 * Trabalho, Lounge) ficam abertas — leves e aconchegantes. A "parede em L" do
 * prédio (topo + esquerda) é aproveitada com decoração encostada.
 */

import type { TileRect } from "../../virtual-world/contracts/ids";
import type {
  AreaBlueprint,
  AreaEnclosure,
  EntityBlueprint,
  FloorDef,
  MapManifest,
  SpawnPointDef,
} from "../../virtual-world/contracts/map";
import { CORPORATE_THEME_ID } from "./corporate-theme";
import { CAMPUS_PLAZA_MAP_ID } from "./campus-ids";
import { decorationsForKind, prop, REST_KINDS } from "./office-room-kits";

// —— Geometria da grade (planta enxuta) ——————————————————————————————————————
const CELL_W = 9;
const CELL_H = 7;
const GAP_X = 2;
const GAP_Y = 2;
const ORIGIN_X = 1;
const ORIGIN_Y = 1;
const FLOOR_ID = "ground";

interface Cell {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  /** Ambiente aberto (sem paredes) — colaborativo/arejado. */
  readonly open?: boolean;
}

function cell(id: string, name: string, kind: string, open = false): Cell {
  return { id, name, kind, open };
}

/**
 * 6 ambientes. Cima: Recepção · CEO · Reunião. Baixo: Espaço de Trabalho ·
 * Lab IA · Lounge. Abertos: recepção, espaço de trabalho e lounge.
 */
const LAYOUT: readonly (readonly (Cell | null)[])[] = [
  [
    cell("reception", "Recepcao", "reception", true),
    cell("executive", "Sala CEO", "executive"),
    cell("meeting", "Sala de Reuniao", "meeting"),
  ],
  [
    cell("workspace", "Espaco de Trabalho", "development", true),
    cell("ai-lab", "Laboratorio de IA", "ai-lab"),
    cell("lounge", "Lounge & Cafe", "lounge", true),
  ],
];

const COLS = LAYOUT.reduce((m, r) => Math.max(m, r.length), 0);
const ROWS = LAYOUT.length;
const MAP_COLS = ORIGIN_X + COLS * (CELL_W + GAP_X) + 1;
const MAP_ROWS = ORIGIN_Y + ROWS * (CELL_H + GAP_Y) + 2;

function cellBounds(c: number, r: number): TileRect {
  return {
    col: ORIGIN_X + c * (CELL_W + GAP_X),
    row: ORIGIN_Y + r * (CELL_H + GAP_Y),
    w: CELL_W,
    h: CELL_H,
  };
}

// —— Identidade visual por departamento (piso + acento de parede) ————————————
interface RoomStyle {
  readonly floor: number;
  readonly wall: number;
}

const STYLE: Record<string, RoomStyle> = {
  reception: { floor: 0xf1e7d2, wall: 0xb5623c },
  executive: { floor: 0xefe3cf, wall: 0x8a6b4a },
  meeting: { floor: 0xe6eaf0, wall: 0x5f7f9a },
  development: { floor: 0xe0edf0, wall: 0x3f8aa3 },
  "ai-lab": { floor: 0xd7e5f4, wall: 0x2f5f8a },
  lounge: { floor: 0xf1e6d4, wall: 0xb5623c },
};

const DEFAULT_STYLE: RoomStyle = { floor: 0xece3d0, wall: 0x9c7a52 };

/** Enclausuramento: paredes ao fundo com porta (N/O) + janela (N), ou aberto. */
function enclosureFor(c: Cell): AreaEnclosure {
  const style = STYLE[c.kind] ?? DEFAULT_STYLE;
  if (c.open) {
    return { walls: false, color: style.wall, floorColor: style.floor };
  }
  return {
    walls: true,
    color: style.wall,
    floorColor: style.floor,
    doors: [
      { side: "n", at: 0.4, width: 0.26 },
      { side: "w", at: 0.4, width: 0.26 },
    ],
    windows: [{ side: "n", at: 0.72, width: 0.16 }],
  };
}

function buildArea(c: Cell, bounds: TileRect): AreaBlueprint {
  const tags = ["room"];
  if (REST_KINDS.has(c.kind)) {
    tags.push("rest");
  }
  return {
    id: c.id,
    name: c.name,
    kind: c.kind,
    bounds,
    tags,
    decorations: decorationsForKind(c.kind, bounds.col, bounds.row, bounds.w, bounds.h),
    enclosure: enclosureFor(c),
  };
}

// —— Montagem da planta ————————————————————————————————————————————————————
const AREAS: AreaBlueprint[] = [];
const ROOM_BOUNDS: Record<string, TileRect> = {};

for (let r = 0; r < LAYOUT.length; r += 1) {
  const rowCells = LAYOUT[r]!;
  for (let c = 0; c < rowCells.length; c += 1) {
    const seed = rowCells[c];
    if (!seed) {
      continue;
    }
    const bounds = cellBounds(c, r);
    ROOM_BOUNDS[seed.id] = bounds;
    AREAS.push(buildArea(seed, bounds));
  }
}

/** Tile de trabalho de um agente (posto dentro de uma sala). */
function stationOf(roomId: string, dx = 2, dy = 1): { col: number; row: number; floorId: string } {
  const b = ROOM_BOUNDS[roomId] ?? cellBounds(0, 0);
  return { col: b.col + dx, row: b.row + dy, floorId: FLOOR_ID };
}

/** Estações fixas dos 9 agentes reais (usado por office-actors). CEO/CTO privativos. */
export const OFFICE_STATIONS = {
  opera: stationOf("executive"),
  mag: stationOf("ai-lab"),
  atlas: stationOf("workspace", 1, 1),
  luna: stationOf("workspace", 3, 1),
  aurora: stationOf("workspace", 5, 1),
  nexus: stationOf("meeting", 2, 1),
  themis: stationOf("meeting", 5, 1),
  mercurio: stationOf("lounge", 2, 1),
  orion: stationOf("lounge", 5, 1),
} as const;

/** Spawn no centro de cada sala + entrada da recepção. */
function buildSpawnPoints(): SpawnPointDef[] {
  const points: SpawnPointDef[] = [];
  const reception = ROOM_BOUNDS.reception ?? cellBounds(0, 0);
  points.push({ id: "entrance", col: reception.col + 4, row: reception.row + CELL_H, facing: "s" });
  points.push({
    id: "elevator-lab",
    col: reception.col + 6,
    row: reception.row + 1,
    facing: "s",
  });
  points.push({
    id: "from-campus",
    col: reception.col + 2,
    row: reception.row + 2,
    facing: "s",
  });
  for (const [id, b] of Object.entries(ROOM_BOUNDS)) {
    points.push({ id, col: b.col + Math.floor(CELL_W / 2), row: b.row + Math.floor(CELL_H / 2) });
  }
  return points;
}

/**
 * Decoração encostada na "parede em L" do prédio (topo + esquerda) + plantas no
 * corredor central. Dá vida e aproveita as bordas sem poluir as salas.
 */
function ambientProps(): EntityBlueprint[] {
  const props: EntityBlueprint[] = [];
  // Parede superior (row 0): quadros/plantas ao longo do topo.
  for (let x = 2; x < MAP_COLS - 1; x += 4) {
    props.push(prop(x % 8 === 0 ? "plant-tall" : "painting", x, 0));
  }
  // Parede esquerda (col 0): estantes/plantas ao longo da lateral.
  for (let y = 2; y < MAP_ROWS - 1; y += 4) {
    props.push(prop(y % 8 === 0 ? "bookshelf" : "plant", 0, y));
  }
  // Corredor central (cruz): plantas e luminárias para circulação viva.
  const midY = ORIGIN_Y + CELL_H; // faixa horizontal entre as duas fileiras
  for (let c = 1; c < COLS; c += 1) {
    const x = ORIGIN_X + c * (CELL_W + GAP_X) - 1;
    props.push(prop("plant", x, ORIGIN_Y + 2));
    props.push(prop("lamp", x, midY + 1));
    props.push(prop("plant", x, MAP_ROWS - 3));
  }
  props.push(prop("watercooler", ORIGIN_X + 2, midY));
  props.push(prop("plant-tall", MAP_COLS - 3, midY));
  return props;
}

const FRONT_DOOR: EntityBlueprint = {
  id: "front-door",
  ref: "portal-door",
  components: {
    transform: {
      col: (ROOM_BOUNDS.reception?.col ?? ORIGIN_X) + 1,
      row: 0,
    },
    renderable: { spriteId: "door", layer: "walls", visible: true },
    portal: {
      portalId: "front-door",
      target: { mapId: CAMPUS_PLAZA_MAP_ID, spawnPointId: "entrance-lab" },
      mode: "walk",
      label: "Opera Campus",
    },
    interactable: { kind: "portal", radiusTiles: 1, enabled: true, label: "Sair para o Campus" },
  },
};

const GROUND_FLOOR: FloorDef = {
  id: FLOOR_ID,
  name: "Sede OperaIA.lab",
  level: 0,
  size: { cols: MAP_COLS, rows: MAP_ROWS },
  areas: AREAS,
  entities: [...ambientProps(), FRONT_DOOR],
  spawnPoints: buildSpawnPoints(),
};

export const OFFICE_MAP_ID = "office";

export const OFFICE_MAP: MapManifest = {
  id: OFFICE_MAP_ID,
  name: "Sede OperaIA.lab",
  themeId: CORPORATE_THEME_ID,
  tileWidth: 64,
  tileHeight: 32,
  floors: [GROUND_FLOOR],
  defaultSpawn: { floorId: FLOOR_ID, spawnPointId: "reception" },
  rules: { interactionRadiusTiles: 1 },
  ambient: { musicId: "office-ambient", lightingId: "daylight" },
};
