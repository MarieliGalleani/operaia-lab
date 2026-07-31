/**
 * SystemdActionAdapter — somente systemd.status.
 */
import { ActionId } from "../../action-id.js";
import type { ActionRequest } from "../../action-request.js";
import {
  actionFail,
  actionOk,
  type ActionResult,
} from "../../action-result.js";
import type { ActionAdapter } from "../../action-types.js";
import type { SystemdActionClient } from "./systemd-action-client.js";

export class SystemdActionAdapter implements ActionAdapter {
  readonly supportedActions = [ActionId.systemdStatus] as const;

  constructor(private readonly client: SystemdActionClient) {}

  async execute(request: ActionRequest): Promise<ActionResult> {
    const actionId = String(request.actionId);
    const target = request.target.trim();
    if (!target) {
      return actionFail({
        actionId,
        error: "target obrigatorio para systemd.status",
      });
    }

    if (actionId !== ActionId.systemdStatus) {
      return actionFail({
        actionId,
        error: `Acao systemd nao suportada: ${actionId}`,
      });
    }

    try {
      const status = await this.client.status({
        workspaceId: request.workspaceId,
        target,
      });
      return actionOk({ actionId, output: status });
    } catch (error) {
      return actionFail({
        actionId,
        error: error instanceof Error ? error.message : "Falha systemd",
      });
    }
  }
}
