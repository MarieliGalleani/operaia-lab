import type { ToolResult } from "./tool-result.js";

/** Contratos de ferramentas — repository opcional (resolvido via Workspace binding). */

export interface ReadRepositoryInput {
  readonly repository?: string;
}

export interface RepositoryInfo {
  readonly repository: string;
  readonly owner: string;
  readonly name: string;
  readonly defaultBranch: string;
  readonly description: string | null;
  readonly primaryLanguage: string | null;
  readonly updatedAt: string | null;
}

export interface ReadRepositoryTool {
  execute(input: ReadRepositoryInput): Promise<ToolResult<RepositoryInfo>>;
}

export interface ListDirectoryInput {
  readonly repository?: string;
  readonly path?: string;
  readonly ref?: string;
}

export interface DirectoryEntry {
  readonly name: string;
  readonly path: string;
  readonly type: "file" | "dir" | "symlink" | "unknown";
  readonly size: number | null;
}

export interface ListDirectoryResult {
  readonly repository: string;
  readonly path: string;
  readonly entries: readonly DirectoryEntry[];
}

export interface ListDirectoryTool {
  execute(
    input: ListDirectoryInput,
  ): Promise<ToolResult<ListDirectoryResult>>;
}

export interface ReadFileInput {
  readonly repository?: string;
  readonly path: string;
  readonly ref?: string;
}

export interface FileContent {
  readonly repository: string;
  readonly path: string;
  readonly content: string;
  readonly encoding: "utf-8" | "base64";
  readonly size: number;
  readonly sha: string | null;
}

export interface ReadFileTool {
  execute(input: ReadFileInput): Promise<ToolResult<FileContent>>;
}

export interface SearchFilesInput {
  readonly repository?: string;
  readonly query: string;
  readonly pathPrefix?: string;
  readonly ref?: string;
  readonly limit?: number;
}

export interface SearchFileHit {
  readonly path: string;
  readonly score?: number;
  readonly snippet?: string;
}

export interface SearchFilesResult {
  readonly repository: string;
  readonly query: string;
  readonly hits: readonly SearchFileHit[];
}

export interface SearchFilesTool {
  execute(input: SearchFilesInput): Promise<ToolResult<SearchFilesResult>>;
}

export interface ReadCommitInput {
  readonly repository?: string;
  readonly sha: string;
}

export interface CommitFileChange {
  readonly path: string;
  readonly status: string | null;
}

export interface CommitInfo {
  readonly repository: string;
  readonly sha: string;
  readonly message: string;
  readonly authorLogin: string | null;
  readonly authorName: string | null;
  readonly committedAt: string | null;
  readonly files: readonly string[];
  readonly fileChanges: readonly CommitFileChange[];
  readonly status: string | null;
}

export interface ReadCommitTool {
  execute(input: ReadCommitInput): Promise<ToolResult<CommitInfo>>;
}

export interface ReadPullRequestInput {
  readonly repository?: string;
  readonly number: number;
}

export interface PullRequestInfo {
  readonly repository: string;
  readonly number: number;
  readonly title: string;
  readonly description: string | null;
  readonly state: string;
  readonly draft: boolean;
  readonly authorLogin: string | null;
  readonly baseRef: string | null;
  readonly headRef: string | null;
  readonly htmlUrl: string | null;
  readonly commits: readonly string[];
  readonly files: readonly string[];
}

export interface ReadPullRequestTool {
  execute(
    input: ReadPullRequestInput,
  ): Promise<ToolResult<PullRequestInfo>>;
}

export interface ReadIssueInput {
  readonly repository?: string;
  readonly number: number;
}

export interface IssueComment {
  readonly id: number;
  readonly authorLogin: string | null;
  readonly body: string;
  readonly createdAt: string | null;
}

export interface IssueInfo {
  readonly repository: string;
  readonly number: number;
  readonly title: string;
  readonly state: string;
  readonly authorLogin: string | null;
  readonly labels: readonly string[];
  readonly htmlUrl: string | null;
  readonly comments: readonly IssueComment[];
}

