import type {
  DelegationOutcome,
  EmployeeContext,
  EmployeeResult,
} from "@operaia/employee-runtime";
import type { DigitalOffice } from "./office-composition.js";

/**
 * Resultado de uma missao orquestrada: ciclo inicial da Opera, delegacoes e
 * resposta final da Opera (unica voz para o usuario).
 */
export interface MissionResult {
  readonly employeeId: string;
  readonly initial: EmployeeResult;
  readonly outcomes: readonly DelegationOutcome[];
  readonly final: EmployeeResult;
}

/**
 * Orquestra o fluxo de missao na API — SEM regras de negocio de funcionarios.
 *
 *   Opera (decide) → DelegationService → especialistas → Opera (consolida) → resposta
 *
 * Toda inteligencia permanece em EmployeeBrain / policies / DelegationService.
 * Este servico apenas encadeia as chamadas e devolve o resultado auditavel.
 */
export class MissionOrchestrator {
  constructor(private readonly office: DigitalOffice) {}

  async run(
    employeeId: string,
    context: EmployeeContext,
  ): Promise<MissionResult> {
    const { registry, runner, delegation, llm } = this.office;
    const employee = registry.require(employeeId).create({ llm });

    const initial = await runner.run(employee, context);
    const requests = initial.output.decision.delegations;

    const outcomes =
      requests.length > 0
        ? await delegation.run(requests, context)
        : [];

    // Sem delegacao: a propria Opera ja e a resposta final.
    if (outcomes.length === 0) {
      return { employeeId, initial, outcomes, final: initial };
    }

    // Com delegacao: a Opera revisa/consolida antes de falar com o usuario.
    const final = await runner.run(employee, {
      ...context,
      delegationOutcomes: outcomes,
    });

    return { employeeId, initial, outcomes, final };
  }
}
