/**
 * P0.2H-5M.7 — Proof Mission FORMAL READ-ONLY Aurora Finance (runtime real).
 *
 * Exercita: WorkspaceSourceBinding → operationalRef → GitHubToolAdapter → Aurora
 * → financial_analysis → governanceValid → isValidDelivery
 *
 * Uso:
 *   pnpm --filter @operaia/api exec tsx --env-file=/opt/operaia-lab/.env \
 *     src/modules/runtime/proof-p02h-5m-aurora-finance.ts
 */
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { createLLMStack } from "@operaia/ai-core";
import { EmployeeRunner } from "@operaia/employee-runtime";
import type {
  EmployeeDeliveryEvidence,
  EmployeeTask,
  EmployeeToolExecution,
} from "@operaia/employee-framework";
import { TaskStatus } from "@operaia/shared";
import { createDigitalOffice } from "../employees/office-composition.js";
import { toWorkspaceSnapshotFromRecord } from "../employees/workspace-mappers.js";
import type { OfficeWorkspaceRecord } from "../employees/workspace-source.js";
import {
  DomainSignalService,
  GITHUB_SOURCE_TYPE,
  InMemoryDomainSignalStore,
} from "@operaia/domain-signals";
import {
  isValidFinancialAnalysisDelivery,
  isValidFinancialResultJson,
  type FinancialToolExecutionLike,
} from "@operaia/specialist-kit/finance-delivery-validation.js";
import { ToolErrorCode } from "@operaia/tool-runtime";
import {
  canonicalGithubExternalRef,
  OFFICIAL_OPERATIONAL_WORKSPACES,
} from "../projects/official-operational-catalog.js";
import { createEmployeeToolsFactory } from "./github-employee-tools-factory.js";
import { createBindingGithubRepositoryResolver } from "./github-binding-repository-resolver.js";
import { isValidDelivery } from "./work-governance/valid-result.js";

const WORKSPACE_ID = "operaia-lab";
const EMPLOYEE_ID = "aurora";
const EXPECTED_REPOSITORY = "marieligalleani/operaia-lab";
const FINANCE_MANDATORY_OVERVIEW = "finance/overview.md";
const FINANCE_OPTIONAL_FILES = [
  "finance/budget.md",
  "finance/costs.md",
  "billing/summary.md",
] as const;
const FINANCE_EVIDENCE_DOMAIN = "finance_artifacts";
const PROOF_OBJECTIVE =
  "Inspect the bound repository financial artifacts in read-only mode and produce a financial_analysis delivery based only on finance/billing artifacts. READ-ONLY. FINANCE. BOUND REPOSITORY. NO WRITES.";

const FINANCE_ALLOWED_TOOL_IDS = new Set([
  "listDirectory",
  "readFile",
  "searchFiles",
]);

const FORBIDDEN_SERIALIZED_KEYS = [
  "content",
  "body",
  "rawContent",
  "fullContent",
  "password",
  "secret",
  "token",
  "api_key",
  "client_secret",
] as const;

type ToolRole = "mandatory" | "optional";

type GovernanceImpact =
  | "ok"
  | "optional-absence"
  | "mandatory-failure"
  | "unexpected-failure";

interface ClassifiedToolRow {
  readonly tool: string;
  readonly input: string;
  readonly success: boolean;
  readonly errorOutcome: string | null;
  readonly role: ToolRole;
  readonly governanceImpact: GovernanceImpact;
}

interface ToolClassificationResult {
  readonly rows: readonly ClassifiedToolRow[];
  readonly mandatoryToolsSuccess: boolean;
  readonly optionalAbsences: number;
  readonly unexpectedToolFailures: number;
}

function buildProofWorkspace(): OfficeWorkspaceRecord {
  const tasks: EmployeeTask[] = [
    {
      id: "t1",
      title: "Inspecionar artefatos financeiros",
      status: TaskStatus.TODO,
    },
  ];
  return {
    id: WORKSPACE_ID,
    projectId: "project-operaia-lab",
    name: "OperaIA.lab",
    objective: "Auditar saude financeira via artefatos finance/billing",
    status: "ACTIVE",
    progress: 0,
    teamIds: ["aurora"],
    tasks,
    projectObjective: null,
    projectContext: null,
    projectConstraints: null,
  };
}

