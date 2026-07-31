/**
 * CaddyActionAdapter — caddy.validate apenas.
 */
import { ActionId } from "../../action-id.js";
import type { ActionRequest } from "../../action-request.js";
import {
  actionFail,
  actionOk,
  type ActionResult,
} from "../../action-result.js";
import type { ActionAdapter } from "../../action-types.js";
import type { CaddyActionClient } from "./caddy-action-client.js";

export class CaddyActionAdapter implements ActionAdapter {
  readonly supportedActions = [ActionId.caddyValidate] as const;

  constructor(private readonly client: CaddyActionClient) {}

  async execute(request: ActionRequest): Promise<ActionResult> {
    const actionId = String(request.actionId);
    const target = request.target.trim();
    if (!target) {
      return actionFail({
        actionId,
        error: "target obrigatorio para caddy.validate",
      });
    }

    if (actionId !== ActionId.caddyValidate) {
      return actionFail({
        actionId,
        error: `Acao Caddy nao suportada: ${actionId}`,
      });
    }

    try {
      const result = await this.client.validate({
        workspaceId: request.workspaceId,
        target,
      });
      return actionOk({ actionId, output: result });
    } catch (error) {
      return actionFail({
        actionId,
        error: error instanceof Error ? error.message : "Falha Caddy",
      });
    }
  }
}
