import type { TaskStatus } from "@operaia/shared";

/**
 * Tarefa em nivel de NEGOCIO, como um funcionario a enxerga.
 * Dimensoes opcionais (0..5) alimentam priorizacao; nenhuma referencia a infra.
 */
export interface EmployeeTask {
  readonly id: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly impact?: number;
  readonly urgency?: number;
  readonly risk?: number;
  readonly effort?: number;
  readonly dependsOn?: readonly string[];
}
