import { describe, expect, it } from "vitest";
import {
  ALL_VALIDATION_SCENARIOS,
  ValidationRunner,
  buildValidationReport,
} from "../src/index.js";

describe("Sprint A.V + A.5.3 — Operational Validation Suite", () => {
  it("expoe 12 cenarios A.V + 6 hardening A.5.3", () => {
    expect(ALL_VALIDATION_SCENARIOS).toHaveLength(18);
    const ids = ALL_VALIDATION_SCENARIOS.map((s) => s.id);
    expect(ids.slice(0, 12)).toEqual([
      "A.V.1",
      "A.V.2",
      "A.V.3",
      "A.V.4",
      "A.V.5",
      "A.V.6",
      "A.V.7",
      "A.V.8",
      "A.V.9",
      "A.V.10",
      "A.V.11",
      "A.V.12",
    ]);
    expect(ids.slice(12)).toEqual([
      "A.5.3.1",
      "A.5.3.2",
      "A.5.3.3",
      "A.5.3.4",
      "A.5.3.5",
      "A.5.3.6",
    ]);
  });

  it("ValidationRunner.run() retorna sucesso em todos os cenarios", async () => {
    const runner = new ValidationRunner({
      packageVersions: {
        "@operaia/validation-suite": "0.1.0",
        "@operaia/mission-router": "0.1.0",
        "@operaia/action-runtime": "0.1.0",
        "@operaia/operational-health": "0.1.0",
      },
    });
    const result = await runner.run();

    expect(result.executedScenarios).toBe(18);
    expect(result.passed).toBe(18);
    expect(result.failed).toBe(0);
    expect(result.success).toBe(true);
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.report.title).toBe("Sprint A Validation Report");
    expect(result.report.text).toContain("Resultado final");
    expect(result.proof.title).toBe("Sprint A Operational Proof");
    expect(result.proof.markdown).toContain("Arquitetura validada");
    expect(result.proof.approvedFlows).toHaveLength(18);
    expect(result.proof.rejectedFlows).toHaveLength(0);
  });

  it("buildValidationReport marca falha quando ha cenario reprovado", () => {
    const report = buildValidationReport({
      durationMs: 10,
      results: [
        {
          id: "X",
          name: "demo",
          status: "failed",
          durationMs: 1,
          observations: [],
          error: "boom",
        },
      ],
    });
    expect(report.success).toBe(false);
    expect(report.failed).toBe(1);
    expect(report.text).toContain("FALHA");
  });
});
