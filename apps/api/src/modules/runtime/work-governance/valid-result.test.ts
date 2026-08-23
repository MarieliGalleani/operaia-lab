import { describe, expect, it } from "vitest";
import { isValidDelivery } from "./valid-result.js";

const FINANCE_EVIDENCE_DOMAIN = "finance_artifacts";

function validFinanceResultJson() {
  const delivery = {
    type: "financial_analysis",
    status: "DELIVERED" as const,
    employeeId: "aurora",
    missionId: "m1",
    objective: "Auditar saude financeira",
    summary: "overview 12m runway",
    findings: ["overview 12m runway"],
    evidence: [
      {
        source: "listDirectory",
        data: {
          domain: FINANCE_EVIDENCE_DOMAIN,
          artifactPath: "finance",
          summary: "finance directory",
        },
      },
      {
        source: "readFile",
        data: {
          domain: FINANCE_EVIDENCE_DOMAIN,
          artifactPath: "finance/overview.md",
          summary: "overview 12m runway",
          structured: { runwayMonths: 12, riskLevel: "medium" },
        },
      },
    ],
    recommendations: [],
    deliveredAt: new Date().toISOString(),
  };
  return {
    phase: "executed",
    delivery,
    toolExecutions: [
      { toolId: "listDirectory", success: true, outcome: "ok", at: "" },
      { toolId: "readFile", success: true, outcome: "ok", at: "" },
    ],
  };
}

describe("isValidDelivery finance P0.2H-5L", () => {
  it("PASS — financial_analysis com identityKind finance", () => {
    const resultJson = validFinanceResultJson();
    expect(
      isValidDelivery(resultJson.delivery, "finance", resultJson),
    ).toBe(true);
  });

  it("PASS — financial_analysis detectado pelo type mesmo com generic", () => {
    const resultJson = validFinanceResultJson();
    expect(
      isValidDelivery(resultJson.delivery, "generic", resultJson),
    ).toBe(true);
  });

  it("nao altera validacao technical", () => {
    const delivery = {
      type: "technical_analysis",
      status: "DELIVERED" as const,
      evidence: [{ source: "tool", data: { ok: true } }],
    };
    expect(isValidDelivery(delivery, "technical")).toBe(true);
    expect(isValidDelivery(delivery, "finance")).toBe(false);
  });

  it("nao altera validacao generica de outros specialists", () => {
    const delivery = {
      type: "ux_analysis",
      status: "DELIVERED" as const,
      evidence: [{ source: "readFile", data: { path: "README.md" } }],
    };
    expect(isValidDelivery(delivery, "generic")).toBe(true);
    expect(isValidDelivery(delivery, "finance")).toBe(false);
  });

  it("PASS — billing NOT_FOUND opcional nao invalida governanca financeira", () => {
    const resultJson = {
      ...validFinanceResultJson(),
      toolExecutions: [
        { toolId: "listDirectory", success: true, outcome: "ok", at: "" },
        { toolId: "readFile", success: true, outcome: "ok", at: "" },
        { toolId: "searchFiles", success: true, outcome: "ok", at: "" },
        {
          toolId: "listDirectory",
          success: false,
          outcome: "NOT_FOUND: Not Found",
          at: "",
        },
      ],
      delivery: {
        ...validFinanceResultJson().delivery,
        evidence: [
          ...validFinanceResultJson().delivery.evidence,
          {
            source: "listDirectory",
            data: { error: "NOT_FOUND", message: "Not Found" },
          },
        ],
      },
    };
    expect(
      isValidDelivery(resultJson.delivery, "finance", resultJson),
    ).toBe(true);
  });
});
