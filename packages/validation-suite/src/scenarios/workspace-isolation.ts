/**
 * A.V.8 — Workspace Isolation
 */
import { ActionExecutionStatus, ActionId } from "@operaia/action-runtime";
import { createActionHarness } from "../fixtures.js";
import {
  assert,
  failScenario,
  passScenario,
  type ValidationScenario,
} from "../scenario.js";

export const workspaceIsolationScenario: ValidationScenario = {
  id: "A.V.8",
  name: "Workspace Isolation",
  description:
    "Workspace A nao acessa targets do Workspace B.",
  async run() {
    const startedAt = Date.now();
    const observations: string[] = [];
    try {
      const { runtime } = createActionHarness();

      const allowed = await runtime.execute({
        workspaceId: "workspace-a",
        requestedBy: "atlas",
        actionId: ActionId.dockerStatus,
        target: "svc-a",
      });
      assert(allowed.success, "Workspace A deve acessar svc-a");
      observations.push("workspace-a → svc-a OK");

      const cross = await runtime.execute({
        workspaceId: "workspace-a",
        requestedBy: "atlas",
        actionId: ActionId.dockerStatus,
        target: "svc-b",
      });
      assert(!cross.success, "Workspace A nao deve acessar svc-b");
      assert(
        cross.metadata.status === ActionExecutionStatus.DENIED,
        `cross-workspace esperado DENIED, obtido ${cross.metadata.status}`,
      );
      assert(
        /fora do workspace/i.test(cross.error ?? ""),
        `erro de isolamento ausente: ${cross.error ?? "?"}`,
      );
      observations.push("workspace-a → svc-b DENIED (isolamento)");

      const other = await runtime.execute({
        workspaceId: "workspace-b",
        requestedBy: "atlas",
        actionId: ActionId.dockerStatus,
        target: "svc-b",
      });
      assert(other.success, "Workspace B deve acessar svc-b");
      observations.push("workspace-b → svc-b OK");

      return passScenario(this, startedAt, observations);
    } catch (error) {
      return failScenario(this, startedAt, observations, error);
    }
  },
};
