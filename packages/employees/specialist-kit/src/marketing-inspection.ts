/**
 * Inspecao Marketing READ-ONLY — isolada do SpecialistBrain.
 */
import type {
  EmployeeDeliveryEvidence,
  EmployeeToolExecution,
} from "@operaia/employee-framework";
import {
  MARKETING_MANDATORY_README,
  MARKETING_OPTIONAL_ROOTS,
  MARKETING_SEARCH_QUERIES,
  validateMarketingListDirectoryPath,
  validateMarketingReadFilePath,
  validateMarketingSearchPrefix,
} from "./marketing-artifact-path.js";
import {
  buildMarketingEvidence,
  sanitizeMarketingEvidenceForResultJson,
} from "./marketing-evidence.js";

export interface MarketingToolContext {
  canUse(toolId: string): boolean;
  readonly workspaceId?: string;
  readRepository?(
    input?: Record<string, never>,
  ): Promise<
    | { readonly ok: true; readonly data: Readonly<Record<string, unknown>> }
    | {
        readonly ok: false;
        readonly error: { readonly code: string; readonly message: string };
      }
  >;
  listDirectory?(
    input?: Record<string, unknown>,
  ): Promise<
    | { readonly ok: true; readonly data: Readonly<Record<string, unknown>> }
    | {
        readonly ok: false;
        readonly error: { readonly code: string; readonly message: string };
      }
  >;
  readFile?(
    input?: Record<string, unknown>,
  ): Promise<
    | { readonly ok: true; readonly data: Readonly<Record<string, unknown>> }
    | {
        readonly ok: false;
        readonly error: { readonly code: string; readonly message: string };
      }
  >;
  searchFiles?(
    input?: Record<string, unknown>,
  ): Promise<
    | { readonly ok: true; readonly data: Readonly<Record<string, unknown>> }
    | {
        readonly ok: false;
        readonly error: { readonly code: string; readonly message: string };
      }
  >;
}

export interface MarketingInspectionResult {
  readonly toolExecutions: readonly EmployeeToolExecution[];
  readonly evidence: readonly EmployeeDeliveryEvidence[];
  readonly allSucceeded: boolean;
  readonly attempted: boolean;
}

function summarize(
  toolId: string,
  data: Readonly<Record<string, unknown>>,
): string {
  if (toolId === "readRepository") {
    return `Repo ${String(data.repository ?? "n/a")} branch=${String(data.branchRef ?? data.defaultBranch ?? "n/a")}`;
  }
  if (toolId === "listDirectory") {
    return `Dir ${String(data.artifactPath ?? "")} entries=${String(
      (data.structured as { entryCount?: unknown } | undefined)?.entryCount ??
        "n/a",
    )}`;
  }
  if (toolId === "readFile") {
    return `File ${String(data.artifactPath ?? "n/a")}`;
  }
  return `${toolId}: ok`;
}