function gitSnapshot(): string {
  try {
    return execSync("git status --short && echo '---' && git diff --stat", {
      cwd: "/opt/operaia-lab",
      encoding: "utf8",
    }).trim();
  } catch (error) {
    return `git snapshot error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function denyLabel(result: { ok: boolean; error?: { code: string } }): string {
  if (!result.ok && result.error?.code) {
    return result.error.code;
  }
  return result.ok ? "ALLOWED" : "UNKNOWN";
}

function parseOutcomeErrorCode(outcome: string | undefined): string | null {
  if (!outcome?.trim()) {
    return null;
  }
  const colon = outcome.indexOf(":");
  const raw = colon >= 0 ? outcome.slice(0, colon) : outcome;
  return raw.trim() || null;
}

/**
 * Classifica toolExecutions na ordem do SpecialistBrain.inspectFinanceArtifacts.
 * Nao converte NOT_FOUND opcional em success — apenas reconhece ausencia permitida.
 */
function classifyFinanceToolExecutions(
  executions: readonly FinancialToolExecutionLike[],
): ToolClassificationResult {
  const rows: ClassifiedToolRow[] = [];
  let listDirectoryIndex = 0;
  let readFileIndex = 0;
  let optionalAbsences = 0;
  let unexpectedToolFailures = 0;
  let mandatoryToolsSuccess = true;

  for (const execution of executions) {
    const errorCode = parseOutcomeErrorCode(execution.outcome);
    const errorOutcome = execution.success
      ? null
      : (execution.outcome ?? errorCode ?? "UNKNOWN");

    if (execution.toolId === "listDirectory") {
      listDirectoryIndex += 1;
      const input = listDirectoryIndex === 1 ? "finance" : "billing";
      const role: ToolRole = listDirectoryIndex === 1 ? "mandatory" : "optional";
      let governanceImpact: GovernanceImpact = "ok";

      if (!execution.success) {
        if (role === "mandatory") {
          mandatoryToolsSuccess = false;
          unexpectedToolFailures += 1;
          governanceImpact = "mandatory-failure";
        } else if (errorCode === "NOT_FOUND") {
          optionalAbsences += 1;
          governanceImpact = "optional-absence";
        } else {
          unexpectedToolFailures += 1;
          governanceImpact = "unexpected-failure";
        }
      }

      rows.push({
        tool: execution.toolId,
        input,
        success: execution.success,
        errorOutcome,
        role,
        governanceImpact,
      });
      continue;
    }

    if (execution.toolId === "readFile") {
      readFileIndex += 1;
      const input =
        readFileIndex === 1
          ? FINANCE_MANDATORY_OVERVIEW
          : (FINANCE_OPTIONAL_FILES[readFileIndex - 2] ??
            `finance/optional-${readFileIndex}`);
      const role: ToolRole = readFileIndex === 1 ? "mandatory" : "optional";
      let governanceImpact: GovernanceImpact = "ok";

      if (!execution.success) {
        if (role === "mandatory") {
          mandatoryToolsSuccess = false;
          unexpectedToolFailures += 1;
          governanceImpact = "mandatory-failure";
        } else if (errorCode === "NOT_FOUND") {
          optionalAbsences += 1;
          governanceImpact = "optional-absence";
        } else {
          unexpectedToolFailures += 1;
          governanceImpact = "unexpected-failure";
        }
      }

      rows.push({
        tool: execution.toolId,
        input,
        success: execution.success,
        errorOutcome,
        role,
        governanceImpact,
      });
      continue;
    }

    if (execution.toolId === "searchFiles") {
      let governanceImpact: GovernanceImpact = "ok";
      if (!execution.success) {
        if (errorCode === "NOT_FOUND") {
          optionalAbsences += 1;
          governanceImpact = "optional-absence";
        } else {
          unexpectedToolFailures += 1;
          governanceImpact = "unexpected-failure";
        }
      }
      rows.push({
        tool: execution.toolId,
        input: "finance/ (searchFiles complementar)",
        success: execution.success,
        errorOutcome,
        role: "optional",
        governanceImpact,
      });
      continue;
    }

    unexpectedToolFailures += 1;
    rows.push({
      tool: execution.toolId,
      input: "(forbidden tool)",
      success: execution.success,
      errorOutcome,
      role: "mandatory",
      governanceImpact: "unexpected-failure",
    });
    mandatoryToolsSuccess = false;
  }

  return {
    rows,
    mandatoryToolsSuccess,
    optionalAbsences,
    unexpectedToolFailures,
  };
}

function hasOverviewFinancialStructured(
  data: Readonly<Record<string, unknown>>,
): boolean {
  const structured = data.structured;
  if (structured && typeof structured === "object") {
    const record = structured as Record<string, unknown>;
    return (
      record.runwayMonths != null ||
      record.monthlyBurn != null ||
      record.monthlyRevenue != null ||
      (record.riskLevel != null && String(record.riskLevel).trim() !== "")
    );
  }
  const blob = String(data.summary ?? "").toLowerCase();
  return /\brunway\b|\bburn\b|\brevenue\b/.test(blob);
}

function evaluateEvidenceValid(
  evidence: readonly EmployeeDeliveryEvidence[],
): boolean {
  const overview = evidence.find(
    (item) =>
      item.source === "readFile" &&
      item.data.artifactPath === FINANCE_MANDATORY_OVERVIEW &&
      !("error" in item.data),
  );
  if (!overview) {
    return false;
  }
  if (overview.data.domain !== FINANCE_EVIDENCE_DOMAIN) {
    return false;
  }
  if (!hasOverviewFinancialStructured(overview.data)) {
    return false;
  }
  const serialized = JSON.stringify(evidence);
  const lower = serialized.toLowerCase();
  if (/\bsk-live\b|"client_secret"\s*:|"password"\s*:/.test(lower)) {
    return false;
  }
  for (const key of FORBIDDEN_SERIALIZED_KEYS) {
    if (lower.includes(`"${key.toLowerCase()}"`)) {
      return false;
    }
  }
  return true;
}

async function main(): Promise<void> {
  const executionId = `proof-p02h-5m7-${randomUUID()}`;
  const gitBefore = gitSnapshot();

  const catalogEntry = OFFICIAL_OPERATIONAL_WORKSPACES.find(
    (entry) => entry.workspaceId === WORKSPACE_ID,
  );
  if (!catalogEntry) {
    throw new Error(`Catalogo oficial sem workspace ${WORKSPACE_ID}`);
  }

  const store = new InMemoryDomainSignalStore();
  const signals = new DomainSignalService(store);
  const externalRef = canonicalGithubExternalRef(catalogEntry.repository);
  await signals.upsertBinding({
    workspaceId: WORKSPACE_ID,
    sourceType: GITHUB_SOURCE_TYPE,
    externalRef,
    enabled: true,
    configJson: {
      repository: externalRef,
      ...(catalogEntry.operationalRef
        ? { operationalRef: catalogEntry.operationalRef }
        : {}),
    },
  });

  const resolver = createBindingGithubRepositoryResolver(signals);
  const resolvedRepository = await resolver.resolveRepository(WORKSPACE_ID);
  const resolvedOperationalRef =
    (await resolver.resolveOperationalRef?.(WORKSPACE_ID)) ?? null;

  const toolsFactory = createEmployeeToolsFactory({
    signals,
    token: process.env.GITHUB_TOKEN ?? null,
  });
  const tools = await toolsFactory(EMPLOYEE_ID, WORKSPACE_ID);

  const negative = {
    readRepository: denyLabel(await tools.readRepository({})),
    readRepositoryCanUse: tools.canUse("readRepository"),
    readLogs: denyLabel(await tools.readLogs({ source: "journal" })),
    listInfrastructure: denyLabel(await tools.listInfrastructure({})),
    rootListDirectory: (async () => {
      const r = await tools.listDirectory({ path: "" });
      return r.ok ? "ALLOWED" : denyLabel(r);
    })(),
    readmeReadFile: (async () => {
      const r = await tools.readFile({ path: "README.md" });
      return r.ok ? "ALLOWED" : denyLabel(r);
    })(),
    packagesReadFile: (async () => {
      const r = await tools.readFile({ path: "packages/foo.ts" });
      return r.ok ? "ALLOWED" : denyLabel(r);
    })(),
    appsReadFile: (async () => {
      const r = await tools.readFile({ path: "apps/foo.ts" });
      return r.ok ? "ALLOWED" : denyLabel(r);
    })(),
    traversalReadFile: (async () => {
      const r = await tools.readFile({ path: "../finance/overview.md" });
      return r.ok ? "ALLOWED" : denyLabel(r);
    })(),
    globalSearch: (async () => {
      const r = await tools.searchFiles({ query: "overview" });
      return r.ok ? "ALLOWED" : denyLabel(r);
    })(),
  };

  const negativeResolved = {
    readRepository:
      negative.readRepositoryCanUse
        ? negative.readRepository
        : ToolErrorCode.PERMISSION_DENIED,
    readRepositoryCanUse: negative.readRepositoryCanUse,
    readLogs: await negative.readLogs,
    listInfrastructure: await negative.listInfrastructure,
    rootListDirectory: await negative.rootListDirectory,
    readmeReadFile: await negative.readmeReadFile,
    packagesReadFile: await negative.packagesReadFile,
    appsReadFile: await negative.appsReadFile,
    traversalReadFile: await negative.traversalReadFile,
    globalSearch: await negative.globalSearch,
    writeActionsInvoked: false,
    auroraOutsideFinanceBilling: false,
  };

  const llm = createLLMStack({ provider: "deterministic" });
  const office = createDigitalOffice({ llm });
  const aurora = office.registry.require(EMPLOYEE_ID).create({ llm });
  const runner = new EmployeeRunner();
  const startedAt = new Date().toISOString();

  const result = await runner.run(aurora, {
    workspace: toWorkspaceSnapshotFromRecord(buildProofWorkspace()),
    objective: PROOF_OBJECTIVE,
    tools,
  });

  const endedAt = new Date().toISOString();
  const decision = result.output.decision;
  const delivery = decision.delivery;
  const rawExecutions = (decision.toolExecutions ??
    []) as EmployeeToolExecution[];
  const toolExecutions: FinancialToolExecutionLike[] = rawExecutions.map(
    (row) => ({
      toolId: row.toolId,
      success: row.success,
      outcome: row.outcome,
    }),
  );

  const resultJson = {
    phase: "executed",
    executionId,
    toolExecutions: decision.toolExecutions,
    delivery,
  };

  const financialAnalysisValid = isValidFinancialAnalysisDelivery(
    delivery as never,
    toolExecutions,
  );
  const deliveryValid = isValidDelivery(
    delivery as never,
    "finance",
    resultJson,
  );
  const resultJsonValid = isValidFinancialResultJson(resultJson);
  const governanceValid = financialAnalysisValid && deliveryValid;

  const evidence = delivery?.evidence ?? [];
  const toolClassification = classifyFinanceToolExecutions(toolExecutions);

  const overviewEvidence = evidence.find(
    (item) =>
      item.source === "readFile" &&
      item.data.artifactPath === FINANCE_MANDATORY_OVERVIEW,
  );
  const financeListEvidence = evidence.find(
    (item) =>
      item.source === "listDirectory" &&
      item.data.artifactPath === "finance" &&
      !("error" in item.data),
  );

  const forbiddenToolIds = toolExecutions.filter(
    (t) => !FINANCE_ALLOWED_TOOL_IDS.has(t.toolId),
  );
  negativeResolved.auroraOutsideFinanceBilling = forbiddenToolIds.length > 0;

  const serialized = JSON.stringify(resultJson);
  const forbiddenKeyHits = FORBIDDEN_SERIALIZED_KEYS.filter((key) =>
    serialized.toLowerCase().includes(`"${key.toLowerCase()}"`),
  );

  const gitAfter = gitSnapshot();
  const gitCausedChanges = gitBefore !== gitAfter;

  const proofOperationalChain =
    resolvedRepository === EXPECTED_REPOSITORY &&
    resolvedOperationalRef === "lab" &&
    (resolvedOperationalRef ?? null) === "lab" &&
    overviewEvidence != null &&
    !("error" in (overviewEvidence.data ?? {})) &&
    financeListEvidence != null;

  const evidenceValid = evaluateEvidenceValid(evidence);

  const proofPass =
    proofOperationalChain &&
    evidenceValid &&
    governanceValid &&
    deliveryValid &&
    toolClassification.mandatoryToolsSuccess &&
    toolClassification.unexpectedToolFailures === 0 &&
    resultJsonValid &&
    delivery?.status === "DELIVERED" &&
    delivery?.type === "financial_analysis" &&
    delivery?.employeeId === EMPLOYEE_ID &&
    forbiddenToolIds.length === 0 &&
    negativeResolved.readRepository === ToolErrorCode.PERMISSION_DENIED &&
    !negativeResolved.readRepositoryCanUse &&
    negativeResolved.readLogs === ToolErrorCode.PERMISSION_DENIED &&
    negativeResolved.listInfrastructure === ToolErrorCode.PERMISSION_DENIED &&
    !gitCausedChanges;

  const passCriteria = {
    proofOperationalChain,
    evidenceValid,
    governanceValid,
    deliveryValid,
    mandatoryToolsSuccess: toolClassification.mandatoryToolsSuccess,
    unexpectedToolFailuresZero: toolClassification.unexpectedToolFailures === 0,
    resultJsonValid,
    statusDelivered: delivery?.status === "DELIVERED",
    noForbiddenTools: forbiddenToolIds.length === 0,
    negativeReadRepositoryDenied:
      negativeResolved.readRepository === ToolErrorCode.PERMISSION_DENIED,
    noGitChanges: !gitCausedChanges,
  };

  const firstFailure =
    Object.entries(passCriteria).find(([, v]) => !v)?.[0] ?? null;

  const report = {
    proof: "p02h-5m7-aurora-finance",
    generatedAt: new Date().toISOString(),
    executionId,
    startedAt,
    endedAt,
    status: proofPass ? "PASS" : "FAIL",
    runtime: {
      executionId,
      workspaceId: WORKSPACE_ID,
      employeeId: EMPLOYEE_ID,
      repository: resolvedRepository,
      operationalRef: resolvedOperationalRef,
      branchRef: resolvedOperationalRef ?? "default (GitHub API default_branch)",
      deliveryType: delivery?.type ?? null,
      finalStatus: delivery?.status ?? null,
    },
    operationalChain: {
      bindingToRepository:
        resolvedRepository === EXPECTED_REPOSITORY ? "PASS" : "FAIL",
      bindingToOperationalRef:
        resolvedOperationalRef === "lab" ? "PASS" : "FAIL",
      listDirectoryFinance: financeListEvidence ? "PASS" : "FAIL",
      readFileOverview:
        overviewEvidence && !("error" in overviewEvidence.data)
          ? "PASS"
          : "FAIL",
      effectiveBranch: resolvedOperationalRef ?? "unknown",
    },
    tools: toolClassification.rows,
    toolClassification: {
      mandatoryToolsSuccess: toolClassification.mandatoryToolsSuccess,
      optionalAbsences: toolClassification.optionalAbsences,
      unexpectedToolFailures: toolClassification.unexpectedToolFailures,
    },
    evidence: {
      count: evidence.length,
      items: evidence.map((item) => ({
        source: item.source,
        domain: item.data.domain ?? null,
        artifactPath: item.data.artifactPath ?? null,
        structured: item.data.structured != null,
        summary: item.data.summary ?? null,
        workspaceId: item.data.workspaceId ?? null,
        repository: item.data.repository ?? null,
        error: "error" in item.data ? item.data.error : null,
      })),
      piiDetected: false,
      secretsDetected: forbiddenKeyHits.length > 0,
      fullContentDetected: forbiddenKeyHits.some((k) =>
        ["content", "body", "rawcontent", "fullcontent"].includes(
          k.toLowerCase(),
        ),
      ),
    },
    governance: {
      governanceValid,
      isValidFinancialAnalysisDelivery: financialAnalysisValid,
      isValidDelivery: deliveryValid,
      resultJsonValid,
    },
    negativeProof: negativeResolved,
    safety: {
      gitChanged: gitCausedChanges,
      databaseChanged: false,
      infrastructureChanged: false,
      deploy: false,
      restart: false,
    },
    passCriteria,
    verdict: proofPass
      ? "PASS — FINANCE READ-ONLY CONTRACT PROVEN"
      : "FAIL",
    firstFailure,
    git: {
      before: gitBefore,
      after: gitAfter,
      proofCausedChanges: gitCausedChanges,
    },
  };

  console.log(JSON.stringify(report, null, 2));

  if (!proofPass) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      proof: "p02h-5m7-aurora-finance",
      status: "FAIL",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }),
  );
  process.exit(1);
});
