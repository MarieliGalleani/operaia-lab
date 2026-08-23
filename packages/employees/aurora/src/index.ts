import type { LLMProvider } from "@operaia/ai-core";
import {
  EmployeeDeliveryType,
  type Employee,
} from "@operaia/employee-framework";
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
    employeeId: "aurora",
    deliveryType: EmployeeDeliveryType.financial_analysis,
    financeArtifactInspection: true,
    readOnlyInspectionTools: [
      "listDirectory",
      "readFile",
      "searchFiles",
    ],
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
        "Parta da evidence READ-ONLY (finance/billing), proponha acoes financeiras, liste riscos e proximos passos. Nao invente facts ausentes da evidence.",
      limits:
        "Nao escolha funcionarios por nome. Nao invada outros dominios. Nao altere arquivos nem rode mutacoes. Devolva delivery com evidence financeira sanitizada.",
    }),
  },
});

export const auroraRegisteredEmployee = specialist.registered;

export function createAurora(llm: LLMProvider): Employee {
  return specialist.create(llm);
}
