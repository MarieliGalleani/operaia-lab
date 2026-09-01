import type { Priority, ProjectStatus, Timestamps, UUID } from "@operaia/shared";

/** Entidade de dominio Project, independente de qualquer detalhe de persistencia. */
export interface Project extends Timestamps {
  readonly id: UUID;
  readonly name: string;
  readonly description: string | null;
  readonly status: ProjectStatus;
  readonly priority: Priority;
  readonly goalId: UUID | null;
  /** P1.14B — contexto operacional; null quando ainda nao preenchido. */
  readonly objective: string | null;
  readonly context: string | null;
  readonly constraints: string | null;
}
