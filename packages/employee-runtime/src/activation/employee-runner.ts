import type { ActionCapabilityProvider } from "@operaia/action-runtime";
import type { Employee, EmployeeBriefing } from "@operaia/employee-framework";
import type { ToolContext } from "@operaia/tool-runtime";
import { WorkspaceBriefingAdapter } from "../briefing/workspace-briefing-adapter.js";
import type { DelegationOutcome } from "../delegation/delegation-service.js";
import type { EmployeeContext } from "./employee-context.js";
import type { EmployeeResult } from "./employee-result.js";

/** Chave em briefing.additional para o ToolContext. */
export const BRIEFING_TOOL_CONTEXT_KEY = "toolContext" as const;

/** Chave em briefing.additional para ActionCapabilityProvider (A.5). */
export const BRIEFING_ACTION_CAPABILITY_KEY = "actionCapability" as const;

/** Chave em briefing.additional para delivery de Mission anterior (F5). */
export const BRIEFING_PREVIOUS_DELIVERY_KEY = "previousDelivery" as const;

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
    const withExecution = attachExecutionSummaries(
      withDelegation,
      context.executionSummaries,
    );
    const withTools = attachToolContext(
      withExecution,
      context.tools,
      context.workspace.workspaceId,
    );
    const withActions = attachActionCapability(withTools, context.actions);
    const briefing = attachPreviousDelivery(
      withActions,
      context.previousDelivery,
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
 * Recupera ToolContext injetado no briefing (se houver).
 * Employees usam isto em vez de conhecer adapters.
 */
export function getToolContextFromBriefing(
  briefing: EmployeeBriefing,
): ToolContext | null {
  const value = briefing.additional[BRIEFING_TOOL_CONTEXT_KEY];
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as ToolContext;
}

/**
 * Recupera ActionCapabilityProvider injetado no briefing (se houver).
 * Employees usam requestAction — nunca adapters.
 */
export function getActionCapabilityFromBriefing(
  briefing: EmployeeBriefing,
): ActionCapabilityProvider | null {
  const value = briefing.additional[BRIEFING_ACTION_CAPABILITY_KEY];
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as ActionCapabilityProvider;
}

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
        executionReport: outcome.executionReport,
      })),
    },
  };
}

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

function attachToolContext(
  briefing: EmployeeBriefing,
  tools: ToolContext | undefined,
  workspaceId: string | undefined,
): EmployeeBriefing {
  if (!tools) {
    return briefing;
  }

  const resolved = tools.withWorkspaceId(workspaceId);

  return {
    ...briefing,
    additional: {
      ...briefing.additional,
      [BRIEFING_TOOL_CONTEXT_KEY]: resolved,
      toolIds: resolved.listAllowedTools(),
    },
  };
}

function attachActionCapability(
  briefing: EmployeeBriefing,
  actions: ActionCapabilityProvider | null | undefined,
): EmployeeBriefing {
  if (!actions) {
    return briefing;
  }

  return {
    ...briefing,
    additional: {
      ...briefing.additional,
      [BRIEFING_ACTION_CAPABILITY_KEY]: actions,
      actionWorkspaceId: actions.workspaceId,
      actionEmployeeId: actions.employeeId,
    },
  };
}

function attachPreviousDelivery(
  briefing: EmployeeBriefing,
  previous: EmployeeContext["previousDelivery"],
): EmployeeBriefing {
  if (!previous) {
    return briefing;
  }

  return {
    ...briefing,
    additional: {
      ...briefing.additional,
      [BRIEFING_PREVIOUS_DELIVERY_KEY]: {
        sourceMissionId: previous.sourceMissionId,
        delivery: previous.delivery,
      },
    },
  };
}
