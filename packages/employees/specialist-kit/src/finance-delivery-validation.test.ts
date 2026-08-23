import { describe, expect, it } from "vitest";
import { FINANCE_EVIDENCE_DOMAIN } from "./finance-evidence.js";
import {
  FINANCE_DELIVERY_TYPE,
  FINANCE_EMPLOYEE_ID,
  type FinancialDeliveryLike,
  type FinancialToolExecutionLike,
  isValidFinancialAnalysisDelivery,
  isValidFinancialResultJson,
} from "./finance-delivery-validation.js";
import {
  FINANCE_MANDATORY_OVERVIEW,
  FINANCE_OPTIONAL_FILES,
} from "./finance-artifact-path.js";

function okToolExecutions(
  overrides?: readonly FinancialToolExecutionLike[],
): readonly FinancialToolExecutionLike[] {
  const base: FinancialToolExecutionLike[] = [
    { toolId: "listDirectory", success: true, outcome: "finance directory 1 entries" },
    { toolId: "readFile", success: true, outcome: "overview 12m runway" },
    { toolId: "searchFiles", success: true, outcome: "finance search 1 hits" },
  ];
  if (!overrides) {
    return base;
  }
  return overrides;
}

function validFinanceDelivery(
  overrides: Partial<FinancialDeliveryLike> = {},
): FinancialDeliveryLike {
  return {
    type: FINANCE_DELIVERY_TYPE,
    status: "DELIVERED",
    employeeId: FINANCE_EMPLOYEE_ID,
    summary: "overview 12m runway",
    findings: ["overview 12m runway", "finance directory 1 entries"],
    evidence: [
      {
        source: "listDirectory",
        data: {
          domain: FINANCE_EVIDENCE_DOMAIN,
          workspaceId: "operaia-lab",
          repository: "marieligalleani/operaia-lab",
          artifactPath: "finance",
          summary: "finance directory 1 entries",
        },
      },
      {
        source: "readFile",
        data: {
          domain: FINANCE_EVIDENCE_DOMAIN,
          workspaceId: "operaia-lab",
          repository: "marieligalleani/operaia-lab",
          artifactPath: FINANCE_MANDATORY_OVERVIEW,
          summary: "overview 12m runway",
          structured: {
            runwayMonths: 12,
            monthlyBurn: 85000,
            monthlyRevenue: 120000,
            riskLevel: "medium",
          },
        },
      },
    ],
    ...overrides,
  };
}

/** Simula execucao real: obrigatorios ok + billing NOT_FOUND opcional. */
function deliveryWithOptionalAbsences(
  extraEvidence: FinancialDeliveryLike["evidence"] = [],
): FinancialDeliveryLike {
  return validFinanceDelivery({
    evidence: [
      ...validFinanceDelivery().evidence!,
      {
        source: "listDirectory",
        data: { error: "NOT_FOUND", message: "Not Found" },
      },
      ...extraEvidence!,
    ],
  });
}

function executionsWithOptionalBillingNotFound(): FinancialToolExecutionLike[] {
  return [
    { toolId: "listDirectory", success: true, outcome: "finance directory 1 entries" },
    { toolId: "readFile", success: true, outcome: "overview 12m runway" },
    { toolId: "searchFiles", success: true, outcome: "finance search 1 hits" },
    { toolId: "listDirectory", success: false, outcome: "NOT_FOUND: Not Found" },
  ];
}

