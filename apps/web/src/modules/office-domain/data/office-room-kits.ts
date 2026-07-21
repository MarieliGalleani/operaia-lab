/**
 * Kits de mobília por tipo de sala (dado de domínio).
 *
 * Cada função retorna EntityBlueprints genéricos. A engine só vê `ref` de prefab.
 * Manter este arquivo separado do layout do mapa evita arquivos longos.
 */

import type { EntityBlueprint } from "../../virtual-world/contracts/map";

/** Kinds que reaproveitam o kit de outro kind equivalente. */
const KIND_ALIAS: Record<string, string> = {
  frontend: "development",
  backend: "development",
  "meeting-large": "meeting",
  "meeting-small": "meeting",
  servers: "datacenter",
  maker: "innovation",
  external: "garden",
};

/** Cria uma decoração (prop) posicionada num tile. `ref` casa com o prefab. */
export function prop(ref: string, col: number, row: number): EntityBlueprint {
  return {
    ref,
    components: {
      transform: { col, row },
      renderable: { spriteId: ref, layer: "objects", visible: true },
    },
  };
}

/** Estação completa: mesa + monitor + cadeira (posto de um profissional). */
export function workstation(col: number, row: number): EntityBlueprint[] {
  return [prop("monitor", col, row), prop("chair", col, row + 1)];
}

interface KitCtx {
  readonly c: number;
  readonly r: number;
  readonly w: number;
  readonly h: number;
  readonly cc: number;
  readonly cr: number;
}

function ctx(col: number, row: number, w: number, h: number): KitCtx {
  return {
    c: col,
    r: row,
    w,
    h,
    cc: col + Math.floor(w / 2),
    cr: row + Math.floor(h / 2),
  };
}

