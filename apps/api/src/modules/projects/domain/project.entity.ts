import type { Priority, ProjectStatus, Timestamps, UUID } from "@operaia/shared";

/** Entidade de dominio Project, independente de qualquer detalhe de persistencia. */
export interface Project extends Timestamps {
  readonly id: UUID;
  readonly name: string;
  readonly description: string | null;
  readonly status: ProjectStatus;
  readonly priority: Priority;
  readonly goalId: UUID | null;
}
