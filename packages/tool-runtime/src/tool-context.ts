/**
 * ToolContext — fachada que o Employee usa.
 * Nunca expoe adapters concretos; so metodos tipados + permissao.
 */
import { ToolErrorCode, toolError } from "./result.js";
import { ToolId, type ToolId as ToolIdType } from "./tool-id.js";
import { toolFail, type ToolResult } from "./tool-result.js";
import type {
  CaddyInfo,
  CommitInfo,
  DockerComposeInfo,
  DockerfileInfo,
  FileContent,
  InfrastructureInventory,
  IssueInfo,
  ListDirectoryInput,
  ListDirectoryResult,
  ListInfrastructureInput,
  PullRequestInfo,
  ReadCaddyInput,
  ReadCommitInput,
  ReadDockerComposeInput,
  ReadDockerfileInput,
  ReadFileInput,
  ReadIssueInput,
  ReadLogsInput,
  ReadLogsResult,
  ReadPullRequestInput,
  ReadRepositoryInput,
  ReadWorkflowInput,
  RepositoryInfo,
  SearchFilesInput,
  SearchFilesResult,
  ToolPorts,
  WorkflowInfo,
} from "./tools.js";

export interface ToolContextOptions {
  readonly employeeId: string;
  readonly allowedTools: ReadonlySet<ToolIdType> | readonly ToolIdType[];
  readonly ports?: ToolPorts;
}

export class ToolContext {
  readonly employeeId: string;
  private readonly allowed: ReadonlySet<ToolIdType>;
  private readonly ports: ToolPorts;

  constructor(options: ToolContextOptions) {
    this.employeeId = options.employeeId;
    this.allowed = toSet(options.allowedTools);
    this.ports = options.ports ?? {};
  }

  /** Lista ToolIds permitidos para este Employee. */
  listAllowedTools(): readonly ToolIdType[] {
    return [...this.allowed];
  }

  canUse(toolId: ToolIdType): boolean {
    return this.allowed.has(toolId);
  }

  readRepository(
    input: ReadRepositoryInput = {},
  ): Promise<ToolResult<RepositoryInfo>> {
    return this.invoke(ToolId.readRepository, input, (ports, value) =>
      ports.readRepository!.execute(value),
    );
  }

  listDirectory(
    input: ListDirectoryInput,
  ): Promise<ToolResult<ListDirectoryResult>> {
    return this.invoke(ToolId.listDirectory, input, (ports, value) =>
      ports.listDirectory!.execute(value),
    );
  }

  readFile(input: ReadFileInput): Promise<ToolResult<FileContent>> {
    return this.invoke(ToolId.readFile, input, (ports, value) =>
      ports.readFile!.execute(value),
    );
  }

  searchFiles(
    input: SearchFilesInput,
  ): Promise<ToolResult<SearchFilesResult>> {
    return this.invoke(ToolId.searchFiles, input, (ports, value) =>
      ports.searchFiles!.execute(value),
    );
  }

  readCommit(input: ReadCommitInput): Promise<ToolResult<CommitInfo>> {
    return this.invoke(ToolId.readCommit, input, (ports, value) =>
      ports.readCommit!.execute(value),
    );
  }

  readPullRequest(
    input: ReadPullRequestInput,
  ): Promise<ToolResult<PullRequestInfo>> {
    return this.invoke(ToolId.readPullRequest, input, (ports, value) =>
      ports.readPullRequest!.execute(value),
    );
  }

  readIssue(input: ReadIssueInput): Promise<ToolResult<IssueInfo>> {
    return this.invoke(ToolId.readIssue, input, (ports, value) =>
      ports.readIssue!.execute(value),
    );
  }

  readWorkflow(
    input: ReadWorkflowInput,
  ): Promise<ToolResult<WorkflowInfo>> {
    return this.invoke(ToolId.readWorkflow, input, (ports, value) =>
      ports.readWorkflow!.execute(value),
    );
  }

  readLogs(input: ReadLogsInput): Promise<ToolResult<ReadLogsResult>> {
    return this.invoke(ToolId.readLogs, input, (ports, value) =>
      ports.readLogs!.execute(value),
    );
  }

  readDockerCompose(
    input: ReadDockerComposeInput = {},
  ): Promise<ToolResult<DockerComposeInfo>> {
    return this.invoke(ToolId.readDockerCompose, input, (ports, value) =>
      ports.readDockerCompose!.execute(value),
    );
  }

  readDockerfile(
    input: ReadDockerfileInput = {},
  ): Promise<ToolResult<DockerfileInfo>> {
    return this.invoke(ToolId.readDockerfile, input, (ports, value) =>
      ports.readDockerfile!.execute(value),
    );
  }

  readCaddy(input: ReadCaddyInput = {}): Promise<ToolResult<CaddyInfo>> {
    return this.invoke(ToolId.readCaddy, input, (ports, value) =>
      ports.readCaddy!.execute(value),
    );
  }

  listInfrastructure(
    input: ListInfrastructureInput = {},
  ): Promise<ToolResult<InfrastructureInventory>> {
    return this.invoke(ToolId.listInfrastructure, input, (ports, value) =>
      ports.listInfrastructure!.execute(value),
    );
  }

  private async invoke<TIn, TOut>(
    toolId: ToolIdType,
    input: TIn,
    run: (ports: ToolPorts, input: TIn) => Promise<ToolResult<TOut>>,
  ): Promise<ToolResult<TOut>> {
    if (!this.allowed.has(toolId)) {
      return toolFail(
        toolError({
          code: ToolErrorCode.PERMISSION_DENIED,
          message: `Employee ${this.employeeId} sem permissao para ${toolId}`,
          toolId,
          employeeId: this.employeeId,
        }),
      );
    }

    const port = (this.ports as Record<string, unknown>)[toolId];
    if (!port) {
      return toolFail(
        toolError({
          code: ToolErrorCode.NOT_IMPLEMENTED,
          message: `Adapter ausente para ${toolId} (Sprint A.1 — contratos apenas)`,
          toolId,
          employeeId: this.employeeId,
        }),
      );
    }

    return run(this.ports, input);
  }
}

function toSet(
  value: ReadonlySet<ToolIdType> | readonly ToolIdType[],
): ReadonlySet<ToolIdType> {
  if (value instanceof Set) {
    return value;
  }
  return new Set(value);
}
