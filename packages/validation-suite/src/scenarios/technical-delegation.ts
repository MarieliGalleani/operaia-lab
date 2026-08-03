/**
 * A.V.3 — TECH_IMPLEMENTATION
 * A.V.4 — BUG_INVESTIGATION
 */
import {
  ConversationMissionRouter,
  IntentType,
  MISSION_INTENT_MARKER,
  RoutedEmployeeId,
  requiresSpecialistFromIntentMarker,
} from "@operaia/mission-router";
import {
  assert,
  failScenario,
  passScenario,
  type ValidationScenario,
} from "../scenario.js";

const router = new ConversationMissionRouter();

export const techImplementationScenario: ValidationScenario = {
  id: "A.V.3",
  name: "TECH_IMPLEMENTATION",
  description:
    'Entrada "Quero implementar autenticação." → TECH → Mag.',
  async run() {
    const startedAt = Date.now();
    const observations: string[] = [];
    try {
      const routed = router.route({
        message: "Quero implementar autenticação.",
        workspaceId: "nexo",
        context: { source: "ceo-sala" },
      });

      assert(
        routed.intentType === IntentType.TECH_IMPLEMENTATION,
        `intent esperado TECH_IMPLEMENTATION, obtido ${routed.intentType}`,
      );
      assert(
        routed.employeeId === RoutedEmployeeId.mag,
        `delegacao esperada para Mag, obtido ${routed.employeeId}`,
      );
      assert(
        routed.missionType === "SPECIALIST_COORDINATE",
        `missionType esperado SPECIALIST_COORDINATE, obtido ${routed.missionType}`,
      );
      assert(
        routed.objective.includes(MISSION_INTENT_MARKER),
        "objective deve conter [MISSION_INTENT]",
      );
      assert(
        requiresSpecialistFromIntentMarker(routed.objective),
        "marker deve exigir especialista",
      );

      observations.push(`intent=${routed.intentType}`);
      observations.push(`employee=${routed.employeeId}`);
      observations.push("delegacao Mag confirmada");

      return passScenario(this, startedAt, observations);
    } catch (error) {
      return failScenario(this, startedAt, observations, error);
    }
  },
};

export const bugInvestigationScenario: ValidationScenario = {
  id: "A.V.4",
  name: "BUG_INVESTIGATION",
  description: 'Entrada "O deploy falhou." → Mag recebe missao.',
  async run() {
    const startedAt = Date.now();
    const observations: string[] = [];
    try {
      const routed = router.route({
        message: "O deploy falhou.",
        workspaceId: "nexo",
        context: { source: "ceo-sala" },
      });

      assert(
        routed.intentType === IntentType.BUG_INVESTIGATION,
        `intent esperado BUG_INVESTIGATION, obtido ${routed.intentType}`,
      );
      assert(
        routed.employeeId === RoutedEmployeeId.mag,
        `Mag deve receber a missao, obtido ${routed.employeeId}`,
      );
      assert(
        requiresSpecialistFromIntentMarker(routed.objective),
        "marker deve exigir especialista (Mag)",
      );

      observations.push(`intent=${routed.intentType}`);
      observations.push(`employee=${routed.employeeId}`);

      return passScenario(this, startedAt, observations);
    } catch (error) {
      return failScenario(this, startedAt, observations, error);
    }
  },
};
