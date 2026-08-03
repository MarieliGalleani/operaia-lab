/**
 * A.V.2 — OPERATIONAL_REVIEW
 */
import { buildDirectExecutiveReply } from "@operaia/agents";
import {
  ConversationMissionRouter,
  IntentType,
  MISSION_INTENT_MARKER,
  RoutedEmployeeId,
} from "@operaia/mission-router";
import {
  sampleBriefing,
  samplePriorities,
  sampleReview,
} from "../fixtures.js";
import {
  assert,
  failScenario,
  passScenario,
  type ValidationScenario,
} from "../scenario.js";

export const operationalReviewScenario: ValidationScenario = {
  id: "A.V.2",
  name: "OPERATIONAL_REVIEW",
  description:
    'Entrada "Como está a NEXO?" → OPERATIONAL_REVIEW + resposta operacional.',
  async run() {
    const startedAt = Date.now();
    const observations: string[] = [];
    try {
      const router = new ConversationMissionRouter();
      const message = "Como está a NEXO?";
      const routed = router.route({
        message,
        workspaceId: "nexo",
        context: { source: "ceo-sala" },
      });

      assert(
        routed.intentType === IntentType.OPERATIONAL_REVIEW,
        `intent esperado OPERATIONAL_REVIEW, obtido ${routed.intentType}`,
      );
      assert(
        routed.employeeId === RoutedEmployeeId.opera,
        `employee esperado Opera, obtido ${routed.employeeId}`,
      );
      assert(
        routed.missionType === "COORDINATE",
        `missionType esperado COORDINATE, obtido ${routed.missionType}`,
      );
      assert(
        routed.objective.includes(MISSION_INTENT_MARKER),
        "objective deve conter [MISSION_INTENT]",
      );
      assert(
        routed.metadata.workspaceId === "nexo",
        "workspace analisado deve ser nexo",
      );

      observations.push(`intent=${routed.intentType}`);
      observations.push(`employee=${routed.employeeId}`);
      observations.push(`workspace=${routed.metadata.workspaceId}`);

      const reply = buildDirectExecutiveReply(
        sampleBriefing({
          project: "NEXO",
          objective: routed.objective,
          pending: ["Implementar autenticacao"],
        }),
        sampleReview({ pendingCount: 1 }),
        samplePriorities(),
      );

      assert(
        /Analisei\b/i.test(reply),
        "OPERATIONAL_REVIEW deve gerar analise operacional",
      );
      assert(/NEXO/i.test(reply), "resposta deve mencionar o workspace");
      observations.push("resposta operacional com Analisei + workspace");

      return passScenario(this, startedAt, observations);
    } catch (error) {
      return failScenario(this, startedAt, observations, error);
    }
  },
};
