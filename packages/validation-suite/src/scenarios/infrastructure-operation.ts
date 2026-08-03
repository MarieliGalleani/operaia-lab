/**
 * A.V.5 — INFRASTRUCTURE_OPERATION
 */
import {
  ActionId,
  createActionCapabilityProvider,
} from "@operaia/action-runtime";
import {
  ConversationMissionRouter,
  IntentType,
  RoutedEmployeeId,
  requiresSpecialistFromIntentMarker,
} from "@operaia/mission-router";
import { createActionHarness } from "../fixtures.js";
import {
  assert,
  failScenario,
  passScenario,
  type ValidationScenario,
} from "../scenario.js";

export const infrastructureOperationScenario: ValidationScenario = {
  id: "A.V.5",
  name: "INFRASTRUCTURE_OPERATION",
  description:
    'Entrada "O servidor caiu." → Atlas/Orion + Action Runtime disponivel.',
  async run() {
    const startedAt = Date.now();
    const observations: string[] = [];
    try {
      const router = new ConversationMissionRouter();
      const routed = router.route({
        message: "O servidor caiu.",
        workspaceId: "operaia-lab",
        context: { source: "ceo-sala" },
      });

      assert(
        routed.intentType === IntentType.INFRASTRUCTURE_OPERATION,
        `intent esperado INFRASTRUCTURE_OPERATION, obtido ${routed.intentType}`,
      );
      assert(
        routed.employeeId === RoutedEmployeeId.atlas ||
          routed.employeeId === RoutedEmployeeId.orion,
        `employee esperado Atlas/Orion, obtido ${routed.employeeId}`,
      );
      assert(
        requiresSpecialistFromIntentMarker(routed.objective),
        "marker deve exigir especialista de infra",
      );

      observations.push(`intent=${routed.intentType}`);
      observations.push(`employee=${routed.employeeId}`);

      const { runtime } = createActionHarness();
      const capability = createActionCapabilityProvider({
        runtime,
        employeeId: routed.employeeId,
        workspaceId: "operaia-lab",
      });

      // Atlas tem docker.status; Orion tem docker.logs — ambos provam Action Runtime.
      const actionId =
        routed.employeeId === RoutedEmployeeId.orion
          ? ActionId.dockerLogs
          : ActionId.dockerStatus;
      const result = await capability.requestAction({
        actionId,
        target: "api",
        parameters: actionId === ActionId.dockerLogs ? { limit: 5 } : undefined,
      });

      assert(result.success, `Action Runtime falhou: ${result.error ?? "?"}`);
      observations.push(`action=${actionId} SUCCESS via ActionCapabilityProvider`);

      return passScenario(this, startedAt, observations);
    } catch (error) {
      return failScenario(this, startedAt, observations, error);
    }
  },
};
