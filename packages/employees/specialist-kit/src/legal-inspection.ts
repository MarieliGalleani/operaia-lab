/**
 * Inspecao Legal READ-ONLY — isolada do SpecialistBrain.
 *
 * Tools alinhadas a policy Documents do Themis
 * (listDirectory/readFile/searchFiles, sem readRepository).
 */
import type {
  EmployeeDeliveryEvidence,
  EmployeeToolExecution,
} from "@operaia/employee-framework";
import {
  LEGAL_MANDATORY_README,
  LEGAL_OPTIONAL_ROOTS,
  LEGAL_SEARCH_QUERIES,
  validateLegalListDirectoryPath,
  validateLegalReadFilePath,
  validateLegalSearchPrefix,
} from "./legal-artifact-path.js";
import {
  buildLegalEvidence,
  sanitizeLegalEvidenceForResultJson,
} from "./legal-evidence.js";

export interface LegalToolContext {
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

export interface LegalInspectionResult {
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

export async function inspectLegalArtifacts(
  tools: LegalToolContext,
): Promise<LegalInspectionResult> {
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
    const built = buildLegalEvidence({
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
    const safe = sanitizeLegalEvidenceForResultJson(built.data);
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
              "ToolContext.workspaceId ausente — inspecao Legal exige contexto da missao.",
          },
        },
      ],
      allSucceeded: false,
      attempted: true,
    };
  }

  {
    const toolId = "listDirectory";
    const validated = validateLegalListDirectoryPath("");
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
    const validated = validateLegalReadFilePath(LEGAL_MANDATORY_README);
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

  for (const root of LEGAL_OPTIONAL_ROOTS) {
    const toolId = "listDirectory";
    const validated = validateLegalListDirectoryPath(root);
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
    const prefix = validateLegalSearchPrefix("docs");
    if (prefix.ok && tools.canUse(toolId) && tools.searchFiles) {
      const result = await tools.searchFiles({
        query: LEGAL_SEARCH_QUERIES[0],
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
