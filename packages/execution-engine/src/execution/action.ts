import type { Priority, UUID } from "@operaia/shared";

/**
 * Tipos de acao conhecidos. Sao apenas os PRIMEIROS valores canonicos.
 *
 * `Action.type` e um `string` (nao o enum), portanto adicionar um novo tipo =
 * declarar uma nova constante + registrar um novo executor, SEM alterar o
 * nucleo do Engine (Open/Closed Principle).
 */
export const ActionType = {
  CREATE_TASK: "CREATE_TASK",
  UPDATE_TASK: "UPDATE_TASK",
  COMPLETE_TASK: "COMPLETE_TASK",
  CREATE_NOTE: "CREATE_NOTE",
  UPDATE_PROJECT: "UPDATE_PROJECT",
  REQUEST_REVIEW: "REQUEST_REVIEW",
  GENERATE_PROMPT: "GENERATE_PROMPT",
  LOG: "LOG",
} as const;
export type ActionType = (typeof ActionType)[keyof typeof ActionType];

/** Ciclo de vida de uma acao dentro do Engine. */
export const ActionStatus = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
} as const;
export type ActionStatus = (typeof ActionStatus)[keyof typeof ActionStatus];

/** Saida produzida por um executor ao processar uma acao. */
export type ActionOutput = Readonly<Record<string, unknown>>;

/**
 * Unidade de trabalho executavel. O `type` e um `string` (aberto a extensao);
 * as constantes de `ActionType` sao os valores canonicos conhecidos.
 */
export interface Action {
  readonly id: UUID;
  readonly type: string;
  readonly description: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly priority: Priority;
  readonly status: ActionStatus;
}
