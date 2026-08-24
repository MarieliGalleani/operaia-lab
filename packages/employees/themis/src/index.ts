import type { LLMProvider } from "@operaia/ai-core";
import {
  EmployeeDeliveryType,
  type Employee,
} from "@operaia/employee-framework";
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
    employeeId: "themis",
    deliveryType: EmployeeDeliveryType.legal_analysis,
    legalArtifactInspection: true,
    readOnlyInspectionTools: ["listDirectory", "readFile", "searchFiles"],
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
        "Parta da evidence READ-ONLY Legal (dir/README/docs), proponha acoes juridicas, liste riscos e proximos passos. Nao invente facts.",
      limits:
        "Nao escolha funcionarios por nome. Nao invada outros dominios. Nao altere arquivos nem rode mutacoes. Nao inclua secrets/fullContent. Devolva delivery legal_analysis com evidence sanitizada.",
    }),
  },
});

export const themisRegisteredEmployee = specialist.registered;

export function createThemis(llm: LLMProvider): Employee {
  return specialist.create(llm);
}
