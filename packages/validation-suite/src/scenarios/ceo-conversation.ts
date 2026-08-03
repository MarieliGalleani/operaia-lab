/**
 * A.V.1 — GENERAL_CONVERSATION
 * A.V.11 — Conversation Routing (sala CEO → ConversationMissionRouter)
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

const router = new ConversationMissionRouter();

export const ceoConversationScenario: ValidationScenario = {
  id: "A.V.1",
  name: "GENERAL_CONVERSATION",
  description:
    'Entrada "Quais projetos temos?" → GENERAL_CONVERSATION / Opera, sem Operational Summary.',
  async run() {
    const startedAt = Date.now();
    const observations: string[] = [];
    try {
      const message = "Quais projetos temos?";
      const routed = router.route({
        message,
        workspaceId: "nexo",
        context: { source: "ceo-sala", employeeId: "operaia-ceo" },
      });

      assert(
        routed.intentType === IntentType.GENERAL_CONVERSATION,
        `intent esperado GENERAL_CONVERSATION, obtido ${routed.intentType}`,
      );
      assert(
        routed.employeeId === RoutedEmployeeId.opera,
        `employee esperado ${RoutedEmployeeId.opera}, obtido ${routed.employeeId}`,
      );
      assert(
        routed.missionType === "CONVERSATION",
        `missionType esperado CONVERSATION, obtido ${routed.missionType}`,
      );
      assert(
        routed.objective.includes(MISSION_INTENT_MARKER),
        "objective deve conter [MISSION_INTENT]",
      );
      assert(
        routed.metadata.workspaceId === "nexo",
        "workspaceId deve ser preservado",
      );

      observations.push(`intent=${routed.intentType}`);
      observations.push(`employee=${routed.employeeId}`);
      observations.push(`missionType=${routed.missionType}`);

      const reply = buildDirectExecutiveReply(
        sampleBriefing({ objective: routed.objective }),
        sampleReview(),
        samplePriorities(),
      );

      assert(
        !/Analisei\b/i.test(reply),
        "GENERAL_CONVERSATION nao deve gerar Operational Summary (Analisei…)",
      );
      assert(
        /workspace|NEXO|escritorio|projet/i.test(reply),
        "resposta deve ser contextual ao workspace",
      );
      observations.push("resposta contextual sem template operacional");

      return passScenario(this, startedAt, observations);
    } catch (error) {
      return failScenario(this, startedAt, observations, error);
    }
  },
};

export const conversationRoutingScenario: ValidationScenario = {
  id: "A.V.11",
  name: "Conversation Routing",
  description:
    "Toda mensagem da sala do CEO passa pelo ConversationMissionRouter.",
  async run() {
    const startedAt = Date.now();
    const observations: string[] = [];
    try {
      const messages = [
        "Quais projetos temos?",
        "Como está a NEXO?",
        "Quero implementar autenticação.",
        "O deploy falhou.",
        "O servidor caiu.",
      ];

      for (const message of messages) {
        const routed = router.route({
          message,
          workspaceId: "nexo",
          context: { source: "ceo-sala" },
        });
        assert(
          routed.objective.startsWith(MISSION_INTENT_MARKER),
          `mensagem "${message}" nao passou pelo marker [MISSION_INTENT]`,
        );
        assert(
          routed.metadata.source === "ceo-sala",
          "source ceo-sala deve ser preservado no metadata",
        );
        assert(
          Boolean(routed.intentType) && Boolean(routed.employeeId),
          `roteamento incompleto para "${message}"`,
        );
        observations.push(
          `"${message}" → ${routed.intentType}/${routed.employeeId}`,
        );
      }

      return passScenario(this, startedAt, observations);
    } catch (error) {
      return failScenario(this, startedAt, observations, error);
    }
  },
};
