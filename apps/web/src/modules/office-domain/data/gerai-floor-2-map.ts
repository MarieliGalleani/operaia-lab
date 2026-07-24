/**
 * 2º andar da Geraí — agência criativa no Campus (mapa separado, ligado por portal).
 *
 * Mesma geometria da maquete OperaIA.lab (células 9×7, grade 3×2). Identidade
 * de salas voltada a atendimento, criação e campanha — sem tocar no Lab.
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
import { GERAI_ENTRANCE_MAP_ID } from "./campus-ids";
import { campusPortal } from "./campus-portal";
import { decorationsForKind, prop, REST_KINDS } from "./office-room-kits";

const CELL_W = 9;
const CELL_H = 7;
const GAP_X = 2;
const GAP_Y = 2;
const ORIGIN_X = 1;
const ORIGIN_Y = 1;
const FLOOR_ID = "floor-2";

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
 * Planta Geraí 2º:
 * Cima: Atendimento · Direção Criativa · Briefing
 * Baixo: Studio Design · Copy & Conteúdo · Lounge Criativo
 */
const LAYOUT: readonly (readonly (Cell | null)[])[] = [
  [
    cell("atendimento", "Atendimento", "reception", true),
    cell("direcao", "Direcao Criativa", "executive"),
    cell("briefing", "Sala de Briefing", "meeting"),
  ],
  [
    cell("studio", "Studio Design", "ui-design", true),
    cell("copy", "Copy & Conteudo", "product"),
    cell("lounge", "Lounge Criativo", "lounge", true),
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

/** Paleta um pouco mais quente/criativa que o Lab, mesmos kits. */
const STYLE: Record<string, RoomStyle> = {
  reception: { floor: 0xf3e4d4, wall: 0xc46a45 },
  executive: { floor: 0xf0e0cc, wall: 0x9a6540 },
  meeting: { floor: 0xe8e4f0, wall: 0x6a5f8a },
  "ui-design": { floor: 0xe4f0ec, wall: 0x3f8a78 },
  product: { floor: 0xf0ebe0, wall: 0xa67c4a },
  lounge: { floor: 0xf4e6d8, wall: 0xc46a45 },
};

const DEFAULT_STYLE: RoomStyle = { floor: 0xece3d0, wall: 0x9c7a52 };

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

/** Postos da equipe Geraí (usados por gerai-actors). */
export const GERAI_F2_STATIONS = {
  nova: stationOf("direcao"),
  pixel: stationOf("studio", 2, 1),
  verse: stationOf("copy"),
  spark: stationOf("atendimento", 3, 2),
  muse: stationOf("studio", 5, 1),
} as const;

function buildSpawnPoints(): SpawnPointDef[] {
  const points: SpawnPointDef[] = [];
  const atendimento = ROOM_BOUNDS.atendimento ?? cellBounds(0, 0);
  points.push({
    id: "elevator-in",
    col: atendimento.col + 1,
    row: atendimento.row + 1,
    facing: "s",
  });
  points.push({
    id: "from-entrance",
    col: atendimento.col + 3,
    row: atendimento.row + 2,
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

/** Elevador atalho temporário → sede OperaIA.lab (migração). */
const ELEVATOR_TO_LAB: EntityBlueprint = {
  id: "elevator-to-lab",
  ref: "portal-door",
  components: {
    transform: {
      col: (ROOM_BOUNDS.atendimento?.col ?? ORIGIN_X) + 1,
      row: 0,
    },
    renderable: { spriteId: "door", layer: "walls", visible: true },
    portal: {
      portalId: "elevator-to-lab",
      target: { mapId: "office", spawnPointId: "elevator-lab" },
      mode: "walk",
      label: "Elevador · OperaIA.lab",
    },
    interactable: {
      kind: "portal",
      radiusTiles: 1,
      enabled: true,
      label: "Voltar ao Lab",
    },
  },
};

/** Saída canônica → entrada oficial da sede Geraí → Campus. */
const TO_ENTRANCE = campusPortal({
  id: "interior-to-gerai-entrance",
  col: (ROOM_BOUNDS.atendimento?.col ?? ORIGIN_X) + 4,
  row: 0,
  targetMapId: GERAI_ENTRANCE_MAP_ID,
  targetSpawnId: "from-interior",
  label: "Entrada Geraí",
  interactLabel: "Ir à entrada",
});

const FLOOR_2: FloorDef = {
  id: FLOOR_ID,
  name: "Geraí — 2º andar",
  level: 2,
  size: { cols: MAP_COLS, rows: MAP_ROWS },
  areas: AREAS,
  entities: [...ambientProps(), ELEVATOR_TO_LAB, TO_ENTRANCE],
  spawnPoints: buildSpawnPoints(),
};

export const GERAI_F2_MAP_ID = "gerai-f2";

export const GERAI_F2_MAP: MapManifest = {
  id: GERAI_F2_MAP_ID,
  name: "Geraí — 2º andar",
  themeId: CORPORATE_THEME_ID,
  tileWidth: 64,
  tileHeight: 32,
  floors: [FLOOR_2],
  defaultSpawn: { floorId: FLOOR_ID, spawnPointId: "atendimento" },
  rules: { interactionRadiusTiles: 1 },
  ambient: { musicId: "office-ambient", lightingId: "daylight" },
};
