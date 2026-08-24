/**
 * P0.2H-POST.5 — contrato UX path/evidence/governance.
 */
import { describe, expect, it } from "vitest";
import {
  isUxSensitivePath,
  validateUxReadFilePath,
} from "./ux-artifact-path.js";
import {
  UX_EVIDENCE_DOMAIN,
  buildUxEvidence,
  sanitizeUxEvidenceForResultJson,
} from "./ux-evidence.js";
import {
  isValidUxAnalysisDelivery,
} from "./ux-delivery-validation.js";

describe("UX artifact path P0.2H-POST.5", () => {
  it("permite README e docs; bloqueia .env e secrets", () => {
    expect(validateUxReadFilePath("README.md").ok).toBe(true);
    expect(validateUxReadFilePath("docs/ux.md").ok).toBe(true);
    expect(validateUxReadFilePath(".env").ok).toBe(false);
    expect(validateUxReadFilePath("secrets/api.key").ok).toBe(false);
    expect(isUxSensitivePath("credentials.json")).toBe(true);
  });
});

describe("UX evidence P0.2H-POST.5", () => {
  it("buildUxEvidence exige workspaceId e nao inclui content", () => {
    const missing = buildUxEvidence({
      toolId: "readFile",
      workspaceId: "",
      artifactPath: "README.md",
      rawToolData: { content: "# Hello secret token=abc" },
    });
    expect(missing.ok).toBe(false);

    const built = buildUxEvidence({
      toolId: "readFile",
      workspaceId: "operaia-lab",
      artifactPath: "README.md",
      rawToolData: { content: "# Hello\nbody" },
    });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    expect(built.data.domain).toBe(UX_EVIDENCE_DOMAIN);
    expect(built.data.workspaceId).toBe("operaia-lab");
    expect(built.data).not.toHaveProperty("content");
    const sanitized = sanitizeUxEvidenceForResultJson({
      ...built.data,
      content: "should strip",
      api_token: "x",
    });
    expect(sanitized).not.toHaveProperty("content");
    expect(sanitized.api_token).toBe("[REDACTED]");
  });

  it("evidence sem artifactPath falha", () => {
    const built = buildUxEvidence({
      toolId: "readRepository",
      workspaceId: "operaia-lab",
      artifactPath: "repository",
      rawToolData: {
        repository: "org/repo",
        defaultBranch: "lab",
      },
    });
    expect(built.ok).toBe(true);
  });
});

describe("isValidUxAnalysisDelivery P0.2H-POST.5", () => {
  function validDelivery() {
    return {
      type: "ux_analysis",
      status: "DELIVERED" as const,
      employeeId: "luna",
      summary: "UX surface ok",
      evidence: [
        {
          source: "readRepository",
          data: {
            domain: UX_EVIDENCE_DOMAIN,
            workspaceId: "operaia-lab",
            repository: "org/repo",
            branchRef: "lab",
            artifactPath: "repository",
            analysisType: "ux_surface",
            summary: "Repo org/repo",
            structured: {},
          },
        },
        {
          source: "readFile",
          data: {
            domain: UX_EVIDENCE_DOMAIN,
            workspaceId: "operaia-lab",
            artifactPath: "README.md",
            analysisType: "ux_surface",
            summary: "File README.md bytes=10",
            structured: { byteLength: 10 },
          },
        },
      ],
    };
  }

  it("1 — deliveryType ux_analysis valido → PASS", () => {
    expect(isValidUxAnalysisDelivery(validDelivery())).toBe(true);
  });

  it("3 — evidence sem workspace → FAIL", () => {
    const delivery = validDelivery();
    delivery.evidence[1]!.data = {
      ...delivery.evidence[1]!.data,
      workspaceId: "",
    };
    expect(isValidUxAnalysisDelivery(delivery)).toBe(false);
  });

  it("4 — evidence sem source/artefact → FAIL", () => {
    expect(
      isValidUxAnalysisDelivery({
        ...validDelivery(),
        evidence: [
          {
            source: "readRepository",
            data: {
              domain: UX_EVIDENCE_DOMAIN,
              workspaceId: "operaia-lab",
              artifactPath: "repository",
              analysisType: "ux_surface",
              summary: "ok",
              structured: { name: "only-repo" },
            },
          },
        ],
      }),
    ).toBe(false);
  });

  it("6 — fullContent indevido → FAIL", () => {
    const delivery = validDelivery();
    expect(
      isValidUxAnalysisDelivery({
        ...delivery,
        evidence: [
          delivery.evidence[0]!,
          {
            source: "readFile",
            data: {
              domain: UX_EVIDENCE_DOMAIN,
              workspaceId: "operaia-lab",
              artifactPath: "README.md",
              analysisType: "ux_surface",
              summary: "File README.md bytes=10",
              structured: { byteLength: 10 },
              content: "# full dump",
            },
          },
        ],
      }),
    ).toBe(false);
  });

  it("7 — secrets na evidence → FAIL", () => {
    const delivery = validDelivery();
    expect(
      isValidUxAnalysisDelivery({
        ...delivery,
        evidence: [
          delivery.evidence[0]!,
          {
            source: "readFile",
            data: {
              domain: UX_EVIDENCE_DOMAIN,
              workspaceId: "operaia-lab",
              artifactPath: "README.md",
              analysisType: "ux_surface",
              summary: "Bearer abcdefghijklmnop",
              structured: { byteLength: 10 },
            },
          },
        ],
      }),
    ).toBe(false);
  });
});
