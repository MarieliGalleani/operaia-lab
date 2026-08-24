import { describe, expect, it } from "vitest";
import {
  isValidMarketingAnalysisDelivery,
  isValidMarketingResultJson,
} from "./marketing-delivery-validation.js";

function validMarketingDelivery() {
  return {
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
}

describe("isValidMarketingAnalysisDelivery", () => {
  it("PASS — marketing_analysis com evidence governada", () => {
    const delivery = validMarketingDelivery();
    const tools = [
      { toolId: "readRepository", success: true },
      { toolId: "listDirectory", success: true },
      { toolId: "readFile", success: true },
    ];
    expect(isValidMarketingAnalysisDelivery(delivery, tools)).toBe(true);
    expect(
      isValidMarketingResultJson({ delivery, toolExecutions: tools }),
    ).toBe(true);
  });

  it("FAIL — DELIVERED + evidence fraca sem dominio", () => {
    const delivery = {
      type: "marketing_analysis",
      status: "DELIVERED" as const,
      employeeId: "mercurio",
      summary: "ok",
      evidence: [{ source: "readFile", data: { path: "README.md" } }],
    };
    expect(isValidMarketingAnalysisDelivery(delivery)).toBe(false);
  });

  it("FAIL — fullContent / content na evidence", () => {
    const delivery = validMarketingDelivery();
    expect(
      isValidMarketingAnalysisDelivery({
        ...delivery,
        evidence: [
          delivery.evidence[0]!,
          delivery.evidence[1]!,
          {
            source: "readFile",
            data: {
              ...delivery.evidence[2]!.data,
              content: "# raw body",
            },
          },
        ],
      }),
    ).toBe(false);
  });

  it("FAIL — path sensivel .env", () => {
    const delivery = validMarketingDelivery();
    expect(
      isValidMarketingAnalysisDelivery({
        ...delivery,
        evidence: [
          delivery.evidence[0]!,
          delivery.evidence[1]!,
          {
            source: "readFile",
            data: {
              domain: "marketing_artifacts",
              workspaceId: "operaia-lab",
              artifactPath: ".env",
              analysisType: "marketing_surface",
              summary: "secret",
              structured: { byteLength: 0 },
            },
          },
        ],
      }),
    ).toBe(false);
  });

  it("FAIL — employeeId errado", () => {
    const delivery = { ...validMarketingDelivery(), employeeId: "luna" };
    expect(isValidMarketingAnalysisDelivery(delivery)).toBe(false);
  });

  it("FAIL — tool proibida nos toolExecutions", () => {
    const delivery = validMarketingDelivery();
    expect(
      isValidMarketingAnalysisDelivery(delivery, [
        { toolId: "readLogs", success: false },
      ]),
    ).toBe(false);
  });

  it("FAIL — workspaceId inconsistente", () => {
    const delivery = validMarketingDelivery();
    expect(
      isValidMarketingAnalysisDelivery({
        ...delivery,
        evidence: [
          delivery.evidence[0]!,
          {
            source: "listDirectory",
            data: {
              ...delivery.evidence[1]!.data,
              workspaceId: "other-ws",
            },
          },
          delivery.evidence[2]!,
        ],
      }),
    ).toBe(false);
  });
});
