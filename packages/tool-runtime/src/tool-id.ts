/**
 * Identificadores estaveis das ferramentas (Sprint A.1 — contratos).
 */
export const ToolId = {
  readRepository: "readRepository",
  listDirectory: "listDirectory",
  readFile: "readFile",
  searchFiles: "searchFiles",
  readCommit: "readCommit",
  readPullRequest: "readPullRequest",
  readIssue: "readIssue",
  readWorkflow: "readWorkflow",
  readLogs: "readLogs",
  readDockerCompose: "readDockerCompose",
  readDockerfile: "readDockerfile",
  readCaddy: "readCaddy",
  listInfrastructure: "listInfrastructure",
} as const;

export type ToolId = (typeof ToolId)[keyof typeof ToolId];

export const ALL_TOOL_IDS: readonly ToolId[] = Object.values(ToolId);
