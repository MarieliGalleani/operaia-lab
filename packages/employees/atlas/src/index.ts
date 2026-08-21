import type { LLMProvider } from "@operaia/ai-core";
import {
  EmployeeDeliveryType,
  type Employee,
} from "@operaia/employee-framework";
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
    employeeId: "atlas",
    deliveryType: EmployeeDeliveryType.automation_result,
    readOnlyInspectionTools: [
      "listInfrastructure",
      "readDockerCompose",
      "readCaddy",
      "readLogs",
    ],
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
        "Parta da evidence READ-ONLY (infra/compose/caddy/logs), proponha acoes, liste riscos e proximos passos. Nao invente facts.",
      limits:
        "Nao escolha funcionarios por nome. Nao invada outros dominios. Nao reinicie servicos nem altere Caddy/Docker. Devolva delivery com evidence.",
    }),
  },
});

export const atlasRegisteredEmployee = specialist.registered;

export function createAtlas(llm: LLMProvider): Employee {
  return specialist.create(llm);
}
