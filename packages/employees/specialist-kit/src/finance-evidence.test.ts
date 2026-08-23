import { describe, expect, it } from "vitest";
import {
  EVIDENCE_PII_BLOCKED,
  FINANCE_EVIDENCE_DOMAIN,
  buildFinanceEvidence,
  containsResidualFinancePii,
  isFinanceDenyKey,
  parseFinanceFrontmatter,
  redactFinancePiiInText,
  sanitizeFinanceEvidenceForResultJson,
  validateSanitizedFinanceEvidence,
} from "./finance-evidence.js";

const WORKSPACE_ID = "operaia-lab";
const REPOSITORY = "marieligalleani/operaia-lab";

const OVERVIEW_FRONTMATTER = `---
schemaVersion: 1
period: 2026-Q1
currency: BRL
runwayMonths: 12
monthlyBurn: 85000
monthlyRevenue: 120000
riskLevel: medium
notes: agregado sem PII
---
# Overview
Corpo longo que nao deve ir para evidence integral.
`;

describe("Finance evidence P0.2H-5K — proveniencia", () => {
  it("readFile produz evidence com campos obrigatorios", () => {
    const built = buildFinanceEvidence({
      toolId: "readFile",
      workspaceId: WORKSPACE_ID,
      repository: REPOSITORY,
      artifactPath: "finance/overview.md",
      rawToolData: {
        repository: REPOSITORY,
        path: "finance/overview.md",
        content: OVERVIEW_FRONTMATTER,
      },
    });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    expect(built.data.domain).toBe(FINANCE_EVIDENCE_DOMAIN);
    expect(built.data.workspaceId).toBe(WORKSPACE_ID);
    expect(built.data.repository).toBe(REPOSITORY);
    expect(built.data.artifactPath).toBe("finance/overview.md");
    expect(String(built.data.summary)).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
    expect(built.data.structured).toBeDefined();
  });

  it("listDirectory produz evidence financeira valida", () => {
    const built = buildFinanceEvidence({
      toolId: "listDirectory",
      workspaceId: WORKSPACE_ID,
      repository: REPOSITORY,
      artifactPath: "finance",
      rawToolData: {
        repository: REPOSITORY,
        path: "finance",
        entries: [{ name: "overview.md", type: "file" }],
      },
    });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    expect(built.data.domain).toBe(FINANCE_EVIDENCE_DOMAIN);
    expect(built.data.artifactPath).toBe("finance");
    expect(String(built.data.summary)).toContain("directory");
  });

  it("searchFiles produz evidence com pathPrefix finance/", () => {
    const built = buildFinanceEvidence({
      toolId: "searchFiles",
      workspaceId: WORKSPACE_ID,
      repository: REPOSITORY,
      artifactPath: "finance/",
      rawToolData: {
        repository: REPOSITORY,
        query: "overview",
        pathPrefix: "finance/",
        hits: [{ path: "finance/overview.md" }],
      },
    });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    expect(built.data.domain).toBe(FINANCE_EVIDENCE_DOMAIN);
    expect(built.data.artifactPath).toBe("finance/");
    expect(built.data.hitCount).toBe(1);
  });
});

describe("Finance evidence P0.2H-5K — structured", () => {
  it("parseia frontmatter sem carregar body integral", () => {
    const structured = parseFinanceFrontmatter(OVERVIEW_FRONTMATTER);
    expect(structured).toMatchObject({
      schemaVersion: 1,
      runwayMonths: 12,
      monthlyBurn: 85000,
      monthlyRevenue: 120000,
      riskLevel: "medium",
    });
    const built = buildFinanceEvidence({
      toolId: "readFile",
      workspaceId: WORKSPACE_ID,
      repository: REPOSITORY,
      artifactPath: "finance/overview.md",
      rawToolData: { content: OVERVIEW_FRONTMATTER, repository: REPOSITORY },
    });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    expect(built.data.structured).toBeDefined();
    expect(built.data.contentExcerpt).toBeUndefined();
    expect(JSON.stringify(built.data)).not.toContain("Corpo longo");
  });
});

describe("Finance evidence P0.2H-5K — contentExcerpt", () => {
  it("limita excerpt a 500 caracteres apos redacao", () => {
    const body = "x".repeat(700);
    const built = buildFinanceEvidence({
      toolId: "readFile",
      workspaceId: WORKSPACE_ID,
      repository: REPOSITORY,
      artifactPath: "finance/budget.md",
      rawToolData: { content: body, repository: REPOSITORY },
    });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    const excerpt = String(built.data.contentExcerpt ?? "");
    expect(excerpt.length).toBeLessThanOrEqual(500);
  });
});