export async function inspectMarketingArtifacts(
  tools: MarketingToolContext,
): Promise<MarketingInspectionResult> {
  const executions: EmployeeToolExecution[] = [];
  const evidence: EmployeeDeliveryEvidence[] = [];
  let mandatoryOk = true;
  let called = 0;
  const workspaceId = tools.workspaceId?.trim() ?? "";

  const fail = (
    toolId: string,
    code: string,
    message: string,
    mandatory: boolean,
  ) => {
    const at = new Date().toISOString();
    called += 1;
    if (mandatory) {
      mandatoryOk = false;
    }
    executions.push({
      toolId,
      success: false,
      outcome: `${code}: ${message}`,
      at,
    });
    evidence.push({
      source: toolId,
      data: { error: code, message },
    });
  };

  const succeed = (
    toolId: "readRepository" | "listDirectory" | "readFile" | "searchFiles",
    artifactPath: string,
    raw: Readonly<Record<string, unknown>>,
    mandatory: boolean,
  ) => {
    const built = buildMarketingEvidence({
      toolId,
      workspaceId,
      artifactPath,
      rawToolData: raw,
      repository: typeof raw.repository === "string" ? raw.repository : undefined,
      branchRef:
        typeof raw.defaultBranch === "string" ? raw.defaultBranch : undefined,
    });
    const at = new Date().toISOString();
    called += 1;
    if (!built.ok) {
      executions.push({
        toolId,
        success: false,
        outcome: `${built.code}: ${built.message}`,
        at,
      });
      if (mandatory) {
        mandatoryOk = false;
        evidence.push({
          source: toolId,
          data: { error: built.code, message: built.message },
        });
      }
      return;
    }
    const safe = sanitizeMarketingEvidenceForResultJson(built.data);
    executions.push({
      toolId,
      success: true,
      outcome: summarize(toolId, safe),
      at,
    });
    evidence.push({ source: toolId, data: safe });
  };

  if (!workspaceId) {
    return {
      toolExecutions: [],
      evidence: [
        {
          source: "specialist_contract",
          data: {
            error: "WORKSPACE_REQUIRED",
            message:
              "ToolContext.workspaceId ausente — inspecao Marketing exige contexto da missao.",
          },
        },
      ],
      allSucceeded: false,
      attempted: true,
    };
  }

  if (!tools.canUse("readRepository") || !tools.readRepository) {
    fail(
      "readRepository",
      "PERMISSION_DENIED",
      "Employee sem permissao/metodo readRepository.",
      true,
    );
  } else {
    const result = await tools.readRepository({});
    if (result.ok) {
      succeed("readRepository", "repository", result.data, true);
    } else {
      fail("readRepository", result.error.code, result.error.message, true);
    }
  }

  {
    const toolId = "listDirectory";
    const validated = validateMarketingListDirectoryPath("");
    if (!validated.ok) {
      fail(toolId, validated.code, validated.message, true);
    } else if (!tools.canUse(toolId) || !tools.listDirectory) {
      fail(toolId, "PERMISSION_DENIED", `Sem permissao para ${toolId}.`, true);
    } else {
      const result = await tools.listDirectory({ path: validated.normalized });
      if (result.ok) {
        succeed(toolId, validated.normalized || "", result.data, true);
      } else {
        fail(toolId, result.error.code, result.error.message, true);
      }
    }
  }

  {
    const toolId = "readFile";
    const validated = validateMarketingReadFilePath(MARKETING_MANDATORY_README);
    if (!validated.ok) {
      fail(toolId, validated.code, validated.message, true);
    } else if (!tools.canUse(toolId) || !tools.readFile) {
      fail(toolId, "PERMISSION_DENIED", `Sem permissao para ${toolId}.`, true);
    } else {
      const result = await tools.readFile({ path: validated.normalized });
      if (result.ok) {
        succeed(toolId, validated.normalized, result.data, true);
      } else {
        fail(toolId, result.error.code, result.error.message, true);
      }
    }
  }

  for (const root of MARKETING_OPTIONAL_ROOTS) {
    const toolId = "listDirectory";
    const validated = validateMarketingListDirectoryPath(root);
    if (!validated.ok || !tools.canUse(toolId) || !tools.listDirectory) {
      continue;
    }
    const result = await tools.listDirectory({ path: validated.normalized });
    if (result.ok) {
      succeed(toolId, validated.normalized, result.data, false);
    } else if (result.error.code !== "NOT_FOUND") {
      fail(toolId, result.error.code, result.error.message, false);
    }
  }

  {
    const toolId = "searchFiles";
    const prefix = validateMarketingSearchPrefix("docs");
    if (prefix.ok && tools.canUse(toolId) && tools.searchFiles) {
      const result = await tools.searchFiles({
        query: MARKETING_SEARCH_QUERIES[0],
        pathPrefix: prefix.normalized,
        limit: 10,
      });
      if (result.ok) {
        succeed(toolId, prefix.normalized || "docs", result.data, false);
      }
    }
  }

  return {
    toolExecutions: executions,
    evidence,
    allSucceeded: mandatoryOk && called > 0,
    attempted: true,
  };
}
