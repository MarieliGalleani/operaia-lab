/**
 * Inspecao UX READ-ONLY — isolada do SpecialistBrain (manutenibilidade).
 */
import type {
  EmployeeDeliveryEvidence,
  EmployeeToolExecution,
} from "@operaia/employee-framework";
import {
  UX_MANDATORY_README,
  UX_OPTIONAL_ROOTS,
  UX_SEARCH_QUERIES,
  validateUxListDirectoryPath,
  validateUxReadFilePath,
  validateUxSearchPrefix,
} from "./ux-artifact-path.js";
import {
  buildUxEvidence,
  sanitizeUxEvidenceForResultJson,
} from "./ux-evidence.js";

export interface UxToolContext {
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

export interface UxInspectionResult {
  readonly toolExecutions: readonly EmployeeToolExecution[];
  readonly evidence: readonly EmployeeDeliveryEvidence[];
  readonly allSucceeded: boolean;
  readonly attempted: boolean;
}

function summarize(toolId: string, data: Readonly<Record<string, unknown>>): string {
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

export async function inspectUxArtifacts(
  tools: UxToolContext,
): Promise<UxInspectionResult> {
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
    const built = buildUxEvidence({
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
    const safe = sanitizeUxEvidenceForResultJson(built.data);
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
              "ToolContext.workspaceId ausente — inspecao UX exige contexto da missao.",
          },
        },
      ],
      allSucceeded: false,
      attempted: true,
    };
  }

  // 1) readRepository (obrigatorio)
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
      fail(
        "readRepository",
        result.error.code,
        result.error.message,
        true,
      );
    }
  }

  // 2) listDirectory raiz (obrigatorio)
  {
    const toolId = "listDirectory";
    const validated = validateUxListDirectoryPath("");
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

  // 3) readFile README (obrigatorio)
  {
    const toolId = "readFile";
    const validated = validateUxReadFilePath(UX_MANDATORY_README);
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

  // 4) listDirectory opcional em roots UX
  for (const root of UX_OPTIONAL_ROOTS) {
    const toolId = "listDirectory";
    const validated = validateUxListDirectoryPath(root);
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

  // 5) searchFiles opcional
  {
    const toolId = "searchFiles";
    const prefix = validateUxSearchPrefix("docs");
    if (
      prefix.ok &&
      tools.canUse(toolId) &&
      tools.searchFiles
    ) {
      const result = await tools.searchFiles({
        query: UX_SEARCH_QUERIES[0],
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
