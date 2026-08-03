/**
 * A.V.9 — Worker Selection (intent → employee correto)
 */
import {
  ConversationMissionRouter,
  IntentType,
  RoutedEmployeeId,
} from "@operaia/mission-router";
import {
  assert,
  failScenario,
  passScenario,
  type ValidationScenario,
} from "../scenario.js";

const cases: ReadonlyArray<{
  readonly message: string;
  readonly intent: string;
  readonly employee: string;
}> = [
  {
    message: "Quais projetos temos?",
    intent: IntentType.GENERAL_CONVERSATION,
    employee: RoutedEmployeeId.opera,
  },
  {
    message: "Como está a NEXO?",
    intent: IntentType.OPERATIONAL_REVIEW,
    employee: RoutedEmployeeId.opera,
  },
  {
    message: "Quero implementar autenticação.",
    intent: IntentType.TECH_IMPLEMENTATION,
    employee: RoutedEmployeeId.mag,
  },
  {
    message: "O deploy falhou.",
    intent: IntentType.BUG_INVESTIGATION,
    employee: RoutedEmployeeId.mag,
  },
  {
    message: "O servidor caiu.",
    intent: IntentType.INFRASTRUCTURE_OPERATION,
    employee: RoutedEmployeeId.atlas,
  },
  {
    message: "Analise logs do serviço",
    intent: IntentType.INFRASTRUCTURE_OPERATION,
    employee: RoutedEmployeeId.orion,
  },
];

export const workerSelectionScenario: ValidationScenario = {
  id: "A.V.9",
  name: "Worker Selection",
  description: "Cada intent seleciona o Employee correto.",
  async run() {
    const startedAt = Date.now();
    const observations: string[] = [];
    try {
      const router = new ConversationMissionRouter();

      for (const testCase of cases) {
        const routed = router.route({
          message: testCase.message,
          workspaceId: "nexo",
          context: { source: "validation-suite" },
        });
        assert(
          routed.intentType === testCase.intent,
          `"${testCase.message}": intent ${testCase.intent} ≠ ${routed.intentType}`,
        );
        assert(
          routed.employeeId === testCase.employee,
          `"${testCase.message}": employee ${testCase.employee} ≠ ${routed.employeeId}`,
        );
        observations.push(
          `${testCase.intent} → ${routed.employeeId}`,
        );
      }

      return passScenario(this, startedAt, observations);
    } catch (error) {
      return failScenario(this, startedAt, observations, error);
    }
  },
};
