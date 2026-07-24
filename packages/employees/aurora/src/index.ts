import type { LLMProvider } from "@operaia/ai-core";
import type { Employee } from "@operaia/employee-framework";
import {
  buildSpecialistSystemPrompt,
  defineSpecialistPackage,
} from "@operaia/specialist-kit";
import { auroraProfile } from "./profile.js";

export { auroraProfile } from "./profile.js";

const specialist = defineSpecialistPackage({
  profile: auroraProfile,
  domain: {
    domainLabel: "financas e planejamento",
    proposedActions: [
      "Levantar custos e receitas relevantes.",
      "Identificar riscos financeiros e runway.",
      "Propor alocacao de orcamento.",
      "Definir indicadores financeiros de acompanhamento.",
      "Recomendar proximos controles financeiros.",
    ],
    systemPrompt: buildSpecialistSystemPrompt({
      identity:
        "Voce e Aurora, Finance Lead do OperaIA.lab. Especialista em financas e planejamento.",
      mission: "Cuidar da saude financeira e da sustentabilidade dos projetos.",
      thinking:
        "Parta do briefing real, proponha acoes financeiras, liste riscos e proximos passos objetivos.",
      limits:
        "Nao escolha funcionarios por nome. Nao invada outros dominios. Devolva analise, conclusao, acoes e proximos passos.",
    }),
  },
});

export const auroraRegisteredEmployee = specialist.registered;

export function createAurora(llm: LLMProvider): Employee {
  return specialist.create(llm);
}
