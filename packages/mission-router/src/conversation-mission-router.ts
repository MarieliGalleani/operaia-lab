/**
 * ConversationMissionRouter — porta unica de entrada conversacional (A.5.1).
 * Toda mensagem de sala/chat passa pelo MissionIntentRouter antes da missao.
 */
import { IntentType } from "./intent-type.js";
import type { MissionIntent } from "./mission-intent.js";
import {
  defaultIntentRouter,
  formatObjectiveWithIntent,
  type IntentRouter,
} from "./intent-router.js";

export type ConversationMissionType =
  | "COORDINATE"
  | "CONVERSATION"
  | "SPECIALIST_COORDINATE";

export interface ConversationRouteContext {
  readonly employeeId?: string;
  /** Ex.: "ceo-sala" | "operations" | "ask" */
  readonly source?: string;
}

export interface ConversationRouteInput {
  readonly message: string;
  readonly workspaceId: string;
  readonly context?: ConversationRouteContext;
}

export interface ConversationRouteResult {
  readonly intentType: IntentType;
  readonly employeeId: string;
  readonly missionType: ConversationMissionType;
  /** Objective ja com [MISSION_INTENT] para a missao. */
  readonly objective: string;
  readonly metadata: {
    readonly originalMessage: string;
    readonly workspaceId: string;
    readonly confidence: number;
    readonly priority: MissionIntent["priority"];
    readonly source?: string;
    readonly requestedEmployeeId?: string;
  };
}

export interface ConversationMissionRouterOptions {
  readonly intentRouter?: IntentRouter;
}

/**
 * Garante: message + workspaceId + context → MissionIntentRouter → resultado tipado.
 */
export class ConversationMissionRouter {
  private readonly intentRouter: IntentRouter;

  constructor(options: ConversationMissionRouterOptions = {}) {
    this.intentRouter = options.intentRouter ?? defaultIntentRouter;
  }

  route(input: ConversationRouteInput): ConversationRouteResult {
    const message = input.message.trim();
    const intent = this.intentRouter.route(message, input.workspaceId);
    const missionType = resolveMissionType(intent.intentType);
    const objective = formatObjectiveWithIntent(message, intent);

    const result: ConversationRouteResult = {
      intentType: intent.intentType,
      employeeId: intent.suggestedEmployee,
      missionType,
      objective,
      metadata: {
        originalMessage: message,
        workspaceId: input.workspaceId,
        confidence: intent.confidence,
        priority: intent.priority,
        source: input.context?.source,
        requestedEmployeeId: input.context?.employeeId,
      },
    };

    console.log(
      JSON.stringify({
        level: "info",
        component: "conversation-mission-router",
        event: "routed",
        message: result.metadata.originalMessage,
        intent: result.intentType,
        employee: result.employeeId,
        missionType: result.missionType,
        workspaceId: result.metadata.workspaceId,
        source: result.metadata.source ?? null,
        confidence: result.metadata.confidence,
      }),
    );

    return result;
  }
}

export const defaultConversationMissionRouter =
  new ConversationMissionRouter();

function resolveMissionType(intentType: IntentType): ConversationMissionType {
  switch (intentType) {
    case IntentType.GENERAL_CONVERSATION:
      return "CONVERSATION";
    case IntentType.TECH_IMPLEMENTATION:
    case IntentType.BUG_INVESTIGATION:
    case IntentType.INFRASTRUCTURE_OPERATION:
      return "SPECIALIST_COORDINATE";
    case IntentType.OPERATIONAL_REVIEW:
    case IntentType.PROJECT_PLANNING:
    case IntentType.EXECUTIVE_DECISION:
    default:
      return "COORDINATE";
  }
}
