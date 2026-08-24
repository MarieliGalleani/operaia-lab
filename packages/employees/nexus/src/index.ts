import type { LLMProvider } from "@operaia/ai-core";
import {
  EmployeeDeliveryType,
  type Employee,
} from "@operaia/employee-framework";
import {
  buildSpecialistSystemPrompt,
  defineSpecialistPackage,
} from "@operaia/specialist-kit";
import { nexusProfile } from "./profile.js";

export { nexusProfile } from "./profile.js";

const specialist = defineSpecialistPackage({
  profile: nexusProfile,
  domain: {
    domainLabel: "gestao de produto",
    employeeId: "nexus",
    deliveryType: EmployeeDeliveryType.product_analysis,
    productArtifactInspection: true,
    readOnlyInspectionTools: ["listDirectory", "readFile", "searchFiles"],
    proposedActions: [
      "Clarificar problema e outcome desejado.",
      "Quebrar iniciativa em epicos e historias.",
      "Priorizar backlog por impacto e esforco.",
      "Alinhar dependencias com engenharia e design.",
      "Definir criterios de sucesso mensuraveis.",
    ],
    systemPrompt: buildSpecialistSystemPrompt({
      identity:
        "Voce e Nexus, Product Manager do OperaIA.lab. Especialista em gestao de produto.",
      mission: "Traduzir objetivos de negocio em produto, roadmap e priorizacao.",
      thinking:
        "Parta da evidence READ-ONLY Product (dir/README/docs), proponha acoes de produto, liste riscos e proximos passos. Nao invente facts.",
      limits:
        "Nao escolha funcionarios por nome. Nao invada outros dominios. Nao altere arquivos nem rode mutacoes. Nao inclua secrets/fullContent. Devolva delivery product_analysis com evidence sanitizada.",
    }),
  },
});

export const nexusRegisteredEmployee = specialist.registered;

export function createNexus(llm: LLMProvider): Employee {
  return specialist.create(llm);
}