describe("Finance delivery validation P0.2H-5L", () => {
  it("PASS — delivery valida com overview e listDirectory", () => {
    expect(
      isValidFinancialAnalysisDelivery(
        validFinanceDelivery(),
        okToolExecutions(),
      ),
    ).toBe(true);
  });

  it("FAIL — type invalido", () => {
    expect(
      isValidFinancialAnalysisDelivery(
        validFinanceDelivery({ type: "ux_analysis" }),
        okToolExecutions(),
      ),
    ).toBe(false);
  });

  it("FAIL — employeeId invalido", () => {
    expect(
      isValidFinancialAnalysisDelivery(
        validFinanceDelivery({ employeeId: "luna" }),
        okToolExecutions(),
      ),
    ).toBe(false);
  });

  it("FAIL — status invalido", () => {
    expect(
      isValidFinancialAnalysisDelivery(
        validFinanceDelivery({ status: "FAILED" }),
        okToolExecutions(),
      ),
    ).toBe(false);
  });

  it("FAIL — evidence insuficiente", () => {
    expect(
      isValidFinancialAnalysisDelivery(
        validFinanceDelivery({ evidence: [validFinanceDelivery().evidence![0]!] }),
        okToolExecutions(),
      ),
    ).toBe(false);
  });

  it("FAIL — overview ausente", () => {
    const delivery = validFinanceDelivery({
      evidence: [
        validFinanceDelivery().evidence![0]!,
        {
          source: "readFile",
          data: {
            domain: FINANCE_EVIDENCE_DOMAIN,
            artifactPath: "finance/budget.md",
            summary: "budget",
            structured: { monthlyBurn: 1 },
          },
        },
      ],
    });
    expect(isValidFinancialAnalysisDelivery(delivery, okToolExecutions())).toBe(
      false,
    );
  });

  it("FAIL — listDirectory ausente", () => {
    const delivery = validFinanceDelivery({
      evidence: [validFinanceDelivery().evidence![1]!],
    });
    expect(isValidFinancialAnalysisDelivery(delivery, okToolExecutions())).toBe(
      false,
    );
  });

  it("FAIL — domain/path invalido", () => {
    const delivery = validFinanceDelivery({
      evidence: [
        validFinanceDelivery().evidence![0]!,
        {
          source: "readFile",
          data: {
            domain: "other",
            artifactPath: "README.md",
            summary: "readme",
          },
        },
      ],
    });
    expect(isValidFinancialAnalysisDelivery(delivery, okToolExecutions())).toBe(
      false,
    );
  });

  it("FAIL — path fora de finance/billing", () => {
    const delivery = validFinanceDelivery({
      evidence: [
        ...validFinanceDelivery().evidence!,
        {
          source: "readFile",
          data: {
            domain: FINANCE_EVIDENCE_DOMAIN,
            artifactPath: "packages/foo.ts",
            summary: "code",
          },
        },
      ],
    });
    expect(isValidFinancialAnalysisDelivery(delivery, okToolExecutions())).toBe(
      false,
    );
  });

  it("FAIL — readRepository em toolExecutions", () => {
    expect(
      isValidFinancialAnalysisDelivery(validFinanceDelivery(), [
        { toolId: "readRepository", success: true },
      ]),
    ).toBe(false);
  });

  it("FAIL — tool fora da allowlist", () => {
    expect(
      isValidFinancialAnalysisDelivery(validFinanceDelivery(), [
        { toolId: "readLogs", success: true },
      ]),
    ).toBe(false);
  });

  it("FAIL — tool execution com success false (overview obrigatorio)", () => {
    expect(
      isValidFinancialAnalysisDelivery(validFinanceDelivery(), [
        { toolId: "listDirectory", success: true },
        { toolId: "readFile", success: false, outcome: "NOT_FOUND: Not Found" },
      ]),
    ).toBe(false);
  });

  it("FAIL — listDirectory(finance) NOT_FOUND", () => {
    expect(
      isValidFinancialAnalysisDelivery(
        validFinanceDelivery({
          evidence: [
            {
              source: "listDirectory",
              data: { error: "NOT_FOUND", message: "Not Found" },
            },
            validFinanceDelivery().evidence![1]!,
          ],
        }),
        [
          { toolId: "listDirectory", success: false, outcome: "NOT_FOUND: Not Found" },
          { toolId: "readFile", success: true },
        ],
      ),
    ).toBe(false);
  });

  it("FAIL — erro nao-NOT_FOUND em tool obrigatoria", () => {
    expect(
      isValidFinancialAnalysisDelivery(validFinanceDelivery(), [
        { toolId: "listDirectory", success: false, outcome: "RATE_LIMIT: throttled" },
      ]),
    ).toBe(false);
    expect(
      isValidFinancialAnalysisDelivery(validFinanceDelivery(), [
        { toolId: "listDirectory", success: true },
        { toolId: "readFile", success: false, outcome: "UNAUTHORIZED: denied" },
      ]),
    ).toBe(false);
  });

  it("FAIL — erro nao-NOT_FOUND em tool opcional", () => {
    expect(
      isValidFinancialAnalysisDelivery(
        deliveryWithOptionalAbsences(),
        [
          { toolId: "listDirectory", success: true },
          { toolId: "readFile", success: true },
          { toolId: "searchFiles", success: false, outcome: "RATE_LIMIT: throttled" },
        ],
      ),
    ).toBe(false);
    expect(
      isValidFinancialAnalysisDelivery(
        deliveryWithOptionalAbsences(),
        [
          { toolId: "listDirectory", success: true },
          { toolId: "readFile", success: true },
          { toolId: "readFile", success: false, outcome: "PERMISSION_DENIED: denied" },
        ],
      ),
    ).toBe(false);
  });

  it("FAIL — overview sem indicador financeiro", () => {
    const delivery = validFinanceDelivery({
      evidence: [
        validFinanceDelivery().evidence![0]!,
        {
          source: "readFile",
          data: {
            domain: FINANCE_EVIDENCE_DOMAIN,
            artifactPath: "finance/overview.md",
            summary: "generic notes only",
          },
        },
      ],
    });
    expect(isValidFinancialAnalysisDelivery(delivery, okToolExecutions())).toBe(
      false,
    );
  });

  it("FAIL — PII residual na evidence", () => {
    const delivery = validFinanceDelivery({
      evidence: [
        validFinanceDelivery().evidence![0]!,
        {
          source: "readFile",
          data: {
            domain: FINANCE_EVIDENCE_DOMAIN,
            artifactPath: "finance/overview.md",
            summary: "titular 123.456.789-01",
            structured: { runwayMonths: 12 },
          },
        },
      ],
    });
    expect(isValidFinancialAnalysisDelivery(delivery, okToolExecutions())).toBe(
      false,
    );
  });

  it("FAIL — resultJson com secret/PII/full content", () => {
    expect(
      isValidFinancialResultJson({
        delivery: validFinanceDelivery(),
        token: "sk-live-secret",
      }),
    ).toBe(false);
    expect(
      isValidFinancialResultJson({
        delivery: {
          ...validFinanceDelivery(),
          evidence: [
            validFinanceDelivery().evidence![0]!,
            {
              source: "readFile",
              data: {
                domain: FINANCE_EVIDENCE_DOMAIN,
                artifactPath: "finance/overview.md",
                content: "corpo integral ".repeat(50),
                structured: { runwayMonths: 12 },
              },
            },
          ],
        },
      }),
    ).toBe(false);
  });

  it("PASS — artefatos opcionais ausentes (sem evidence de opcionais)", () => {
    expect(
      isValidFinancialAnalysisDelivery(
        validFinanceDelivery(),
        okToolExecutions(),
      ),
    ).toBe(true);
  });
});

