import type { LLMProvider } from "@operaia/ai-core";
import {
  EmployeeDeliveryType,
  type Employee,
} from "@operaia/employee-framework";
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
    employeeId: "orion",
    deliveryType: EmployeeDeliveryType.operations_analysis,
    readOnlyInspectionTools: ["readLogs", "readWorkflow"],
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
        "Parta da evidence READ-ONLY (logs/workflow), proponha acoes operacionais e riscos. Nao invente facts.",
      limits:
        "Nao escolha funcionarios por nome. Nao invada outros dominios. Nao reinicie servicos. Devolva delivery com evidence.",
    }),
  },
});

export const orionRegisteredEmployee = specialist.registered;

export function createOrion(llm: LLMProvider): Employee {
  return specialist.create(llm);
}
