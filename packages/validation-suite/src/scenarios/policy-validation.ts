/**
 * A.V.7 — Policy (Mag docker.restart → DENIED + ledger)
 */
import { ActionExecutionStatus, ActionId } from "@operaia/action-runtime";
import { createActionHarness } from "../fixtures.js";
import {
  assert,
  failScenario,
  passScenario,
  type ValidationScenario,
} from "../scenario.js";

export const policyValidationScenario: ValidationScenario = {
  id: "A.V.7",
  name: "Policy",
  description: "Mag solicita docker.restart → DENIED e ledger registra.",
  async run() {
    const startedAt = Date.now();
    const observations: string[] = [];
    try {
      const { runtime, ledger, docker } = createActionHarness();
      const result = await runtime.execute({
        workspaceId: "operaia-lab",
        requestedBy: "cto-mag",
        actionId: ActionId.dockerRestart,
        target: "api",
      });

      assert(!result.success, "Mag nao deveria executar docker.restart");
      assert(
        result.metadata.status === ActionExecutionStatus.DENIED,
        `status esperado DENIED, obtido ${result.metadata.status}`,
      );
      assert(
        docker.restartCalls.length === 0,
        "adapter nao deve ter sido chamado",
      );

      const records = await ledger.listByWorkspace("operaia-lab");
      assert(records.length >= 1, "ledger deve registrar a tentativa");
      const denied = records.find(
        (r) =>
          r.employeeId === "cto-mag" &&
          r.actionId === ActionId.dockerRestart &&
          r.status === ActionExecutionStatus.DENIED,
      );
      assert(denied, "registro DENIED do Mag ausente no ledger");

      observations.push("policy bloqueou Mag docker.restart");
      observations.push(`ledger DENIED id=${denied.id}`);

      return passScenario(this, startedAt, observations);
    } catch (error) {
      return failScenario(this, startedAt, observations, error);
    }
  },
};