describe("Finance delivery validation P0.2H-5M.6 — optional absence", () => {
  it("PASS — finance valido sem billing/, budget, costs, billing/summary", () => {
    expect(
      isValidFinancialAnalysisDelivery(
        deliveryWithOptionalAbsences(),
        executionsWithOptionalBillingNotFound(),
      ),
    ).toBe(true);
  });

  it("PASS — listDirectory(billing) NOT_FOUND", () => {
    expect(
      isValidFinancialAnalysisDelivery(
        deliveryWithOptionalAbsences(),
        executionsWithOptionalBillingNotFound(),
      ),
    ).toBe(true);
  });

  it("PASS — readFile opcional NOT_FOUND nao gera execution (ausencia silenciosa)", () => {
    expect(
      isValidFinancialAnalysisDelivery(
        validFinanceDelivery(),
        okToolExecutions(),
      ),
    ).toBe(true);
    for (const optionalPath of FINANCE_OPTIONAL_FILES) {
      expect(optionalPath).toMatch(/^(finance|billing)\//);
    }
  });

  it("PASS — readFile opcional com evidence NOT_FOUND explicita", () => {
    expect(
      isValidFinancialAnalysisDelivery(
        validFinanceDelivery({
          evidence: [
            ...validFinanceDelivery().evidence!,
            {
              source: "readFile",
              data: {
                error: "NOT_FOUND",
                message: "missing",
                artifactPath: "finance/budget.md",
              },
            },
          ],
        }),
        okToolExecutions(),
      ),
    ).toBe(true);
  });

  it("PASS — searchFiles NOT_FOUND opcional", () => {
    expect(
      isValidFinancialAnalysisDelivery(
        validFinanceDelivery({
          evidence: [
            ...validFinanceDelivery().evidence!,
            { source: "searchFiles", data: { error: "NOT_FOUND", message: "none" } },
          ],
        }),
        [
          { toolId: "listDirectory", success: true },
          { toolId: "readFile", success: true },
          { toolId: "searchFiles", success: false, outcome: "NOT_FOUND: Not Found" },
        ],
      ),
    ).toBe(true);
  });

  it("FAIL — readFile(finance/overview.md) NOT_FOUND", () => {
    expect(
      isValidFinancialAnalysisDelivery(
        validFinanceDelivery({
          evidence: [validFinanceDelivery().evidence![0]!],
        }),
        [
          { toolId: "listDirectory", success: true },
          { toolId: "readFile", success: false, outcome: "NOT_FOUND: Not Found" },
        ],
      ),
    ).toBe(false);
  });

  it("FAIL — listDirectory(finance) NOT_FOUND mesmo com billing ok na evidence", () => {
    expect(
      isValidFinancialAnalysisDelivery(
        validFinanceDelivery({
          evidence: [
            { source: "listDirectory", data: { error: "NOT_FOUND", message: "missing finance" } },
            validFinanceDelivery().evidence![1]!,
          ],
        }),
        [
          { toolId: "listDirectory", success: false, outcome: "NOT_FOUND: Not Found" },
          { toolId: "readFile", success: true },
        ],
      ),
    ).toBe(false);
  });

  it("FAIL — listDirectory NOT_FOUND sem finance list bem-sucedida nao e ignoravel", () => {
    expect(
      isValidFinancialAnalysisDelivery(
        validFinanceDelivery({
          evidence: [
            { source: "listDirectory", data: { error: "NOT_FOUND", message: "billing only" } },
          ],
        }),
        [{ toolId: "listDirectory", success: false, outcome: "NOT_FOUND: Not Found" }],
      ),
    ).toBe(false);
  });
});

describe("Finance delivery validation P0.2H-5L — isolamento", () => {
  it("nao valida delivery generica como financeira", () => {
    const lunaDelivery: FinancialDeliveryLike = {
      type: "ux_analysis",
      status: "DELIVERED",
      employeeId: "luna",
      evidence: [
        { source: "readRepository", data: { repository: "x" } },
        { source: "listDirectory", data: { path: "" } },
      ],
    };
    expect(
      isValidFinancialAnalysisDelivery(lunaDelivery, [
        { toolId: "readRepository", success: true },
        { toolId: "listDirectory", success: true },
      ]),
    ).toBe(false);
  });
});
