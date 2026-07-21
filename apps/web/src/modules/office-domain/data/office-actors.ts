/**
 * Atores do escritorio como DADO generico (ActorDescriptor).
 *
 * Camada: DOMINIO. Cargo SEMPRE antes do nome. Cada profissional tem
 * `homeTile` = estação (mesa/PC). `stateId` AVAILABLE/IDLE → roam para zonas
 * com tag "rest". Demais estados ficam no posto (vagueio curto).
 */

import type { ActorDescriptor } from "../../virtual-world/contracts/providers";
import { OFFICE_STATIONS } from "./office-map";

export const OFFICE_ACTORS: readonly ActorDescriptor[] = [
  {
    id: "opera",
    name: "CEO — Opera",
    kind: "agent",
    homeTile: OFFICE_STATIONS.opera,
    stateId: "STRATEGY",
    spriteId: "char-opera",
    tags: ["executive", "leader", "station:executive"],
  },
  {
    id: "mag",
    name: "CTO — Mag",
    kind: "agent",
    homeTile: OFFICE_STATIONS.mag,
    stateId: "CODING",
    spriteId: "char-mag",
    tags: ["technology", "station:cto"],
  },
  {
    id: "atlas",
    name: "Product Manager — Atlas",
    kind: "agent",
    homeTile: OFFICE_STATIONS.atlas,
    stateId: "DOCUMENTING",
    spriteId: "char-atlas",
    tags: ["product", "station:product"],
  },
  {
    id: "luna",
    name: "UX/Product Designer — Luna",
    kind: "agent",
    homeTile: OFFICE_STATIONS.luna,
    stateId: "WORKING",
    spriteId: "char-luna",
    tags: ["design", "station:design"],
  },
  {
    id: "aurora",
    name: "Marketing — Aurora",
    kind: "agent",
    homeTile: OFFICE_STATIONS.aurora,
    stateId: "AVAILABLE",
    spriteId: "char-aurora",
    tags: ["marketing", "station:marketing"],
  },
];
