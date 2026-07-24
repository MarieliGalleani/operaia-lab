/**
 * Entrada oficial da sede Geraí (Residente).
 *
 * Ponte Campus ↔ interior existente (`gerai-f2`). Interior evolui depois.
 */

import type {
  AreaBlueprint,
  EntityBlueprint,
  FloorDef,
  MapManifest,
  SpawnPointDef,
} from "../../virtual-world/contracts/map";
import { CORPORATE_THEME_ID } from "./corporate-theme";
import { CAMPUS_PLAZA_MAP_ID, GERAI_ENTRANCE_MAP_ID } from "./campus-ids";
import { campusPortal } from "./campus-portal";
import { decorationsForKind, prop } from "./office-room-kits";

const FLOOR_ID = "ground";
const COLS = 16;
const ROWS = 11;
const GERAI_INTERIOR_MAP_ID = "gerai-f2";

const LOBBY: AreaBlueprint = {
  id: "gerai-lobby",
  name: "Entrada Gerai",
  kind: "reception",
  bounds: { col: 2, row: 2, w: 12, h: 7 },
  tags: ["room", "resident", "gerai"],
  decorations: decorationsForKind("reception", 2, 2, 12, 7),
  enclosure: {
    walls: false,
    color: 0xc46a45,
    floorColor: 0xf3e4d4,
  },
};

function ambient(): EntityBlueprint[] {
  return [
    prop("plant-tall", 1, 1),
    prop("plant-tall", COLS - 2, 1),
    prop("painting", 7, 1),
    prop("lamp", 3, ROWS - 2),
    prop("lamp", COLS - 4, ROWS - 2),
  ];
}

const TO_PLAZA = campusPortal({
  id: "gerai-entrance-to-plaza",
  col: 3,
  row: 0,
  targetMapId: CAMPUS_PLAZA_MAP_ID,
  targetSpawnId: "entrance-gerai",
  label: "Opera Campus",
  interactLabel: "Voltar à Praça",
});

const TO_INTERIOR = campusPortal({
  id: "gerai-entrance-to-interior",
  col: 12,
  row: ROWS - 1,
  targetMapId: GERAI_INTERIOR_MAP_ID,
  targetSpawnId: "from-entrance",
  label: "Interior Geraí",
  interactLabel: "Entrar na sede",
});

const SPAWNS: SpawnPointDef[] = [
  { id: "from-plaza", col: 4, row: 3, facing: "s" },
  { id: "to-interior", col: 11, row: ROWS - 3, facing: "s" },
  { id: "from-interior", col: 11, row: ROWS - 3, facing: "n" },
];

const FLOOR: FloorDef = {
  id: FLOOR_ID,
  name: "Geraí — Entrada",
  level: 0,
  size: { cols: COLS, rows: ROWS },
  areas: [LOBBY],
  entities: [...ambient(), TO_PLAZA, TO_INTERIOR],
  spawnPoints: SPAWNS,
};

export const GERAI_ENTRANCE_MAP: MapManifest = {
  id: GERAI_ENTRANCE_MAP_ID,
  name: "Geraí — Entrada",
  themeId: CORPORATE_THEME_ID,
  tileWidth: 64,
  tileHeight: 32,
  floors: [FLOOR],
  defaultSpawn: { floorId: FLOOR_ID, spawnPointId: "from-plaza" },
  rules: { interactionRadiusTiles: 1 },
  ambient: { musicId: "office-ambient", lightingId: "daylight" },
};