/** Decoração completa de uma sala a partir do `kind` (string de dado). */
export function decorationsForKind(
  kind: string,
  col: number,
  row: number,
  w: number,
  h: number,
): EntityBlueprint[] {
  const k = ctx(col, row, w, h);
  // Reaproveita kits equivalentes (mantém identidade sem duplicar mobília).
  const resolved = KIND_ALIAS[kind] ?? kind;
  switch (resolved) {
    case "hr":
      return [
        prop("rug", k.cc, k.cr),
        ...workstation(k.c + 2, k.r + 1),
        prop("sofa", k.cc, k.r + k.h - 2),
        prop("coffee-table", k.cc, k.r + k.h - 3),
        prop("cabinet", k.c + k.w - 2, k.r + 1),
        prop("painting", k.c + 1, k.r + 1),
        prop("plant-tall", k.c + k.w - 2, k.r + k.h - 2),
      ];
    case "reception":
      return [
        prop("reception-desk", k.cc, k.r + 1),
        prop("rug", k.cc, k.cr),
        prop("plant-tall", k.c + k.w - 2, k.r + 1),
        prop("plant", k.c + 1, k.r + 1),
        prop("sofa", k.c + 2, k.r + k.h - 2),
        prop("coffee-table", k.c + 2, k.r + k.h - 3),
        prop("plant", k.c + k.w - 2, k.r + k.h - 2),
        prop("painting", k.cc, k.r + 1),
      ];
    case "executive":
      return [
        prop("rug", k.cc, k.cr),
        ...workstation(k.c + 2, k.r + 1),
        prop("painting", k.cc, k.r + 1),
        prop("plant-tall", k.c + k.w - 2, k.r + 1),
        prop("bookshelf", k.c + k.w - 2, k.r + k.h - 2),
        prop("sofa", k.cc, k.r + k.h - 2),
        prop("coffee-table", k.cc, k.r + k.h - 3),
        prop("lamp", k.c + 1, k.r + k.h - 2),
      ];
    case "cto":
      return [
        prop("rug", k.cc, k.cr),
        ...workstation(k.c + 2, k.r + 1),
        ...workstation(k.c + 5, k.r + 1),
        prop("whiteboard", k.c + k.w - 2, k.r + 1),
        prop("server-rack", k.c + 1, k.r + k.h - 2),
        prop("plant-tall", k.c + k.w - 2, k.r + k.h - 2),
        prop("cabinet", k.cc, k.r + k.h - 2),
      ];
    case "product":
      return [
        prop("meeting-table", k.cc, k.cr),
        prop("chair", k.c + 1, k.cr),
        prop("chair", k.c + k.w - 2, k.cr),
        prop("chair", k.cc, k.r + 1),
        prop("chair", k.cc, k.r + k.h - 2),
        prop("whiteboard", k.c + k.w - 2, k.r + 1),
        prop("plant-tall", k.c + 1, k.r + k.h - 2),
        ...workstation(k.c + 2, k.r + 1),
      ];
    case "ui-design":
      return [
        prop("rug", k.cc, k.cr),
        ...workstation(k.c + 2, k.r + 1),
        ...workstation(k.c + k.w - 3, k.r + 1),
        prop("painting", k.cc, k.r + 1),
        prop("plant-tall", k.c + k.w - 2, k.r + k.h - 2),
        prop("bookshelf", k.c + 1, k.r + k.h - 2),
        prop("coffee-table", k.cc, k.r + k.h - 2),
      ];
    case "development":
      return [
        prop("rug", k.cc, k.cr),
        ...workstation(k.c + 1, k.r + 1),
        ...workstation(k.c + 3, k.r + 1),
        ...workstation(k.c + 5, k.r + 1),
        ...workstation(k.c + 1, k.r + 3),
        ...workstation(k.c + 3, k.r + 3),
        prop("whiteboard", k.c + k.w - 2, k.r + 1),
        prop("plant", k.c + k.w - 2, k.r + k.h - 2),
        prop("watercooler", k.cc, k.r + k.h - 2),
      ];
    case "qa":
      return [
        prop("rug", k.cc, k.cr),
        ...workstation(k.c + 2, k.r + 1),
        ...workstation(k.c + 5, k.r + 1),
        prop("whiteboard", k.c + 1, k.r + k.h - 2),
        prop("cabinet", k.c + k.w - 2, k.r + 1),
        prop("plant", k.c + k.w - 2, k.r + k.h - 2),
      ];
    case "devops":
      return [
        prop("rug", k.cc, k.cr),
        ...workstation(k.c + 2, k.r + 1),
        prop("server-rack", k.c + k.w - 2, k.r + 1),
        prop("server-rack", k.c + k.w - 2, k.r + 3),
        prop("monitor", k.c + 4, k.r + 1),
        prop("chair", k.c + 4, k.r + 2),
        prop("cabinet", k.c + 1, k.r + k.h - 2),
        prop("plant", k.cc, k.r + k.h - 2),
      ];
    case "commercial":
      return [
        prop("rug", k.cc, k.cr),
        ...workstation(k.c + 2, k.r + 1),
        prop("meeting-table", k.cc, k.r + k.h - 3),
        prop("chair", k.cc - 1, k.r + k.h - 2),
        prop("chair", k.cc + 1, k.r + k.h - 2),
        prop("plant-tall", k.c + k.w - 2, k.r + 1),
        prop("painting", k.c + 1, k.r + 1),
      ];
    case "marketing":
      return [
        prop("rug", k.cc, k.cr),
        ...workstation(k.c + 2, k.r + 1),
        prop("tv", k.cc, k.r + 1),
        prop("whiteboard", k.c + k.w - 2, k.r + 1),
        prop("sofa", k.cc, k.r + k.h - 2),
        prop("plant-tall", k.c + k.w - 2, k.r + k.h - 2),
        prop("plant", k.c + 1, k.r + k.h - 2),
      ];
    case "finance":
      return [
        prop("rug", k.cc, k.cr),
        ...workstation(k.c + 2, k.r + 1),
        ...workstation(k.c + 5, k.r + 1),
        prop("cabinet", k.c + k.w - 2, k.r + 1),
        prop("bookshelf", k.c + 1, k.r + k.h - 2),
        prop("plant", k.c + k.w - 2, k.r + k.h - 2),
        prop("lamp", k.cc, k.r + k.h - 2),
      ];
    case "legal":
      return [
        prop("rug", k.cc, k.cr),
        ...workstation(k.c + 2, k.r + 1),
        prop("bookshelf", k.c + k.w - 2, k.r + 1),
        prop("bookshelf", k.c + k.w - 2, k.r + 3),
        prop("cabinet", k.c + 1, k.r + k.h - 2),
        prop("plant-tall", k.cc, k.r + k.h - 2),
        prop("painting", k.cc, k.r + 1),
      ];
    case "meeting":
      return [
        prop("meeting-table", k.cc, k.cr),
        prop("chair", k.c + 1, k.cr),
        prop("chair", k.c + k.w - 2, k.cr),
        prop("chair", k.cc - 1, k.r + 1),
        prop("chair", k.cc + 1, k.r + 1),
        prop("chair", k.cc - 1, k.r + k.h - 2),
        prop("chair", k.cc + 1, k.r + k.h - 2),
        prop("whiteboard", k.c + k.w - 2, k.r + 1),
        prop("tv", k.c + 1, k.r + 1),
        prop("plant", k.c + 1, k.r + k.h - 2),
      ];
    case "auditorium":
      return [
        prop("rug", k.cc, k.cr),
        prop("tv", k.cc, k.r + 1),
        prop("hologram", k.cc, k.r + 2),
        prop("chair", k.c + 2, k.r + 3),
        prop("chair", k.c + 4, k.r + 3),
        prop("chair", k.c + 6, k.r + 3),
        prop("chair", k.c + 2, k.r + 4),
        prop("chair", k.c + 4, k.r + 4),
        prop("chair", k.c + 6, k.r + 4),
        prop("plant-tall", k.c + 1, k.r + 1),
        prop("plant-tall", k.c + k.w - 2, k.r + 1),
      ];
    case "library":
      return [
        prop("rug", k.cc, k.cr),
        prop("bookshelf", k.c + 1, k.r + 1),
        prop("bookshelf", k.c + 3, k.r + 1),
        prop("bookshelf", k.c + 5, k.r + 1),
        prop("bookshelf", k.c + 1, k.r + k.h - 2),
        prop("bookshelf", k.c + 3, k.r + k.h - 2),
        prop("coffee-table", k.cc, k.cr),
        prop("sofa", k.c + k.w - 3, k.cr),
        prop("lamp", k.c + k.w - 2, k.r + 1),
        prop("plant", k.c + k.w - 2, k.r + k.h - 2),
      ];
    case "ai-lab":
      return [
        prop("rug", k.cc, k.cr),
        ...workstation(k.c + 2, k.r + 1),
        ...workstation(k.c + 5, k.r + 1),
        prop("hologram", k.cc, k.cr),
        prop("server-rack", k.c + k.w - 2, k.r + 1),
        prop("whiteboard", k.c + 1, k.r + k.h - 2),
        prop("plant-tall", k.c + k.w - 2, k.r + k.h - 2),
      ];
    case "datacenter":
      return [
        prop("server-rack", k.c + 2, k.r + 1),
        prop("server-rack", k.c + 4, k.r + 1),
        prop("server-rack", k.c + 6, k.r + 1),
        prop("server-rack", k.c + 2, k.r + 3),
        prop("server-rack", k.c + 4, k.r + 3),
        prop("server-rack", k.c + 6, k.r + 3),
        prop("monitor", k.c + 1, k.r + k.h - 2),
        prop("chair", k.c + 1, k.r + k.h - 3),
        prop("cabinet", k.c + k.w - 2, k.r + k.h - 2),
      ];
    case "innovation":
      return [
        prop("rug", k.cc, k.cr),
        prop("whiteboard", k.c + 1, k.r + 1),
        prop("whiteboard", k.c + k.w - 2, k.r + 1),
        prop("beanbag", k.c + 2, k.cr),
        prop("beanbag", k.c + 4, k.cr),
        prop("meeting-table", k.cc, k.r + k.h - 3),
        prop("hologram", k.cc, k.r + 2),
        prop("plant-tall", k.c + k.w - 2, k.r + k.h - 2),
        prop("lamp", k.c + 1, k.r + k.h - 2),
      ];
    case "cafeteria":
      return [
        prop("rug", k.cc, k.cr),
        prop("coffee-machine", k.c + 1, k.r + 1),
        prop("meeting-table", k.cc, k.cr),
        prop("chair", k.cc - 1, k.cr + 1),
        prop("chair", k.cc + 1, k.cr + 1),
        prop("sofa", k.c + k.w - 3, k.r + k.h - 2),
        prop("plant-tall", k.c + k.w - 2, k.r + 1),
        prop("plant", k.c + 1, k.r + k.h - 2),
        prop("vending", k.c + 3, k.r + 1),
      ];
    case "kitchen":
      return [
        prop("coffee-machine", k.cc, k.r + 1),
        prop("cabinet", k.c + 1, k.r + 1),
        prop("cabinet", k.c + k.w - 2, k.r + 1),
        prop("watercooler", k.c + 1, k.r + k.h - 2),
        prop("plant", k.c + k.w - 2, k.r + k.h - 2),
        prop("coffee-table", k.cc, k.cr),
      ];
    case "lounge":
      return [
        prop("rug", k.cc, k.cr),
        prop("sofa", k.c + 2, k.cr),
        prop("sofa", k.c + k.w - 3, k.cr),
        prop("coffee-table", k.cc, k.cr),
        prop("beanbag", k.c + 1, k.r + k.h - 2),
        prop("beanbag", k.c + 3, k.r + k.h - 2),
        prop("tv", k.cc, k.r + 1),
        prop("plant-tall", k.c + k.w - 2, k.r + 1),
        prop("plant", k.c + 1, k.r + 1),
        prop("lamp", k.c + k.w - 2, k.r + k.h - 2),
      ];
    case "games-room":
      return [
        prop("rug", k.cc, k.cr),
        prop("arcade", k.c + 1, k.r + 1),
        prop("arcade", k.c + 3, k.r + 1),
        prop("pool-table", k.cc, k.cr),
        prop("foosball", k.c + k.w - 3, k.r + 2),
        prop("tv", k.c + k.w - 2, k.r + 1),
        prop("sofa", k.c + 2, k.r + k.h - 2),
        prop("beanbag", k.c + 5, k.r + k.h - 2),
        prop("coffee-table", k.c + 3, k.r + k.h - 2),
        prop("plant", k.c + 1, k.r + k.h - 2),
        prop("bookshelf", k.c + k.w - 2, k.r + k.h - 2),
        ...workstation(k.c + 1, k.r + 3),
      ];
    case "garden":
      return [
        prop("plant-tall", k.c + 1, k.r + 1),
        prop("plant-tall", k.c + 3, k.r + 1),
        prop("plant-tall", k.c + 5, k.r + 1),
        prop("plant", k.c + 2, k.cr),
        prop("plant", k.c + 4, k.cr),
        prop("plant-tall", k.c + 1, k.r + k.h - 2),
        prop("plant-tall", k.c + k.w - 2, k.r + k.h - 2),
        prop("beanbag", k.cc, k.cr),
        prop("coffee-table", k.cc, k.cr + 1),
        prop("lamp", k.c + k.w - 3, k.r + 2),
      ];
    case "terrace":
      return [
        prop("plant-tall", k.c + 1, k.r + 1),
        prop("plant-tall", k.c + k.w - 2, k.r + 1),
        prop("sofa", k.cc, k.cr),
        prop("coffee-table", k.cc, k.cr + 1),
        prop("beanbag", k.c + 2, k.r + k.h - 2),
        prop("plant", k.c + 4, k.r + k.h - 2),
        prop("lamp", k.c + k.w - 2, k.r + k.h - 2),
      ];
    case "rest":
      return [
        prop("rug", k.cc, k.cr),
        prop("sofa", k.c + 2, k.cr),
        prop("beanbag", k.c + 5, k.cr),
        prop("bookshelf", k.c + 1, k.r + 1),
        prop("tv", k.cc, k.r + 1),
        prop("plant-tall", k.c + k.w - 2, k.r + 1),
        prop("coffee-table", k.cc, k.r + k.h - 2),
        prop("lamp", k.c + 1, k.r + k.h - 2),
      ];
    case "corridor":
      return [];
    default:
      return [
        prop("rug", k.cc, k.cr),
        ...workstation(k.c + 1, k.r + 1),
        prop("plant", k.c + k.w - 2, k.r + 1),
        prop("bookshelf", k.c + k.w - 2, k.r + k.h - 2),
      ];
  }
}

/** Kinds cujo tag inclui "rest" (ociosos podem caminhar até aqui). */
export const REST_KINDS = new Set([
  "lounge",
  "games-room",
  "cafeteria",
  "kitchen",
  "library",
  "garden",
  "terrace",
  "external",
  "rest",
]);
