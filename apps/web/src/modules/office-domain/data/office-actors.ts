/**
 * Atores da sede (HQ) como DADO — usa o elenco REAL compartilhado
 * (real-agents.ts) combinado com as estações fixas da sede.
 *
 * Camada: DOMINIO. Cargo SEMPRE antes do nome. Cada profissional tem
 * `homeTile` = estação (mesa/PC). `stateId` AVAILABLE/IDLE → roam para zonas
 * com tag "rest". Demais estados ficam no posto (vagueio curto).
 */

import type { ActorDescriptor } from "../../virtual-world/contracts/providers";
import { OFFICE_STATIONS } from "./office-map";
import { REAL_AGENT_ROSTER } from "./real-agents";

export const OFFICE_ACTORS: readonly ActorDescriptor[] = REAL_AGENT_ROSTER.map(
  (agent) => ({
    id: agent.id,
    name: agent.name,
    kind: agent.kind,
    homeTile: OFFICE_STATIONS[agent.id as keyof typeof OFFICE_STATIONS],
    stateId: agent.stateId,
    spriteId: agent.spriteId,
    tags: agent.tags,
  }),
);
