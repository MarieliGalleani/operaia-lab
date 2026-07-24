/**
 * Praça Central — hub dinâmico do Opera Campus.
 *
 * Distribui para Residentes via CAMPUS_RESIDENT_ENTRANCES (extensível).
 * Não liga Residentes à Recepção: só praça ↔ recepção + praça ↔ sedes.
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
import { CAMPUS_RESIDENT_ENTRANCES } from "./campus-resident-entrances";
import { prop } from "./office-room-kits";

const FLOOR_ID = "ground";
const COLS = 24;
const ROWS = 16;
/** Fileira de fachadas de Residentes (sul). */
const FACADE_ROW = ROWS - 1;
const FACADE_START_COL = 4;
const FACADE_STRIDE = 6;

const PLAZA_AREA: AreaBlueprint = {
  id: "central-plaza",
  name: "Praca Central",
  kind: "garden",
  bounds: { col: 2, row: 2, w: 20, h: 11 },
  tags: ["room", "campus", "shared", "rest"],
  decorations: [
    prop("plant-tall", 4, 4),
    prop("plant-tall", 19, 4),
    prop("plant", 8, 7),
    prop("plant", 15, 7),
    prop("lamp", 11, 5),
    prop("beanbag", 10, 8),
    prop("beanbag", 13, 8),
    prop("coffee-table", 11, 9),
  ],
  enclosure: {
    walls: false,
    color: 0x6a8f5a,
    floorColor: 0xe4ecd8,
  },
};

function ambient(): EntityBlueprint[] {
  const props: EntityBlueprint[] = [];
  for (let x = 2; x < COLS - 1; x += 5) {
    props.push(prop("plant", x, 1));
  }
  props.push(prop("plant-tall", 1, 8));
  props.push(prop("plant-tall", COLS - 2, 8));
  return props;
}

function residentFacades(): EntityBlueprint[] {
  return CAMPUS_RESIDENT_ENTRANCES.map((entry) =>
    campusPortal({
      id: entry.portalId,
      col: FACADE_START_COL + entry.slot * FACADE_STRIDE,
      row: FACADE_ROW,
      targetMapId: entry.targetMapId,
      targetSpawnId: entry.targetSpawnId,
      label: entry.label,
      interactLabel: `Entrar · ${entry.label}`,
    }),
  );
}

const TO_RECEPTION = campusPortal({
  id: "plaza-to-reception",
  col: 11,
  row: 0,
  targetMapId: CAMPUS_RECEPTION_MAP_ID,
  targetSpawnId: "from-plaza",
  label: "Recepção Principal",
  interactLabel: "Voltar à Recepção",
});

const SPAWNS: SpawnPointDef[] = [
  { id: "center", col: 11, row: 7, facing: "s" },
  { id: "from-reception", col: 11, row: 2, facing: "s" },
  { id: "entrance-lab", col: FACADE_START_COL, row: FACADE_ROW - 2, facing: "n" },
  { id: "entrance-gerai", col: FACADE_START_COL + FACADE_STRIDE, row: FACADE_ROW - 2, facing: "n" },
];

const FLOOR: FloorDef = {
  id: FLOOR_ID,
  name: "Praça Central",
  level: 0,
  size: { cols: COLS, rows: ROWS },
  areas: [PLAZA_AREA],
  entities: [...ambient(), TO_RECEPTION, ...residentFacades()],
  spawnPoints: SPAWNS,
};

export const CAMPUS_PLAZA_MAP: MapManifest = {
  id: CAMPUS_PLAZA_MAP_ID,
  name: "Opera Campus — Praça Central",
  themeId: CORPORATE_THEME_ID,
  tileWidth: 64,
  tileHeight: 32,
  floors: [FLOOR],
  defaultSpawn: { floorId: FLOOR_ID, spawnPointId: "center" },
  rules: { interactionRadiusTiles: 1 },
  ambient: { musicId: "office-ambient", lightingId: "daylight" },
};
