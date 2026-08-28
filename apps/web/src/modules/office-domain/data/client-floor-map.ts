/**
 * Fabrica de andares/entradas de clientes reais — mesma planta da sede
 * (recepcao/direcao/reuniao/espaco de trabalho/lab de IA/lounge), povoada
 * sempre pelo MESMO elenco real (real-agents.ts). Um cliente novo = um
 * item em client-floors-registry.ts, sem inventar personagem novo.
 */

import type { TileCoord, TileRect } from "../../virtual-world/contracts/ids";
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
import { campusPortal } from "./campus-portal";
import { decorationsForKind, prop, REST_KINDS } from "./office-room-kits";

const CELL_W = 9;
const CELL_H = 7;
const GAP_X = 2;
const GAP_Y = 2;
const ORIGIN_X = 1;
const ORIGIN_Y = 1;
const ENTRANCE_COLS = 16;
const ENTRANCE_ROWS = 11;

interface Cell {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly open?: boolean;
}

function cell(id: string, name: string, kind: string, open = false): Cell {
  return { id, name, kind, open };
}

/** Mesma planta da sede (6 salas, grade 3x2) reaproveitada por cliente. */
const LAYOUT: readonly (readonly (Cell | null)[])[] = [
  [
    cell("reception", "Recepção", "reception", true),
    cell("executive", "Direção", "executive"),
    cell("meeting", "Sala de Reunião", "meeting"),
  ],
  [
    cell("workspace", "Espaço de Trabalho", "development", true),
    cell("ai-lab", "Laboratório de IA", "ai-lab"),
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

/** Uma paleta por cliente — só pra diferenciar visualmente, mesma planta. */
const PALETTES: readonly Record<string, RoomStyle>[] = [
  {
    reception: { floor: 0xe6eef4, wall: 0x3f6f9a },
    executive: { floor: 0xe0e6ee, wall: 0x365f82 },
    meeting: { floor: 0xe6eaf0, wall: 0x5f7f9a },
    development: { floor: 0xdfeef0, wall: 0x2f8aa3 },
    "ai-lab": { floor: 0xd7e5f4, wall: 0x2f5f8a },
    lounge: { floor: 0xe9eef2, wall: 0x3f6f9a },
  },
  {
    reception: { floor: 0xf3e4d4, wall: 0xc46a45 },
    executive: { floor: 0xf0e0cc, wall: 0x9a6540 },
    meeting: { floor: 0xe8e4f0, wall: 0x6a5f8a },
    development: { floor: 0xe4f0ec, wall: 0x3f8a78 },
    "ai-lab": { floor: 0xf0ebe0, wall: 0xa67c4a },
    lounge: { floor: 0xf4e6d8, wall: 0xc46a45 },
  },
  {
    reception: { floor: 0xecdff0, wall: 0x8a4fa0 },
    executive: { floor: 0xe6d8ec, wall: 0x76418a },
    meeting: { floor: 0xe4e0f0, wall: 0x6a5f8a },
    development: { floor: 0xe0ecec, wall: 0x3f8a8a },
    "ai-lab": { floor: 0xdde4f4, wall: 0x4f5f9a },
    lounge: { floor: 0xefe0f0, wall: 0x8a4fa0 },
  },
  {
    reception: { floor: 0xf0ece0, wall: 0xa08a3f },
    executive: { floor: 0xece4d4, wall: 0x8a723f },
    meeting: { floor: 0xe8e4d8, wall: 0x7f7a5f },
    development: { floor: 0xe4ecdc, wall: 0x6a8a3f },
    "ai-lab": { floor: 0xdcece0, wall: 0x3f8a5f },
    lounge: { floor: 0xf0e8d4, wall: 0xa08a3f },
  },
  {
    reception: { floor: 0xf4e0e0, wall: 0xb04f4f },
    executive: { floor: 0xecd8d8, wall: 0x9a4040 },
    meeting: { floor: 0xe8dede, wall: 0x8a5f5f },
    development: { floor: 0xecdfe0, wall: 0xa35f6f },
    "ai-lab": { floor: 0xe4d4dc, wall: 0x8a4f6a },
    lounge: { floor: 0xf0dde0, wall: 0xb04f4f },
  },
];

const DEFAULT_STYLE: RoomStyle = { floor: 0xece3d0, wall: 0x9c7a52 };

function enclosureFor(c: Cell, palette: Record<string, RoomStyle>): AreaEnclosure {
  const style = palette[c.kind] ?? DEFAULT_STYLE;
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

function buildArea(
  c: Cell,
  bounds: TileRect,
  palette: Record<string, RoomStyle>,
): AreaBlueprint {
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
    enclosure: enclosureFor(c, palette),
  };
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

/** Posições dos 9 agentes reais dentro da planta genérica de andar. */
function buildStations(
  roomBounds: Record<string, TileRect>,
  floorId: string,
): Record<string, TileCoord> {
  function stationOf(roomId: string, dx: number, dy: number): TileCoord {
    const b = roomBounds[roomId] ?? cellBounds(0, 0);
    return { col: b.col + dx, row: b.row + dy, floorId };
  }
  return {
    opera: stationOf("executive", 2, 1),
    mag: stationOf("ai-lab", 2, 1),
    luna: stationOf("workspace", 1, 1),
    nexus: stationOf("workspace", 3, 1),
    atlas: stationOf("workspace", 5, 1),
    themis: stationOf("meeting", 2, 1),
    mercurio: stationOf("meeting", 5, 1),
    orion: stationOf("lounge", 2, 1),
    aurora: stationOf("reception", 4, 1),
  };
}

export interface ClientFloorBuild {
  readonly workspaceId: string;
  readonly entranceMapId: string;
  readonly floorMapId: string;
  readonly entranceMap: MapManifest;
  readonly floorMap: MapManifest;
  /** Estações do elenco real neste andar — os ActorDescriptor completos são
   *  montados em tempo de carregamento (office-entity-provider.ts) para
   *  incluir o status ao vivo de cada agente. */
  readonly stations: Readonly<Record<string, TileCoord>>;
}

/**
 * Gera o par entrada+andar de um cliente real, reaproveitando a planta da
 * sede e o elenco real completo. `paletteIndex` só varia a cor do andar.
 */
export function buildClientFloor(config: {
  readonly workspaceId: string;
  readonly displayName: string;
  readonly level: number;
  readonly paletteIndex: number;
}): ClientFloorBuild {
  const { workspaceId, displayName, level, paletteIndex } = config;
  const palette = PALETTES[paletteIndex % PALETTES.length]!;
  const floorId = `client-${workspaceId}`;
  const entranceMapId = `${workspaceId}-entrance`;
  const floorMapId = `${workspaceId}-floor`;

  const areas: AreaBlueprint[] = [];
  const roomBounds: Record<string, TileRect> = {};
  for (let r = 0; r < LAYOUT.length; r += 1) {
    const rowCells = LAYOUT[r]!;
    for (let c = 0; c < rowCells.length; c += 1) {
      const seed = rowCells[c];
      if (!seed) continue;
      const bounds = cellBounds(c, r);
      roomBounds[seed.id] = bounds;
      areas.push(buildArea(seed, bounds, palette));
    }
  }

  const stations = buildStations(roomBounds, floorId);

  function buildFloorSpawnPoints(): SpawnPointDef[] {
    const points: SpawnPointDef[] = [];
    const reception = roomBounds.reception ?? cellBounds(0, 0);
    points.push({
      id: "from-entrance",
      col: reception.col + 2,
      row: reception.row + 2,
      facing: "s",
    });
    for (const [id, b] of Object.entries(roomBounds)) {
      points.push({
        id,
        col: b.col + Math.floor(CELL_W / 2),
        row: b.row + Math.floor(CELL_H / 2),
      });
    }
    return points;
  }

  const TO_ENTRANCE = campusPortal({
    id: `${floorId}-to-entrance`,
    col: (roomBounds.reception?.col ?? ORIGIN_X) + 4,
    row: 0,
    targetMapId: entranceMapId,
    targetSpawnId: "from-interior",
    label: `Entrada ${displayName}`,
    interactLabel: "Sair para o saguão",
  });

  const floorDef: FloorDef = {
    id: floorId,
    name: `${displayName} — Escritório`,
    level,
    size: { cols: MAP_COLS, rows: MAP_ROWS },
    areas,
    entities: [...ambientProps(), TO_ENTRANCE],
    spawnPoints: buildFloorSpawnPoints(),
  };

  const floorMap: MapManifest = {
    id: floorMapId,
    name: `${displayName} — Escritório`,
    themeId: CORPORATE_THEME_ID,
    tileWidth: 64,
    tileHeight: 32,
    floors: [floorDef],
    defaultSpawn: { floorId, spawnPointId: "from-entrance" },
    rules: { interactionRadiusTiles: 1 },
    ambient: { musicId: "office-ambient", lightingId: "daylight" },
  };

  // Entrada (lobby) — ponte Campus <-> andar do cliente.
  const entranceFloorId = "ground";
  const lobbyStyle = palette.reception ?? DEFAULT_STYLE;
  const LOBBY: AreaBlueprint = {
    id: `${workspaceId}-lobby`,
    name: `Entrada ${displayName}`,
    kind: "reception",
    bounds: { col: 2, row: 2, w: 12, h: 7 },
    tags: ["room", "resident", workspaceId],
    decorations: decorationsForKind("reception", 2, 2, 12, 7),
    enclosure: { walls: false, color: lobbyStyle.wall, floorColor: lobbyStyle.floor },
  };

  function entranceAmbient(): EntityBlueprint[] {
    return [
      prop("plant-tall", 1, 1),
      prop("plant-tall", ENTRANCE_COLS - 2, 1),
      prop("painting", 7, 1),
      prop("lamp", 3, ENTRANCE_ROWS - 2),
      prop("lamp", ENTRANCE_COLS - 4, ENTRANCE_ROWS - 2),
    ];
  }

  const TO_PLAZA = campusPortal({
    id: `${workspaceId}-entrance-to-plaza`,
    col: 3,
    row: 0,
    targetMapId: CAMPUS_PLAZA_MAP_ID,
    targetSpawnId: `entrance-${workspaceId}`,
    label: "Opera Campus",
    interactLabel: "Voltar à Praça",
  });

  const TO_INTERIOR = campusPortal({
    id: `${workspaceId}-entrance-to-interior`,
    col: 12,
    row: ENTRANCE_ROWS - 1,
    targetMapId: floorMapId,
    targetSpawnId: "from-entrance",
    label: `Interior ${displayName}`,
    interactLabel: "Entrar no escritório",
  });

  const entranceFloor: FloorDef = {
    id: entranceFloorId,
    name: `${displayName} — Entrada`,
    level: 0,
    size: { cols: ENTRANCE_COLS, rows: ENTRANCE_ROWS },
    areas: [LOBBY],
    entities: [...entranceAmbient(), TO_PLAZA, TO_INTERIOR],
    spawnPoints: [
      { id: "from-plaza", col: 4, row: 3, facing: "s" },
      { id: "from-interior", col: 11, row: ENTRANCE_ROWS - 3, facing: "n" },
    ],
  };

  const entranceMap: MapManifest = {
    id: entranceMapId,
    name: `${displayName} — Entrada`,
    themeId: CORPORATE_THEME_ID,
    tileWidth: 64,
    tileHeight: 32,
    floors: [entranceFloor],
    defaultSpawn: { floorId: entranceFloorId, spawnPointId: "from-plaza" },
    rules: { interactionRadiusTiles: 1 },
    ambient: { musicId: "office-ambient", lightingId: "daylight" },
  };

  return { workspaceId, entranceMapId, floorMapId, entranceMap, floorMap, stations };
}
