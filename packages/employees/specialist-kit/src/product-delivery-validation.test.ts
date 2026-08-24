import { describe, expect, it } from "vitest";
import {
  isValidProductAnalysisDelivery,
  isValidProductResultJson,
} from "./product-delivery-validation.js";

function validProductDelivery() {
  return {
    type: "product_analysis",
    status: "DELIVERED" as const,
    employeeId: "nexus",
    summary: "Roadmap e priorizacao inspecionados no repo bound.",
    findings: ["README presente"],
    evidence: [
      {
        source: "listDirectory",
        data: {
          domain: "product_artifacts",
          workspaceId: "operaia-lab",
          artifactPath: "",
          analysisType: "product_surface",
          summary: "Dir path=/ entries=3",
          structured: { entryCount: 3 },
        },
      },
      {
        source: "readFile",
        data: {
          domain: "product_artifacts",
          workspaceId: "operaia-lab",
          artifactPath: "README.md",
          analysisType: "product_surface",
          summary: "File README.md bytes=40",
          structured: { byteLength: 40, hasHeading: true },
        },
      },
    ],
  };
}

describe("isValidProductAnalysisDelivery", () => {
  it("PASS — product_analysis com evidence governada", () => {
    const delivery = validProductDelivery();
    const tools = [
      { toolId: "listDirectory", success: true },
      { toolId: "readFile", success: true },
    ];
    expect(isValidProductAnalysisDelivery(delivery, tools)).toBe(true);
    expect(
      isValidProductResultJson({ delivery, toolExecutions: tools }),
    ).toBe(true);
  });

  it("FAIL — DELIVERED + evidence fraca sem dominio", () => {
    const delivery = {
      type: "product_analysis",
      status: "DELIVERED" as const,
      employeeId: "nexus",
      summary: "ok",
      evidence: [{ source: "readFile", data: { path: "README.md" } }],
    };
    expect(isValidProductAnalysisDelivery(delivery)).toBe(false);
  });

  it("FAIL — fullContent / content na evidence", () => {
    const delivery = validProductDelivery();
    expect(
      isValidProductAnalysisDelivery({
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
    const delivery = validProductDelivery();
    expect(
      isValidProductAnalysisDelivery({
        ...delivery,
        evidence: [
          delivery.evidence[0]!,
          {
            source: "readFile",
            data: {
              domain: "product_artifacts",
              workspaceId: "operaia-lab",
              artifactPath: ".env",
              analysisType: "product_surface",
              summary: "secret",
              structured: { byteLength: 0 },
            },
          },
        ],
      }),
    ).toBe(false);
  });

  it("FAIL — employeeId errado", () => {
    const delivery = { ...validProductDelivery(), employeeId: "luna" };
    expect(isValidProductAnalysisDelivery(delivery)).toBe(false);
  });

  it("FAIL — deliveryType incorreto", () => {
    const delivery = {
      ...validProductDelivery(),
      type: "marketing_analysis",
    };
    expect(isValidProductAnalysisDelivery(delivery)).toBe(false);
  });

  it("FAIL — tool proibida nos toolExecutions", () => {
    const delivery = validProductDelivery();
    expect(
      isValidProductAnalysisDelivery(delivery, [
        { toolId: "readLogs", success: false },
      ]),
    ).toBe(false);
  });

  it("FAIL — readRepository nao e tool Product", () => {
    const delivery = validProductDelivery();
    expect(
      isValidProductAnalysisDelivery(delivery, [
        { toolId: "readRepository", success: true },
      ]),
    ).toBe(false);
  });

  it("FAIL — workspaceId inconsistente", () => {
    const delivery = validProductDelivery();
    expect(
      isValidProductAnalysisDelivery({
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
