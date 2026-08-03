/**
 * ValidationReport — formato textual da Sprint A Validation Suite.
 */
import type { ScenarioResult } from "./scenario.js";

export interface ValidationReport {
  readonly title: string;
  readonly generatedAt: string;
  readonly success: boolean;
  readonly executedScenarios: number;
  readonly passed: number;
  readonly failed: number;
  readonly durationMs: number;
  readonly results: readonly ScenarioResult[];
  readonly text: string;
}

export function buildValidationReport(input: {
  readonly results: readonly ScenarioResult[];
  readonly durationMs: number;
  readonly generatedAt?: string;
}): ValidationReport {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const passed = input.results.filter((r) => r.status === "passed").length;
  const failed = input.results.filter((r) => r.status === "failed").length;
  const success = failed === 0 && input.results.length > 0;

  const lines: string[] = [
    "Sprint A Validation Report",
    "",
    `Gerado em: ${generatedAt}`,
    `Duracao total: ${input.durationMs}ms`,
    "",
    "| Scenario | Status | Duration | Observacoes |",
    "|---|---|---|---|",
  ];

  for (const result of input.results) {
    const obs = result.observations.join("; ") || "—";
    const status = result.status === "passed" ? "PASSED" : "FAILED";
    const note = result.error ? `${obs} | erro: ${result.error}` : obs;
    lines.push(
      `| ${result.name} (${result.id}) | ${status} | ${result.durationMs}ms | ${escapeCell(note)} |`,
    );
  }

  lines.push("");
  lines.push("Resultado final");
  lines.push(
    success
      ? `SUCESSO — ${passed}/${input.results.length} cenarios aprovados.`
      : `FALHA — ${failed} cenario(s) reprovado(s) de ${input.results.length}.`,
  );

  return {
    title: "Sprint A Validation Report",
    generatedAt,
    success,
    executedScenarios: input.results.length,
    passed,
    failed,
    durationMs: input.durationMs,
    results: input.results,
    text: lines.join("\n"),
  };
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "/").replace(/\n/g, " ");
}
