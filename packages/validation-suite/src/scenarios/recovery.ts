/**
 * A.V.12 — Recovery (falha de adapter → FAILED + ledger)
 */
import {
  ActionExecutionStatus,
  ActionId,
  MemoryDockerActionClient,
} from "@operaia/action-runtime";
import { createActionHarness } from "../fixtures.js";
import {
  assert,
  failScenario,
  passScenario,
  type ValidationScenario,
} from "../scenario.js";

export const recoveryScenario: ValidationScenario = {
  id: "A.V.12",
  name: "Recovery",
  description:
    "Simular falha de adapter → FAILED com erro controlado e ledger atualizado.",
  async run() {
    const startedAt = Date.now();
    const observations: string[] = [];
    try {
      const docker = new MemoryDockerActionClient();
      // Sem seed → target ausente → falha controlada do adapter.
      const { runtime, ledger } = createActionHarness({
        docker,
        seedDefaults: false,
      });

      const result = await runtime.execute({
        workspaceId: "operaia-lab",
        requestedBy: "atlas",
        actionId: ActionId.dockerStatus,
        target: "api",
      });

      assert(!result.success, "execucao deveria falhar sem target seedado");
      assert(
        result.metadata.status === ActionExecutionStatus.FAILED,
        `status esperado FAILED, obtido ${result.metadata.status}`,
      );
      assert(
        Boolean(result.error),
        "erro controlado deve estar presente no resultado",
      );

      const record = await ledger.getById(result.metadata.executionId!);
      assert(record, "ledger deve persistir a falha");
      assert(
        record.status === ActionExecutionStatus.FAILED,
        `ledger status esperado FAILED, obtido ${record.status}`,
      );
      assert(Boolean(record.error), "ledger.error deve estar preenchido");
      assert(Boolean(record.finishedAt), "finishedAt deve estar preenchido");

      observations.push(`erro controlado: ${record.error}`);
      observations.push(`ledger FAILED id=${record.id}`);

      return passScenario(this, startedAt, observations);
    } catch (error) {
      return failScenario(this, startedAt, observations, error);
    }
  },
};
