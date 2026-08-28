/** Contrato do gatilho recorrente (ScheduleRule) — /schedule-rules. */

export interface ScheduleRuleDto {
  readonly id: string;
  readonly workspaceId: string | null;
  readonly workspaceName: string | null;
  readonly intervalSec: number;
  readonly enabled: boolean;
  readonly objective: string | null;
  readonly lastEnqueuedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateScheduleRuleInput {
  readonly workspaceId: string;
  readonly objective: string;
  readonly intervalSec: number;
  readonly enabled?: boolean;
}

export interface UpdateScheduleRuleInput {
  readonly objective?: string;
  readonly intervalSec?: number;
  readonly enabled?: boolean;
}
