import { describe, expect, it } from "vitest";
import {
  buildExecutionReport,
  consolidateExecutionReports,
} from "./execution-report.js";

describe("ExecutionReport", () => {
  it("monta relatorio estruturado do especialista", () => {
    const report = buildExecutionReport({
      employeeId: "cto-mag",
      summary: "API ok",
      analysis: "Diff revisado",
      risks: ["lock"],
      recommendations: ["ship"],
      qualityPassed: true,
      executionTime: 42,
    });
    expect(report).toMatchObject({
      employeeId: "cto-mag",
      summary: "API ok",
      confidence: 0.85,
      executionTime: 42,
    });
    expect(report.findings).toContain("Diff revisado");
  });

  it("Opera consolida multiplos ExecutionReports", () => {
    const consolidated = consolidateExecutionReports([
      buildExecutionReport({
        employeeId: "cto-mag",
        summary: "Backend",
        recommendations: ["test"],
        executionTime: 10,
      }),
      buildExecutionReport({
        employeeId: "luna",
        summary: "UI",
        risks: ["a11y"],
        executionTime: 20,
      }),
    ]);
    expect(consolidated.summary).toContain("cto-mag");
    expect(consolidated.summary).toContain("luna");
    expect(consolidated.totalExecutionTime).toBe(30);
    expect(consolidated.risks).toContain("a11y");
  });
});
