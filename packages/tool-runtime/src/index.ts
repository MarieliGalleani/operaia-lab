/**
 * @operaia/tool-runtime — fundacao de ferramentas para especialistas.
 * Sprint A.1: contratos + ToolContext + Permission Policy
 * Sprint A.2: GitHub Tool Adapter
 * Sprint A.3: Local Infrastructure Adapter (read-only)
 */

export { ToolId, ALL_TOOL_IDS, type ToolId as ToolIdType } from "./tool-id.js";

export {
  ToolErrorCode,
  ToolRuntimeError,
  toolError,
  type ToolError,
  type ToolErrorCode as ToolErrorCodeType,
} from "./result.js";

export {
  toolOk,
  toolFail,
  type ToolResult,
} from "./tool-result.js";

export type {
  ToolPorts,
  ReadRepositoryInput,
  RepositoryInfo,
  ReadRepositoryTool,
  ListDirectoryInput,
  DirectoryEntry,
  ListDirectoryResult,
  ListDirectoryTool,
  ReadFileInput,
  FileContent,
  ReadFileTool,
  SearchFilesInput,
  SearchFileHit,
  SearchFilesResult,
  SearchFilesTool,
  ReadCommitInput,
  CommitInfo,
  ReadCommitTool,
  ReadPullRequestInput,
  PullRequestInfo,
  ReadPullRequestTool,
  ReadIssueInput,
  IssueInfo,
  ReadIssueTool,
  ReadWorkflowInput,
  WorkflowInfo,
  ReadWorkflowTool,
  ReadLogsInput,
  LogEntry,
  ReadLogsResult,
  ReadLogsTool,
  ReadDockerComposeInput,
  DockerComposeInfo,
  ReadDockerComposeTool,
  ReadDockerfileInput,
  DockerfileInfo,
  ReadDockerfileTool,
  ReadCaddyInput,
  CaddyInfo,
  ReadCaddyTool,
  ListInfrastructureInput,
  InfrastructureInventory,
  ListInfrastructureTool,
} from "./tools.js";

export {
  ToolCapabilityGroup,
  TOOL_GROUP_TOOLS,
  DEFAULT_EMPLOYEE_TOOL_GROUPS,
  ToolPermissionPolicy,
  defaultToolPermissionPolicy,
  type ToolPermissionPolicyOptions,
} from "./tool-permission-policy.js";

export { ToolContext, type ToolContextOptions } from "./tool-context.js";

export {
  createToolContext,
  type CreateToolContextInput,
} from "./create-tool-context.js";

export {
  GithubApiClient,
  GithubApiRequestError,
  mapHttpStatus,
  parseOwnerRepo,
  parseLastPage,
  MemoryTtlCache,
  GitHubToolAdapter,
  createGithubToolPorts,
  StaticGithubRepositoryResolver,
  FixedGithubRepositoryResolver,
  type GithubApiClientOptions,
  type GithubApiErrorShape,
  type GitHubToolAdapterOptions,
  type GithubRepositoryResolver,
} from "./adapters/github/index.js";

export {
  LocalInfrastructureAdapter,
  createLocalInfrastructureToolPorts,
  MemoryInfrastructureFileSystem,
  MemoryInfrastructureLogSource,
  FileInfrastructureLogSource,
  JournalctlInfrastructureLogSource,
  JournalctlUnitNotAllowedError,
  JournalctlExecError,
  JOURNAL_UNIT_ALLOWLIST,
  MapWorkspaceInfrastructureResolver,
  NodeInfrastructureFileSystem,
  MAX_LOG_LINES,
  clampLimit,
  parseComposeServices,
  isWhitelistedRelativePath,
  normalizeRelativePath,
  type LocalInfrastructureAdapterOptions,
  type InfrastructureFileSystem,
  type InfrastructureLogSource,
  type WorkspaceInfrastructureResolver,
} from "./adapters/local/index.js";
