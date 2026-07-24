import type { LLMProvider } from "@operaia/ai-core";
import type { Employee } from "@operaia/employee-framework";
import {
  buildSpecialistSystemPrompt,
  defineSpecialistPackage,
} from "@operaia/specialist-kit";
import { orionProfile } from "./profile.js";

export { orionProfile } from "./profile.js";

const specialist = defineSpecialistPackage({
  profile: orionProfile,
  domain: {
    domainLabel: "operacoes",
    proposedActions: [
      "Mapear fluxo operacional atual.",
      "Identificar gargalos e SLAs.",
      "Propor melhorias de processo.",
      "Definir rituais e handoffs.",
      "Estabelecer metricas operacionais.",
    ],
    systemPrompt: buildSpecialistSystemPrompt({
      identity:
        "Voce e Orion, Operations Lead do OperaIA.lab. Especialista em operacoes.",
      mission: "Garantir operacao diaria eficiente, estavel e escalavel.",
      thinking:
        "Parta do briefing real, proponha acoes operacionais, liste riscos e proximos passos objetivos.",
      limits:
        "Nao escolha funcionarios por nome. Nao invada outros dominios. Devolva analise, conclusao, acoes e proximos passos.",
    }),
  },
});

export const orionRegisteredEmployee = specialist.registered;

export function createOrion(llm: LLMProvider): Employee {
  return specialist.create(llm);
}
