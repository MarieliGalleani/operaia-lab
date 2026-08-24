import { describe, expect, it } from "vitest";
import {
  isValidLegalAnalysisDelivery,
  isValidLegalResultJson,
} from "./legal-delivery-validation.js";

function validLegalDelivery() {
  return {
    type: "legal_analysis",
    status: "DELIVERED" as const,
    employeeId: "themis",
    summary: "Compliance e documentos juridicos inspecionados no repo bound.",
    findings: ["README presente"],
    evidence: [
      {
        source: "listDirectory",
        data: {
          domain: "legal_artifacts",
          workspaceId: "operaia-lab",
          artifactPath: "",
          analysisType: "legal_surface",
          summary: "Dir path=/ entries=3",
          structured: { entryCount: 3 },
        },
      },
      {
        source: "readFile",
        data: {
          domain: "legal_artifacts",
          workspaceId: "operaia-lab",
          artifactPath: "README.md",
          analysisType: "legal_surface",
          summary: "File README.md bytes=40",
          structured: { byteLength: 40, hasHeading: true },
        },
      },
    ],
  };
}

describe("isValidLegalAnalysisDelivery", () => {
  it("PASS — legal_analysis com evidence governada", () => {
    const delivery = validLegalDelivery();
    const tools = [
      { toolId: "listDirectory", success: true },
      { toolId: "readFile", success: true },
    ];
    expect(isValidLegalAnalysisDelivery(delivery, tools)).toBe(true);
    expect(
      isValidLegalResultJson({ delivery, toolExecutions: tools }),
    ).toBe(true);
  });

  it("FAIL — DELIVERED + evidence fraca sem dominio", () => {
    const delivery = {
      type: "legal_analysis",
      status: "DELIVERED" as const,
      employeeId: "themis",
      summary: "ok",
      evidence: [{ source: "readFile", data: { path: "README.md" } }],
    };
    expect(isValidLegalAnalysisDelivery(delivery)).toBe(false);
  });

  it("FAIL — fullContent / content na evidence", () => {
    const delivery = validLegalDelivery();
    expect(
      isValidLegalAnalysisDelivery({
        ...delivery,
        evidence: [
          delivery.evidence[0]!,
          {
            source: "readFile",
            data: {
              ...delivery.evidence[1]!.data,
              content: "# raw body",
            },
          },
        ],
      }),
    ).toBe(false);
  });

  it("FAIL — path sensivel .env", () => {
    const delivery = validLegalDelivery();
    expect(
      isValidLegalAnalysisDelivery({
        ...delivery,
        evidence: [
          delivery.evidence[0]!,
          {
            source: "readFile",
            data: {
              domain: "legal_artifacts",
              workspaceId: "operaia-lab",
              artifactPath: ".env",
              analysisType: "legal_surface",
              summary: "secret",
              structured: { byteLength: 0 },
            },
          },
        ],
      }),
    ).toBe(false);
  });

  it("FAIL — employeeId errado", () => {
    const delivery = { ...validLegalDelivery(), employeeId: "luna" };
    expect(isValidLegalAnalysisDelivery(delivery)).toBe(false);
  });

  it("FAIL — deliveryType incorreto", () => {
    const delivery = {
      ...validLegalDelivery(),
      type: "marketing_analysis",
    };
    expect(isValidLegalAnalysisDelivery(delivery)).toBe(false);
  });

  it("FAIL — tool proibida nos toolExecutions", () => {
    const delivery = validLegalDelivery();
    expect(
      isValidLegalAnalysisDelivery(delivery, [
        { toolId: "readLogs", success: false },
      ]),
    ).toBe(false);
  });

  it("FAIL — readRepository nao e tool Legal", () => {
    const delivery = validLegalDelivery();
    expect(
      isValidLegalAnalysisDelivery(delivery, [
        { toolId: "readRepository", success: true },
      ]),
    ).toBe(false);
  });

  it("FAIL — workspaceId inconsistente", () => {
    const delivery = validLegalDelivery();
    expect(
      isValidLegalAnalysisDelivery({
        ...delivery,
        evidence: [
          {
            source: "listDirectory",
            data: {
              ...delivery.evidence[0]!.data,
              workspaceId: "other-ws",
            },
          },
          delivery.evidence[1]!,
        ],
      }),
    ).toBe(false);
  });
});
