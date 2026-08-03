/**
 * A.V.10 — Execution Ledger (REQUESTED → RUNNING → SUCCESS)
 */
import {
  ActionExecutionStatus,
  ActionId,
  createActionRuntime,
  DockerActionAdapter,
  MapWorkspaceActionScope,
  MemoryDockerActionClient,
  MemorySystemdActionClient,
  SystemdActionAdapter,
  CaddyActionAdapter,
  MemoryCaddyActionClient,
} from "@operaia/action-runtime";
import { StatusTrackingLedger } from "../fixtures.js";
import {
  assert,
  failScenario,
  passScenario,
  type ValidationScenario,
} from "../scenario.js";

export const ledgerValidationScenario: ValidationScenario = {
  id: "A.V.10",
  name: "Execution Ledger",
  description:
    "Executar action e confirmar REQUESTED → RUNNING → SUCCESS persistidos.",
  async run() {
    const startedAt = Date.now();
    const observations: string[] = [];
    try {
      const tracking = new StatusTrackingLedger();
      const docker = new MemoryDockerActionClient();
      docker.seedStatus("operaia-lab", {
        name: "api",
        state: "running",
        health: "healthy",
      });

      const runtime = createActionRuntime({
        ledger: tracking,
        scope: new MapWorkspaceActionScope({
          "operaia-lab": ["api"],
        }),
        adapters: [
          new DockerActionAdapter(docker),
          new SystemdActionAdapter(new MemorySystemdActionClient()),
          new CaddyActionAdapter(new MemoryCaddyActionClient()),
        ],
      });

      const result = await runtime.execute({
        workspaceId: "operaia-lab",
        requestedBy: "atlas",
        actionId: ActionId.dockerStatus,
        target: "api",
      });

      assert(result.success, `execucao falhou: ${result.error ?? "?"}`);
      const statuses = tracking.statusHistory.map((h) => h.status);

      assert(
        statuses.includes(ActionExecutionStatus.REQUESTED),
        `REQUESTED ausente no historico: ${statuses.join("→")}`,
      );
      assert(
        statuses.includes(ActionExecutionStatus.RUNNING),
        `RUNNING ausente no historico: ${statuses.join("→")}`,
      );
      assert(
        statuses.includes(ActionExecutionStatus.SUCCESS),
        `SUCCESS ausente no historico: ${statuses.join("→")}`,
      );

      const requestedIdx = statuses.indexOf(ActionExecutionStatus.REQUESTED);
      const runningIdx = statuses.indexOf(ActionExecutionStatus.RUNNING);
      const successIdx = statuses.lastIndexOf(ActionExecutionStatus.SUCCESS);
      assert(
        requestedIdx < runningIdx && runningIdx < successIdx,
        `ordem invalida: ${statuses.join("→")}`,
      );

      const record = await tracking.getById(result.metadata.executionId!);
      assert(record, "registro final ausente");
      assert(record.status === ActionExecutionStatus.SUCCESS, "status final ≠ SUCCESS");
      assert(record.startedAt, "startedAt deve estar persistido");
      assert(record.finishedAt, "finishedAt deve estar persistido");

      observations.push(`historico=${statuses.join("→")}`);
      observations.push(`executionId=${record.id}`);

      return passScenario(this, startedAt, observations);
    } catch (error) {
      return failScenario(this, startedAt, observations, error);
    }
  },
};
