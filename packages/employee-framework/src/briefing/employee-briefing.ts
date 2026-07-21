import type { EmployeeTask } from "../contracts/employee-task.js";

/** Secao textual reutilizavel para renderizacao de um briefing. */
export interface BriefingSection {
  readonly title: string;
  readonly content: string;
}

/**
 * EmployeeBriefing: a UNICA coisa sobre a qual um funcionario trabalha.
 * Nunca um Workspace direto, nunca infraestrutura. Apenas informacao de negocio.
 */
export interface EmployeeBriefing {
  readonly project: string;
  readonly objective: string;
  readonly executiveSummary: string;
  readonly currentState: string;
  readonly pending: readonly string[];
  readonly tasks: readonly EmployeeTask[];
  readonly documentation: readonly string[];
  readonly history: readonly string[];
  readonly constraints: readonly string[];
  readonly successCriteria: readonly string[];
  readonly additional: Readonly<Record<string, unknown>>;
}
