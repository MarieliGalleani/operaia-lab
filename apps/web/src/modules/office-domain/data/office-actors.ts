/**
 * Atores da sede (HQ) — elenco real (real-agents.ts) nas estações fixas
 * da sede, com o status ao vivo de cada agente.
 */

import type { ActorDescriptor } from "../../virtual-world/contracts/providers";
import type { LiveAgentStatus } from "../live-agent-status";
import { buildActorsForStations } from "./real-agents";
import { OFFICE_STATIONS } from "./office-map";

export function buildOfficeActors(
  liveStatus: ReadonlyMap<string, LiveAgentStatus>,
): readonly ActorDescriptor[] {
  return buildActorsForStations(OFFICE_STATIONS, liveStatus);
}
