import type { Employee, EmployeeBriefing } from "@operaia/employee-framework";
import { WorkspaceBriefingAdapter } from "../briefing/workspace-briefing-adapter.js";
import type { DelegationOutcome } from "../delegation/delegation-service.js";
import type { EmployeeContext } from "./employee-context.js";
import type { EmployeeResult } from "./employee-result.js";

/**
 * Coloca um funcionario para trabalhar dentro de um Workspace.
 *
 * Fluxo: Workspace (snapshot) -> EmployeeBriefing -> Employee -> EmployeeOutput.
 * O funcionario continua recebendo apenas Briefing; toda a adaptacao ocorre
 * aqui, fora dele.
 */
export class EmployeeRunner {
  constructor(
    private readonly briefingAdapter: WorkspaceBriefingAdapter = new WorkspaceBriefingAdapter(),
  ) {}

  async run(employee: Employee, context: EmployeeContext): Promise<EmployeeResult> {
    const base = this.briefingAdapter.toBriefing(
      context.workspace,
      context.objective,
    );
    const withMemory = attachMemoryNotes(base, context.memoryNotes);
    const withDelegation = attachDelegationOutcomes(
      withMemory,
      context.delegationOutcomes,
    );
    const briefing = attachExecutionSummaries(
      withDelegation,
      context.executionSummaries,
    );
    const output = await employee.work({ briefing });

    return {
      employeeId: employee.profile.id,
      profile: employee.profile,
      briefing,
      output,
    };
  }
}

/**
 * Injeta notas de memoria no briefing (history + additional.memoryContext).
 * Apenas transporte — sem acoplar a MemoryStore.
 */
function attachMemoryNotes(
  briefing: EmployeeBriefing,
  notes: readonly string[] | undefined,
): EmployeeBriefing {
  if (!notes || notes.length === 0) {
    return briefing;
  }

  return {
    ...briefing,
    history: [...briefing.history, ...notes],
    additional: {
      ...briefing.additional,
      memoryContext: notes,
    },
  };
}

/**
 * Injeta outcomes de delegacao no briefing (campo `additional`).
 * Apenas transporte de dados — nao interpreta o conteudo.
 */
function attachDelegationOutcomes(
  briefing: EmployeeBriefing,
  outcomes: readonly DelegationOutcome[] | undefined,
): EmployeeBriefing {
  if (!outcomes || outcomes.length === 0) {
    return briefing;
  }

  return {
    ...briefing,
    additional: {
      ...briefing.additional,
      delegationOutcomes: outcomes.map((outcome) => ({
        matched: outcome.matched,
        specialization: outcome.request.specialization,
        reason: outcome.request.reason,
        task: outcome.request.task,
        employeeId: outcome.employeeId,
        report: outcome.result?.output.report,
        decision: outcome.result?.output.decision,
        qualityPassed: outcome.result?.output.quality.passed,
      })),
    },
  };
}

/**
 * Injeta resultados normalizados do Execution Engine no briefing.
 * Apenas transporte — o brain decide se usa.
 */
function attachExecutionSummaries(
  briefing: EmployeeBriefing,
  summaries: EmployeeContext["executionSummaries"],
): EmployeeBriefing {
  if (!summaries || summaries.length === 0) {
    return briefing;
  }

  return {
    ...briefing,
    additional: {
      ...briefing.additional,
      executionResults: summaries,
    },
  };
}
