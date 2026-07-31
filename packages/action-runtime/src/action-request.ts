/**
 * Pedido tipado de acao operacional.
 */
import type { ActionId } from "./action-id.js";

export interface ActionRequest {
  readonly workspaceId: string;
  readonly requestedBy: string;
  readonly actionId: ActionId | string;
  readonly target: string;
  readonly parameters?: Readonly<Record<string, unknown>>;
}
