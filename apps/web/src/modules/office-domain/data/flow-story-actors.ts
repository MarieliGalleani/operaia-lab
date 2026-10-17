/**
 * Atores do 1º andar — Flow Story.
 *
 * Elenco proprio do andar (pacote @operaia/flow-story), nao a Equipe Digital.
 * Cargo antes do nome, como no resto do Campus. Sprites reaproveitam o tema
 * corporate ate ter arte propria.
 */

import type { ActorDescriptor } from "../../virtual-world/contracts/providers";
import { FLOW_STORY_STATIONS } from "./flow-story-floor-map";

export const FLOW_STORY_ACTORS: readonly ActorDescriptor[] = [
  {
    id: "flow",
    name: "Robô de Ofertas — Flow",
    kind: "agent",
    homeTile: FLOW_STORY_STATIONS.flow,
    stateId: "WORKING",
    spriteId: "char-atlas", // TODO: sprite proprio
    tags: ["flow-story", "affiliate", "curation", "station:radar"],
  },
  {
    id: "story",
    name: "Escritora — Story",
    kind: "agent",
    homeTile: FLOW_STORY_STATIONS.story,
    stateId: "DOCUMENTING",
    spriteId: "char-luna", // TODO: sprite proprio
    tags: ["flow-story", "affiliate", "copy", "station:redacao"],
  },
];
