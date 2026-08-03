/**
 * Contrato de cenario da Validation Suite (Sprint A.V).
 * Sem features de produto — apenas prova operacional.
 */

export type ScenarioStatus = "passed" | "failed";

export interface ScenarioResult {
  readonly id: string;
  readonly name: string;
  readonly status: ScenarioStatus;
  readonly durationMs: number;
  readonly observations: readonly string[];
  readonly error?: string;
}

export interface ValidationScenario {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  run(): Promise<ScenarioResult>;
}

export function passScenario(
  scenario: Pick<ValidationScenario, "id" | "name">,
  startedAt: number,
  observations: readonly string[],
): ScenarioResult {
  return {
    id: scenario.id,
    name: scenario.name,
    status: "passed",
    durationMs: Date.now() - startedAt,
    observations,
  };
}

export function failScenario(
  scenario: Pick<ValidationScenario, "id" | "name">,
  startedAt: number,
  observations: readonly string[],
  error: unknown,
): ScenarioResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    id: scenario.id,
    name: scenario.name,
    status: "failed",
    durationMs: Date.now() - startedAt,
    observations,
    error: message,
  };
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
