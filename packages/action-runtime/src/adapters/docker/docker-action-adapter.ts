/**
 * DockerActionAdapter — status / logs / restart tipados (sem shell).
 */
import { ActionId } from "../../action-id.js";
import type { ActionRequest } from "../../action-request.js";
import {
  actionFail,
  actionOk,
  type ActionResult,
} from "../../action-result.js";
import type { ActionAdapter } from "../../action-types.js";
import type { DockerActionClient } from "./docker-action-client.js";

export class DockerActionAdapter implements ActionAdapter {
  readonly supportedActions = [
    ActionId.dockerStatus,
    ActionId.dockerLogs,
    ActionId.dockerRestart,
  ] as const;

  constructor(private readonly client: DockerActionClient) {}

  async execute(request: ActionRequest): Promise<ActionResult> {
    const actionId = String(request.actionId);
    const target = request.target.trim();
    if (!target) {
      return actionFail({
        actionId,
        error: "target obrigatorio para acoes Docker",
      });
    }

    try {
      if (actionId === ActionId.dockerStatus) {
        const status = await this.client.status({
          workspaceId: request.workspaceId,
          target,
        });
        return actionOk({ actionId, output: status });
      }

      if (actionId === ActionId.dockerLogs) {
        const limit =
          typeof request.parameters?.limit === "number"
            ? request.parameters.limit
            : undefined;
        const entries = await this.client.logs({
          workspaceId: request.workspaceId,
          target,
          limit,
        });
        return actionOk({
          actionId,
          output: { target, entries },
        });
      }

      if (actionId === ActionId.dockerRestart) {
        const result = await this.client.restart({
          workspaceId: request.workspaceId,
          target,
        });
        return actionOk({ actionId, output: result });
      }

      return actionFail({
        actionId,
        error: `Acao Docker nao suportada: ${actionId}`,
      });
    } catch (error) {
      return actionFail({
        actionId,
        error: error instanceof Error ? error.message : "Falha Docker",
      });
    }
  }
}