describe("Finance evidence P0.2H-5K — sanitizacao deny keys", () => {
  const denyKeys = [
    "password",
    "secret",
    "token",
    "api_key",
    "account_number",
    "iban",
    "cpf",
    "cnpj",
    "credit_card",
    "cvv",
    "bank_account",
    "routing_number",
    "client_secret",
    "authorization",
  ];

  it("detecta variacoes de casing em deny keys", () => {
    expect(isFinanceDenyKey("password")).toBe(true);
    expect(isFinanceDenyKey("PASSWORD")).toBe(true);
    expect(isFinanceDenyKey("clientSecret")).toBe(true);
    expect(isFinanceDenyKey("client_secret")).toBe(true);
    expect(isFinanceDenyKey("apiKey")).toBe(true);
    expect(isFinanceDenyKey("creditCard")).toBe(true);
    expect(isFinanceDenyKey("monthlyRevenue")).toBe(false);
    expect(isFinanceDenyKey("runwayMonths")).toBe(false);
  });

  it("redige deny keys em resultJson sanitizado", () => {
    const input: Record<string, unknown> = {};
    for (const key of denyKeys) {
      input[key] = "valor-sensivel";
    }
    input.monthlyBurn = 85000;
    const sanitized = sanitizeFinanceEvidenceForResultJson(input) as Record<
      string,
      unknown
    >;
    for (const key of denyKeys) {
      expect(sanitized[key]).toBe("[REDACTED]");
    }
    expect(sanitized.monthlyBurn).toBe(85000);
  });
});

describe("Finance evidence P0.2H-5K — PII", () => {
  it("redige CPF, CNPJ e cartao no texto", () => {
    const text =
      "titular 123.456.789-01 empresa 12.345.678/0001-90 cartao 4111 1111 1111 1111";
    const redacted = redactFinancePiiInText(text);
    expect(redacted).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
    expect(redacted).not.toMatch(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    expect(redacted).not.toMatch(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/);
    expect(containsResidualFinancePii(redacted)).toBe(false);
  });

  it("EVIDENCE_PII_BLOCKED quando PII residual permanece", () => {
    const blocked = validateSanitizedFinanceEvidence({
      domain: FINANCE_EVIDENCE_DOMAIN,
      workspaceId: WORKSPACE_ID,
      repository: REPOSITORY,
      artifactPath: "finance/overview.md",
      summary: "titular 123.456.789-01",
    });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) {
      return;
    }
    expect(blocked.code).toBe(EVIDENCE_PII_BLOCKED);
  });
});

describe("Finance evidence P0.2H-5K — path invalido", () => {
  const invalidPaths = [
    "README.md",
    "packages/foo.ts",
    "../finance/overview.md",
    "/finance/overview.md",
    "finance/../README.md",
  ];

  it("nao cria evidence para paths fora de finance/billing", () => {
    for (const artifactPath of invalidPaths) {
      const built = buildFinanceEvidence({
        toolId: "readFile",
        workspaceId: WORKSPACE_ID,
        repository: REPOSITORY,
        artifactPath,
        rawToolData: { repository: REPOSITORY, content: "x" },
      });
      expect(built.ok).toBe(false);
    }
  });
});

describe("Finance evidence P0.2H-5K — full content proibido", () => {
  it("nao persiste content/body/rawContent/fullContent na evidence", () => {
    const longContent = "segredo ".repeat(500);
    const built = buildFinanceEvidence({
      toolId: "readFile",
      workspaceId: WORKSPACE_ID,
      repository: REPOSITORY,
      artifactPath: "finance/overview.md",
      rawToolData: {
        repository: REPOSITORY,
        content: longContent,
        body: longContent,
        rawContent: longContent,
        fullContent: longContent,
      },
    });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    expect(built.data.content).toBeUndefined();
    expect(built.data.body).toBeUndefined();
    expect(built.data.rawContent).toBeUndefined();
    expect(built.data.fullContent).toBeUndefined();
    const excerpt = String(built.data.contentExcerpt ?? "");
    expect(excerpt.length).toBeLessThanOrEqual(500);
    expect(longContent.length).toBeGreaterThan(excerpt.length);
  });
});

describe("Finance evidence P0.2H-5K — resultJson", () => {
  it("sanitiza secrets, PII e body integral em payload persistivel", () => {
    const payload = {
      delivery: {
        evidence: [
          {
            source: "readFile",
            data: {
              domain: FINANCE_EVIDENCE_DOMAIN,
              summary: "overview",
              token: "sk-live-secret",
              content: "corpo integral ".repeat(200),
              notes: "cpf 123.456.789-01",
            },
          },
        ],
      },
    };
    const sanitized = sanitizeFinanceEvidenceForResultJson(payload) as {
      delivery: { evidence: { data: Record<string, unknown> }[] };
    };
    const data = sanitized.delivery.evidence[0]?.data ?? {};
    expect(data.token).toBe("[REDACTED]");
    expect(data.content).toBeUndefined();
    expect(String(data.notes)).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  });
});

describe("Finance evidence P0.2H-5K — regressao nao financeira", () => {
  it("sanitizeFinanceEvidenceForResultJson preserva campos agregados legitimos", () => {
    const infra = {
      path: "docker-compose.yml",
      artifacts: [{ name: "compose", type: "file" }],
      monthlyBurn: 1000,
      revenue: 5000,
    };
    const sanitized = sanitizeFinanceEvidenceForResultJson(infra) as Record<
      string,
      unknown
    >;
    expect(sanitized.path).toBe("docker-compose.yml");
    expect(sanitized.monthlyBurn).toBe(1000);
    expect(sanitized.revenue).toBe(5000);
  });
});
