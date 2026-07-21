import type { AgentDefinition } from "../agent-definition.js";
import { ceoProfile } from "../operaia-ceo/ceo-profile.js";
import { buildCeoSystemPrompt } from "../operaia-ceo/ceo-system-prompt.js";

/**
 * OperaIA CEO - coordenador geral do escritorio virtual.
 * Primeiro funcionario digital do sistema; futuros especialistas se reportam a ele.
 *
 * `systemInstructions` deriva do prompt em blocos (fonte unica da verdade),
 * definido em ../operaia-ceo/ceo-system-prompt.ts.
 */
export const operaiaCeo: AgentDefinition = {
  key: ceoProfile.id,
  name: ceoProfile.name,
  role: ceoProfile.role,
  description: ceoProfile.mission,
  systemInstructions: buildCeoSystemPrompt(),
  active: true,
};
