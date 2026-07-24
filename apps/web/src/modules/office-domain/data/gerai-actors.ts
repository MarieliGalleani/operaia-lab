/**
 * Atores do 2º andar da Geraí (agência criativa).
 *
 * Cargo antes do nome. Sprites reaproveitam o tema corporate (capsula se faltar).
 */

import type { ActorDescriptor } from "../../virtual-world/contracts/providers";
import { GERAI_F2_STATIONS } from "./gerai-floor-2-map";

export const GERAI_F2_ACTORS: readonly ActorDescriptor[] = [
  {
    id: "nova",
    name: "Diretora Criativa — Nova",
    kind: "agent",
    homeTile: GERAI_F2_STATIONS.nova,
    stateId: "STRATEGY",
    spriteId: "char-opera",
    tags: ["executive", "creative", "station:direcao"],
  },
  {
    id: "pixel",
    name: "Design Lead — Pixel",
    kind: "agent",
    homeTile: GERAI_F2_STATIONS.pixel,
    stateId: "WORKING",
    spriteId: "char-luna",
    tags: ["design", "station:studio"],
  },
  {
    id: "muse",
    name: "Art Director — Muse",
    kind: "agent",
    homeTile: GERAI_F2_STATIONS.muse,
    stateId: "WORKING",
    spriteId: "char-atlas",
    tags: ["design", "station:studio"],
  },
  {
    id: "verse",
    name: "Copywriter — Verse",
    kind: "agent",
    homeTile: GERAI_F2_STATIONS.verse,
    stateId: "DOCUMENTING",
    spriteId: "char-mag",
    tags: ["copy", "station:copy"],
  },
  {
    id: "spark",
    name: "Atendimento — Spark",
    kind: "agent",
    homeTile: GERAI_F2_STATIONS.spark,
    stateId: "AVAILABLE",
    spriteId: "char-aurora",
    tags: ["client", "station:atendimento"],
  },
];
