/**
 * Recepção Principal do Opera Campus.
 *
 * Apenas recebe o usuário. Distribuição para Residentes = Praça Central.
 */

import type {
  AreaBlueprint,
  EntityBlueprint,
  FloorDef,
  MapManifest,
  SpawnPointDef,
} from "../../virtual-world/contracts/map";
import { CORPORATE_THEME_ID } from "./corporate-theme";
import { CAMPUS_PLAZA_MAP_ID, CAMPUS_RECEPTION_MAP_ID } from "./campus-ids";
import { campusPortal } from "./campus-portal";
import { decorationsForKind, prop } from "./office-room-kits";

const FLOOR_ID = "ground";
const COLS = 18;
const ROWS = 12;

const AREA: AreaBlueprint = {
  id: "main-reception",
  name: "Recepcao Principal",
  kind: "reception",
  bounds: { col: 2, row: 2, w: 14, h: 8 },
  tags: ["room", "campus", "shared"],
  decorations: decorationsForKind("reception", 2, 2, 14, 8),
  enclosure: {
    walls: false,
    color: 0xb5623c,
    floorColor: 0xf1e7d2,
  },
};

function ambient(): EntityBlueprint[] {
  return [
    prop("plant-tall", 1, 1),
    prop("plant-tall", COLS - 2, 1),
    prop("plant", 1, ROWS - 2),
    prop("plant", COLS - 2, ROWS - 2),
    prop("painting", 4, 1),
    prop("painting", 12, 1),
    prop("lamp", 8, ROWS - 2),
  ];
}

const TO_PLAZA = campusPortal({
  id: "reception-to-plaza",
  col: 9,
  row: ROWS - 1,
  targetMapId: CAMPUS_PLAZA_MAP_ID,
  targetSpawnId: "from-reception",
  label: "Praça Central",
  interactLabel: "Ir à Praça Central",
});

const SPAWNS: SpawnPointDef[] = [
  { id: "arrival", col: 9, row: 4, facing: "s" },
  { id: "from-plaza", col: 9, row: ROWS - 3, facing: "n" },
];

const FLOOR: FloorDef = {
  id: FLOOR_ID,
  name: "Recepção Principal",
  level: 0,
  size: { cols: COLS, rows: ROWS },
  areas: [AREA],
  entities: [...ambient(), TO_PLAZA],
  spawnPoints: SPAWNS,
};

export const CAMPUS_RECEPTION_MAP: MapManifest = {
  id: CAMPUS_RECEPTION_MAP_ID,
  name: "Opera Campus — Recepção Principal",
  themeId: CORPORATE_THEME_ID,
  tileWidth: 64,
  tileHeight: 32,
  floors: [FLOOR],
  defaultSpawn: { floorId: FLOOR_ID, spawnPointId: "arrival" },
  rules: { interactionRadiusTiles: 1 },
  ambient: { musicId: "office-ambient", lightingId: "daylight" },
};
