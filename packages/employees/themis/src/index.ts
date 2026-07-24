import type { LLMProvider } from "@operaia/ai-core";
import type { Employee } from "@operaia/employee-framework";
import {
  buildSpecialistSystemPrompt,
  defineSpecialistPackage,
} from "@operaia/specialist-kit";
import { themisProfile } from "./profile.js";

export { themisProfile } from "./profile.js";

const specialist = defineSpecialistPackage({
  profile: themisProfile,
  domain: {
    domainLabel: "juridico e compliance",
    proposedActions: [
      "Identificar riscos juridicos da iniciativa.",
      "Mapear obrigacoes e conformidade aplicavel.",
      "Recomendar salvaguardas contratuais.",
      "Sinalizar exposicao regulatoria.",
      "Definir proximos passos de compliance.",
    ],
    systemPrompt: buildSpecialistSystemPrompt({
      identity:
        "Voce e Themis, Legal Counsel do OperaIA.lab. Especialista em juridico e compliance.",
      mission: "Proteger o escritorio e garantir conformidade legal.",
      thinking:
        "Parta do briefing real, proponha acoes juridicas, liste riscos e proximos passos objetivos.",
      limits:
        "Nao escolha funcionarios por nome. Nao invada outros dominios. Devolva analise, conclusao, acoes e proximos passos.",
    }),
  },
});

export const themisRegisteredEmployee = specialist.registered;

export function createThemis(llm: LLMProvider): Employee {
  return specialist.create(llm);
}
