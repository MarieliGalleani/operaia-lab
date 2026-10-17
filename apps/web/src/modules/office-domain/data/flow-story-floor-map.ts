/**
 * 1º andar da sede — Flow Story (marketing de afiliados).
 *
 * Copia do molde do 2º andar da Geraí (celulas 9×7, grade 3×2), ligada a
 * recepcao da sede por elevador. O nivel 1 era o "reservado" da sede.
 *
 * Elenco proprio do andar: Flow (Robô de Ofertas) e Story (Escritora) —
 * pacote @operaia/flow-story. Andar separado: nao usa o elenco da Equipe
 * Digital nem entra na delegacao do CEO.
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
import { decorationsForKind, prop, REST_KINDS } from "./office-room-kits";

const CELL_W = 9;
const CELL_H = 7;
const GAP_X = 2;
const GAP_Y = 2;
const ORIGIN_X = 1;
const ORIGIN_Y = 1;
const FLOOR_ID = "flow-story";

interface Cell {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly open?: boolean;
}

function cell(id: string, name: string, kind: string, open = false): Cell {
  return { id, name, kind, open };
}

/**
 * Planta Flow Story:
 * Cima: Recepcao · Radar de Ofertas (Flow) · Sala de Aprovacao
 * Baixo: Redacao (Story) · Estudio de Video · Lounge
 */
const LAYOUT: readonly (readonly (Cell | null)[])[] = [
  [
    cell("recepcao", "Recepcao Flow Story", "reception", true),
    cell("radar", "Radar de Ofertas", "ai-lab"),
    cell("aprovacao", "Sala de Aprovacao", "meeting"),
  ],
  [
    cell("redacao", "Redacao", "marketing", true),
    cell("estudio", "Estudio de Video", "ui-design"),
    cell("lounge", "Lounge", "lounge", true),
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

interface RoomStyle {
  readonly floor: number;
  readonly wall: number;
}

/** Paleta propria: azul-petroleo (fluxo) + coral (historia). */
const STYLE: Record<string, RoomStyle> = {
  reception: { floor: 0xe3eff0, wall: 0x2f7a80 },
  "ai-lab": { floor: 0xdfeaf2, wall: 0x2c5f86 },
  meeting: { floor: 0xf2e6e2, wall: 0x9a5a4a },
  marketing: { floor: 0xf6e4dc, wall: 0xd06a52 },
  "ui-design": { floor: 0xe6eef0, wall: 0x3f7f8a },
  lounge: { floor: 0xf4eadf, wall: 0xc9774f },
};

const DEFAULT_STYLE: RoomStyle = { floor: 0xe8ecec, wall: 0x4f7a7f };

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
  const tags = ["room", "flow-story"];
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

function stationOf(roomId: string, dx = 2, dy = 1): { col: number; row: number; floorId: string } {
  const b = ROOM_BOUNDS[roomId] ?? cellBounds(0, 0);
  return { col: b.col + dx, row: b.row + dy, floorId: FLOOR_ID };
}

/** Postos do elenco Flow Story (usados por flow-story-actors). */
export const FLOW_STORY_STATIONS = {
  flow: stationOf("radar", 3, 2),
  story: stationOf("redacao", 3, 2),
} as const;

function buildSpawnPoints(): SpawnPointDef[] {
  const points: SpawnPointDef[] = [];
  const recepcao = ROOM_BOUNDS.recepcao ?? cellBounds(0, 0);
  points.push({
    id: "elevator-in",
    col: recepcao.col + 2,
    row: recepcao.row + 1,
    facing: "s",
  });
  for (const [id, b] of Object.entries(ROOM_BOUNDS)) {
    points.push({
      id,
      col: b.col + Math.floor(CELL_W / 2),
      row: b.row + Math.floor(CELL_H / 2),
    });
  }
  return points;
}

function ambientProps(): EntityBlueprint[] {
  const props: EntityBlueprint[] = [];
  for (let x = 2; x < MAP_COLS - 1; x += 4) {
    props.push(prop(x % 8 === 0 ? "plant-tall" : "painting", x, 0));
  }
  for (let y = 2; y < MAP_ROWS - 1; y += 4) {
    props.push(prop(y % 8 === 0 ? "bookshelf" : "plant", 0, y));
  }
  const midY = ORIGIN_Y + CELL_H;
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

/** Elevador de volta à recepção da sede (térreo). */
const ELEVATOR_TO_LAB: EntityBlueprint = {
  id: "flow-story-elevator-to-lab",
  ref: "portal-door",
  components: {
    transform: {
      col: (ROOM_BOUNDS.recepcao?.col ?? ORIGIN_X) + 2,
      row: 0,
    },
    renderable: { spriteId: "door", layer: "walls", visible: true },
    portal: {
      portalId: "flow-story-elevator-to-lab",
      target: { mapId: "office", spawnPointId: "elevator-lab" },
      mode: "walk",
      label: "Elevador · Térreo",
    },
    interactable: {
      kind: "portal",
      radiusTiles: 1,
      enabled: true,
      label: "Descer para a sede",
    },
  },
};

const FLOOR_1: FloorDef = {
  id: FLOOR_ID,
  name: "Flow Story — 1º andar",
  level: 1,
  size: { cols: MAP_COLS, rows: MAP_ROWS },
  areas: AREAS,
  entities: [...ambientProps(), ELEVATOR_TO_LAB],
  spawnPoints: buildSpawnPoints(),
};

export const FLOW_STORY_MAP_ID = "flow-story";

export const FLOW_STORY_MAP: MapManifest = {
  id: FLOW_STORY_MAP_ID,
  name: "Flow Story — 1º andar",
  themeId: CORPORATE_THEME_ID,
  tileWidth: 64,
  tileHeight: 32,
  floors: [FLOOR_1],
  defaultSpawn: { floorId: FLOOR_ID, spawnPointId: "elevator-in" },
  rules: { interactionRadiusTiles: 1 },
  ambient: { musicId: "office-ambient", lightingId: "daylight" },
};
