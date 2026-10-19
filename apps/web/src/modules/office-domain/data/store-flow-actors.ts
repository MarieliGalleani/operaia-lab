/**
 * Atores do 1º andar — Store Flow.
 *
 * Elenco proprio do andar (pacote @operaia/store-flow), nao a Equipe Digital.
 * Cargo antes do nome, como no resto do Campus. Sprites reaproveitam o tema
 * corporate ate ter arte propria.
 */

import type { ActorDescriptor } from "../../virtual-world/contracts/providers";
import { STORE_FLOW_STATIONS } from "./store-flow-floor-map";

export const STORE_FLOW_ACTORS: readonly ActorDescriptor[] = [
  {
    id: "flow",
    name: "Robô de Ofertas — Flow",
    kind: "agent",
    homeTile: STORE_FLOW_STATIONS.flow,
    stateId: "WORKING",
    spriteId: "char-atlas", // TODO: sprite proprio
    tags: ["store-flow", "affiliate", "curation", "station:radar"],
  },
  {
    id: "driele",
    name: "Escritora — Driele",
    kind: "agent",
    homeTile: STORE_FLOW_STATIONS.driele,
    stateId: "DOCUMENTING",
    spriteId: "char-luna", // TODO: sprite proprio
    tags: ["store-flow", "affiliate", "copy", "station:redacao"],
  },
];