export interface ReadIssueTool {
  execute(input: ReadIssueInput): Promise<ToolResult<IssueInfo>>;
}

export interface ReadWorkflowInput {
  readonly repository?: string;
  readonly workflowIdOrPath: string;
}

export interface WorkflowInfo {
  readonly repository: string;
  readonly id: string;
  readonly name: string;
  readonly path: string | null;
  readonly state: string | null;
  readonly status: string | null;
  readonly lastRunAt: string | null;
  readonly branch: string | null;
  readonly conclusion: string | null;
  /** Conteudo local do YAML (adapter filesystem). */
  readonly content?: string | null;
  readonly lastModified?: string | null;
}

export interface ReadWorkflowTool {
  execute(input: ReadWorkflowInput): Promise<ToolResult<WorkflowInfo>>;
}

export interface ReadLogsInput {
  readonly source: string;
  readonly limit?: number;
  readonly since?: string;
}

export interface LogEntry {
  readonly timestamp: string | null;
  readonly level: string | null;
  readonly message: string;
}

export interface ReadLogsResult {
  readonly source: string;
  readonly entries: readonly LogEntry[];
}

export interface ReadLogsTool {
  execute(input: ReadLogsInput): Promise<ToolResult<ReadLogsResult>>;
}

export interface ReadDockerComposeInput {
  readonly path?: string;
}

export interface DockerComposeInfo {
  readonly path: string;
  readonly content: string;
  readonly lastModified: string | null;
  readonly services: readonly string[];
  /** Alias de content (compat A.1). */
  readonly raw: string | null;
}

export interface ReadDockerComposeTool {
  execute(
    input: ReadDockerComposeInput,
  ): Promise<ToolResult<DockerComposeInfo>>;
}

export interface ReadDockerfileInput {
  readonly path?: string;
}

export interface DockerfileInfo {
  readonly path: string;
  readonly content: string;
  readonly lastModified: string | null;
}

export interface ReadDockerfileTool {
  execute(input: ReadDockerfileInput): Promise<ToolResult<DockerfileInfo>>;
}

export interface ReadCaddyInput {
  readonly path?: string;
}

export interface CaddyInfo {
  readonly path: string;
  readonly content: string;
  readonly lastModified: string | null;
  /** Alias de content (compat A.1). */
  readonly raw: string | null;
}

export interface ReadCaddyTool {
  execute(input: ReadCaddyInput): Promise<ToolResult<CaddyInfo>>;
}

export interface ListInfrastructureInput {
  readonly pathPrefix?: string;
}

export interface InfrastructureInventory {
  readonly workspaceId: string;
  readonly dockerfiles: readonly string[];
  readonly dockerComposes: readonly string[];
  readonly workflows: readonly string[];
  readonly caddyfiles: readonly string[];
}

export interface ListInfrastructureTool {
  execute(
    input?: ListInfrastructureInput,
  ): Promise<ToolResult<InfrastructureInventory>>;
}

/**
 * Ports opcionais — preenchidos por adapters (A.2+ GitHub / A.3 Local).
 */
export interface ToolPorts {
  readonly readRepository?: ReadRepositoryTool;
  readonly listDirectory?: ListDirectoryTool;
  readonly readFile?: ReadFileTool;
  readonly searchFiles?: SearchFilesTool;
  readonly readCommit?: ReadCommitTool;
  readonly readPullRequest?: ReadPullRequestTool;
  readonly readIssue?: ReadIssueTool;
  readonly readWorkflow?: ReadWorkflowTool;
  readonly readLogs?: ReadLogsTool;
  readonly readDockerCompose?: ReadDockerComposeTool;
  readonly readDockerfile?: ReadDockerfileTool;
  readonly readCaddy?: ReadCaddyTool;
  readonly listInfrastructure?: ListInfrastructureTool;
}
