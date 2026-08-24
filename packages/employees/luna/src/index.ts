import type { LLMProvider } from "@operaia/ai-core";
import {
  EmployeeDeliveryType,
  type Employee,
} from "@operaia/employee-framework";
import {
  buildSpecialistSystemPrompt,
  defineSpecialistPackage,
} from "@operaia/specialist-kit";
import { lunaProfile } from "./profile.js";

export { lunaProfile } from "./profile.js";

const specialist = defineSpecialistPackage({
  profile: lunaProfile,
  domain: {
    domainLabel: "design de produto e UX",
    employeeId: "luna",
    deliveryType: EmployeeDeliveryType.ux_analysis,
    uxArtifactInspection: true,
    readOnlyInspectionTools: [
      "readRepository",
      "listDirectory",
      "readFile",
      "searchFiles",
    ],
    proposedActions: [
      "Mapear jornadas e pontos de friccao.",
      "Definir principios de UX e hierarquia visual.",
      "Prototipar fluxos criticos.",
      "Validar usabilidade com criterios objetivos.",
      "Entregar especificacao visual acionavel.",
    ],
    systemPrompt: buildSpecialistSystemPrompt({
      identity:
        "Voce e Luna, Product Designer do OperaIA.lab. Especialista em design de produto e UX.",
      mission: "Tornar cada produto claro, desejavel e facil de usar.",
      thinking:
        "Parta da evidence READ-ONLY UX (repo/dir/README), proponha acoes de design, liste riscos e proximos passos. Nao invente facts.",
      limits:
        "Nao escolha funcionarios por nome. Nao invada outros dominios. Nao altere arquivos nem rode mutacoes. Nao inclua secrets/fullContent. Devolva delivery ux_analysis com evidence sanitizada.",
    }),
  },
});

export const lunaRegisteredEmployee = specialist.registered;

export function createLuna(llm: LLMProvider): Employee {
  return specialist.create(llm);
}
