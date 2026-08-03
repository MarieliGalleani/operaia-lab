/**
 * A.V.6 — Action Runtime (docker.status)
 */
import { ActionExecutionStatus, ActionId } from "@operaia/action-runtime";
import { createActionHarness } from "../fixtures.js";
import {
  assert,
  failScenario,
  passScenario,
  type ValidationScenario,
} from "../scenario.js";

export const actionRuntimeScenario: ValidationScenario = {
  id: "A.V.6",
  name: "Action Runtime",
  description: "Simular docker.status → Policy aprova + ActionExecution SUCCESS.",
  async run() {
    const startedAt = Date.now();
    const observations: string[] = [];
    try {
      const { runtime, ledger } = createActionHarness();
      const result = await runtime.execute({
        workspaceId: "operaia-lab",
        requestedBy: "atlas",
        actionId: ActionId.dockerStatus,
        target: "api",
      });

      assert(result.success, `docker.status falhou: ${result.error ?? "?"}`);
      assert(
        result.metadata.status === ActionExecutionStatus.SUCCESS,
        `status esperado SUCCESS, obtido ${result.metadata.status}`,
      );
      assert(
        Boolean(result.metadata.executionId),
        "ActionExecution deve ser criado",
      );

      const record = await ledger.getById(result.metadata.executionId!);
      assert(record, "registro do ledger ausente");
      assert(
        record.status === ActionExecutionStatus.SUCCESS,
        `ledger status esperado SUCCESS, obtido ${record.status}`,
      );
      assert(record.actionId === ActionId.dockerStatus, "actionId incorreto");
      assert(record.employeeId === "atlas", "employeeId incorreto");

      observations.push("policy aprovou Atlas docker.status");
      observations.push(`executionId=${record.id}`);
      observations.push("resultado SUCCESS no ledger");

      return passScenario(this, startedAt, observations);
    } catch (error) {
      return failScenario(this, startedAt, observations, error);
    }
  },
};
