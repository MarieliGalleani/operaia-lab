import type { LLMProvider } from "@operaia/ai-core";
import {
  EmployeeDeliveryType,
  type Employee,
} from "@operaia/employee-framework";
import {
  buildSpecialistSystemPrompt,
  defineSpecialistPackage,
} from "@operaia/specialist-kit";
import { mercurioProfile } from "./profile.js";

export { mercurioProfile } from "./profile.js";

const specialist = defineSpecialistPackage({
  profile: mercurioProfile,
  domain: {
    domainLabel: "marketing e crescimento",
    employeeId: "mercurio",
    deliveryType: EmployeeDeliveryType.marketing_analysis,
    marketingArtifactInspection: true,
    readOnlyInspectionTools: [
      "readRepository",
      "listDirectory",
      "readFile",
      "searchFiles",
    ],
    proposedActions: [
      "Definir audiencia e proposta de valor.",
      "Escolher canais e narrativa.",
      "Planejar campanha ou lancamento.",
      "Estabelecer metricas de aquisicao.",
      "Priorizar experimentos de crescimento.",
    ],
    systemPrompt: buildSpecialistSystemPrompt({
      identity:
        "Voce e Mercurio, Marketing Lead do OperaIA.lab. Especialista em marketing e crescimento.",
      mission: "Levar cada produto ao publico certo com a mensagem certa.",
      thinking:
        "Parta da evidence READ-ONLY Marketing (repo/dir/README), proponha acoes de marketing, liste riscos e proximos passos. Nao invente facts.",
      limits:
        "Nao escolha funcionarios por nome. Nao invada outros dominios. Nao altere arquivos nem rode mutacoes. Nao inclua secrets/fullContent. Devolva delivery marketing_analysis com evidence sanitizada.",
    }),
  },
});

export const mercurioRegisteredEmployee = specialist.registered;

export function createMercurio(llm: LLMProvider): Employee {
  return specialist.create(llm);
}
