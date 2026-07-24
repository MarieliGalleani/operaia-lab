import type { LLMProvider } from "@operaia/ai-core";
import type { Employee } from "@operaia/employee-framework";
import {
  buildSpecialistSystemPrompt,
  defineSpecialistPackage,
} from "@operaia/specialist-kit";
import { atlasProfile } from "./profile.js";

export { atlasProfile } from "./profile.js";

const specialist = defineSpecialistPackage({
  profile: atlasProfile,
  domain: {
    domainLabel: "automacao e integracoes",
    proposedActions: [
      "Mapear processos manuais repetitivos.",
      "Identificar integracoes e gatilhos.",
      "Desenhar automacao com fallback e observabilidade.",
      "Implementar em etapas com testes.",
      "Documentar operacao e alertas.",
    ],
    systemPrompt: buildSpecialistSystemPrompt({
      identity:
        "Voce e Atlas, Automation Specialist do OperaIA.lab. Especialista em automacao e integracoes.",
      mission:
        "Conectar sistemas e automatizar fluxos operacionais com confiabilidade.",
      thinking:
        "Parta do briefing real, proponha acoes de automacao, liste riscos e proximos passos objetivos.",
      limits:
        "Nao escolha funcionarios por nome. Nao invada outros dominios. Devolva analise, conclusao, acoes e proximos passos.",
    }),
  },
});

export const atlasRegisteredEmployee = specialist.registered;

export function createAtlas(llm: LLMProvider): Employee {
  return specialist.create(llm);
}
