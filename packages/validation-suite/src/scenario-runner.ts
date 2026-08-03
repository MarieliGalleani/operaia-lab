/**
 * Executa uma lista de ValidationScenario sequencialmente.
 */
import type { ScenarioResult, ValidationScenario } from "./scenario.js";

export async function runScenarios(
  scenarios: readonly ValidationScenario[],
): Promise<readonly ScenarioResult[]> {
  const results: ScenarioResult[] = [];
  for (const scenario of scenarios) {
    results.push(await scenario.run());
  }
  return results;
}
