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
      type: "ops_analysis",
      status: "DELIVERED" as const,
      evidence: [{ source: "readFile", data: { path: "README.md" } }],
    };
    expect(isValidDelivery(delivery, "generic")).toBe(true);
    expect(isValidDelivery(delivery, "finance")).toBe(false);
  });

  it("ux_analysis fraco (sem contrato) falha governance UX", () => {
    const delivery = {
      type: "ux_analysis",
      status: "DELIVERED" as const,
      evidence: [{ source: "readFile", data: { path: "README.md" } }],
    };
    expect(isValidDelivery(delivery, "generic")).toBe(false);
    expect(isValidDelivery(delivery, "ux")).toBe(false);
  });

  it("PASS — ux_analysis com evidence governada", () => {
    const delivery = {
      type: "ux_analysis",
      status: "DELIVERED" as const,
      employeeId: "luna",
      summary: "Superficie UX inspecionada no repo bound.",
      findings: ["README presente"],
      evidence: [
        {
          source: "readRepository",
          data: {
            domain: "ux_artifacts",
            workspaceId: "operaia-lab",
            repository: "marieligalleani/operaia-lab",
            branchRef: "lab",
            artifactPath: "repository",
            analysisType: "ux_surface",
            summary: "Repo marieligalleani/operaia-lab branch=lab",
            structured: { name: "operaia-lab" },
          },
        },
        {
          source: "listDirectory",
          data: {
            domain: "ux_artifacts",
            workspaceId: "operaia-lab",
            artifactPath: "",
            analysisType: "ux_surface",
            summary: "Dir path=/ entries=3",
            structured: { entryCount: 3 },
          },
        },
        {
          source: "readFile",
          data: {
            domain: "ux_artifacts",
            workspaceId: "operaia-lab",
            artifactPath: "README.md",
            analysisType: "ux_surface",
            summary: "File README.md bytes=42",
            structured: { byteLength: 42, hasHeading: true },
          },
        },
      ],
    };
    const resultJson = {
      delivery,
      toolExecutions: [
        { toolId: "readRepository", success: true, outcome: "ok" },
        { toolId: "listDirectory", success: true, outcome: "ok" },
        { toolId: "readFile", success: true, outcome: "ok" },
      ],
    };
    expect(isValidDelivery(delivery, "ux", resultJson)).toBe(true);
    expect(isValidDelivery(delivery, "generic", resultJson)).toBe(true);
    expect(isValidDelivery(delivery, "finance", resultJson)).toBe(false);
  });

  it("marketing_analysis fraco (sem contrato) falha governance Marketing", () => {
    const delivery = {
      type: "marketing_analysis",
      status: "DELIVERED" as const,
      evidence: [{ source: "readFile", data: { path: "README.md" } }],
    };
    expect(isValidDelivery(delivery, "generic")).toBe(false);
    expect(isValidDelivery(delivery, "marketing")).toBe(false);
  });

  it("PASS — marketing_analysis com evidence governada", () => {
    const delivery = {
      type: "marketing_analysis",
      status: "DELIVERED" as const,
      employeeId: "mercurio",
      summary: "Posicionamento e narrativa inspecionados no repo bound.",
      findings: ["README presente"],
      evidence: [
        {
          source: "readRepository",
          data: {
            domain: "marketing_artifacts",
            workspaceId: "operaia-lab",
            repository: "marieligalleani/operaia-lab",
            branchRef: "lab",
            artifactPath: "repository",
            analysisType: "marketing_surface",
            summary: "Repo marieligalleani/operaia-lab branch=lab",
            structured: { name: "operaia-lab" },
          },
        },
        {
          source: "listDirectory",
          data: {
            domain: "marketing_artifacts",
            workspaceId: "operaia-lab",
            artifactPath: "",
            analysisType: "marketing_surface",
            summary: "Dir path=/ entries=3",
            structured: { entryCount: 3 },
          },
        },
        {
          source: "readFile",
          data: {
            domain: "marketing_artifacts",
            workspaceId: "operaia-lab",
            artifactPath: "README.md",
            analysisType: "marketing_surface",
            summary: "File README.md bytes=40",
            structured: { byteLength: 40, hasHeading: true },
          },
        },
      ],
    };
    const resultJson = {
      delivery,
      toolExecutions: [
        { toolId: "readRepository", success: true, outcome: "ok" },
        { toolId: "listDirectory", success: true, outcome: "ok" },
        { toolId: "readFile", success: true, outcome: "ok" },
      ],
    };
    expect(isValidDelivery(delivery, "marketing", resultJson)).toBe(true);
    expect(isValidDelivery(delivery, "generic", resultJson)).toBe(true);
    expect(isValidDelivery(delivery, "ux", resultJson)).toBe(false);
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
