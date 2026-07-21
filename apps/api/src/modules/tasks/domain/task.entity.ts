import type { Priority, TaskStatus, Timestamps, UUID } from "@operaia/shared";

/** Entidade de dominio Task, independente de detalhes de persistencia. */
export interface Task extends Timestamps {
  readonly id: UUID;
  readonly projectId: UUID;
  readonly title: string;
  readonly description: string | null;
  readonly status: TaskStatus;
  readonly priority: Priority;
  readonly assignedAgentId: UUID | null;
}
