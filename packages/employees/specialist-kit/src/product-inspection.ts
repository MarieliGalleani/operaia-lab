/**
 * Inspecao Product READ-ONLY — isolada do SpecialistBrain.
 *
 * Tools alinhadas a policy RoadmapDocs do Nexus:
 * listDirectory, readFile, searchFiles (sem readRepository).
 */
import type {
  EmployeeDeliveryEvidence,
  EmployeeToolExecution,
} from "@operaia/employee-framework";
import {
  PRODUCT_MANDATORY_README,
  PRODUCT_OPTIONAL_ROOTS,
  PRODUCT_SEARCH_QUERIES,
  validateProductListDirectoryPath,
  validateProductReadFilePath,
  validateProductSearchPrefix,
} from "./product-artifact-path.js";
import {
  buildProductEvidence,
  sanitizeProductEvidenceForResultJson,
} from "./product-evidence.js";

export interface ProductToolContext {
  canUse(toolId: string): boolean;
  readonly workspaceId?: string;
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

export interface ProductInspectionResult {
  readonly toolExecutions: readonly EmployeeToolExecution[];
  readonly evidence: readonly EmployeeDeliveryEvidence[];
  readonly allSucceeded: boolean;
  readonly attempted: boolean;
}

function summarize(
  toolId: string,
  data: Readonly<Record<string, unknown>>,
): string {
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

export async function inspectProductArtifacts(
  tools: ProductToolContext,
): Promise<ProductInspectionResult> {
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
    toolId: "listDirectory" | "readFile" | "searchFiles",
    artifactPath: string,
    raw: Readonly<Record<string, unknown>>,
    mandatory: boolean,
  ) => {
    const built = buildProductEvidence({
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
    const safe = sanitizeProductEvidenceForResultJson(built.data);
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
              "ToolContext.workspaceId ausente — inspecao Product exige contexto da missao.",
          },
        },
      ],
      allSucceeded: false,
      attempted: true,
    };
  }

  {
    const toolId = "listDirectory";
    const validated = validateProductListDirectoryPath("");
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
    const validated = validateProductReadFilePath(PRODUCT_MANDATORY_README);
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

  for (const root of PRODUCT_OPTIONAL_ROOTS) {
    const toolId = "listDirectory";
    const validated = validateProductListDirectoryPath(root);
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
    const prefix = validateProductSearchPrefix("docs");
    if (prefix.ok && tools.canUse(toolId) && tools.searchFiles) {
      const result = await tools.searchFiles({
        query: PRODUCT_SEARCH_QUERIES[0],
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
