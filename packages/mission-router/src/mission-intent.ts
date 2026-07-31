/**
 * Resultado do Mission Intent Router.
 */
import type { IntentType } from "./intent-type.js";

export type MissionIntentPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface MissionIntent {
  readonly message: string;
  readonly workspaceId: string;
  readonly intentType: IntentType;
  readonly priority: MissionIntentPriority;
  /** Employee id do sistema (ex.: cto-mag, operaia-ceo, atlas). */
  readonly suggestedEmployee: string;
  readonly confidence: number;
}
