/**
 * Grupos de capacidade e politica centralizada de permissao.
 * Nenhuma permissao hardcoded nos Employees.
 */
import { ToolId, type ToolId as ToolIdType } from "./tool-id.js";

/**
 * Grupos logicos da Sprint A.1 / A.3.
 */
export const ToolCapabilityGroup = {
  Repository: "Repository",
  Search: "Search",
  Commit: "Commit",
  PullRequest: "PullRequest",
  Issue: "Issue",
  Infra: "Infra",
  Docker: "Docker",
  Caddy: "Caddy",
  Logs: "Logs",
  Runtime: "Runtime",
  Finance: "Finance",
  Documents: "Documents",
  RepositoryDocs: "RepositoryDocs",
  RoadmapDocs: "RoadmapDocs",
} as const;

export type ToolCapabilityGroup =
  (typeof ToolCapabilityGroup)[keyof typeof ToolCapabilityGroup];

/** Mapa grupo → tools concretas. */
export const TOOL_GROUP_TOOLS: Readonly<
  Record<ToolCapabilityGroup, readonly ToolIdType[]>
> = {
  Repository: [
    ToolId.readRepository,
    ToolId.listDirectory,
    ToolId.readFile,
    ToolId.searchFiles,
  ],
  Search: [ToolId.searchFiles],
  Commit: [ToolId.readCommit],
  PullRequest: [ToolId.readPullRequest],
  Issue: [ToolId.readIssue],
  Infra: [
    ToolId.readDockerCompose,
    ToolId.readCaddy,
    ToolId.listInfrastructure,
  ],
  Docker: [ToolId.readDockerfile, ToolId.readDockerCompose],
  Caddy: [ToolId.readCaddy],
  Logs: [ToolId.readLogs],
  Runtime: [ToolId.readWorkflow, ToolId.readLogs],
  Finance: [ToolId.readFile, ToolId.listDirectory, ToolId.searchFiles],
  Documents: [ToolId.readFile, ToolId.listDirectory, ToolId.searchFiles],
  RepositoryDocs: [
    ToolId.readRepository,
    ToolId.listDirectory,
    ToolId.readFile,
    ToolId.searchFiles,
  ],
  RoadmapDocs: [ToolId.readFile, ToolId.listDirectory, ToolId.searchFiles],
};

/**
 * Matriz employeeId → grupos (unica fonte de verdade).
 * Atlas: Infra + Docker + Logs + Caddy
 * Orion: Runtime + Logs
 * Mag / Luna: sem Logs
 * Mercurio / Themis: sem Infra
 */
export const DEFAULT_EMPLOYEE_TOOL_GROUPS: Readonly<
  Record<string, readonly ToolCapabilityGroup[]>
> = {
  "cto-mag": [
    ToolCapabilityGroup.Repository,
    ToolCapabilityGroup.Search,
    ToolCapabilityGroup.Commit,
    ToolCapabilityGroup.PullRequest,
    ToolCapabilityGroup.Issue,
  ],
  luna: [ToolCapabilityGroup.Repository, ToolCapabilityGroup.Search],
  atlas: [
    ToolCapabilityGroup.Infra,
    ToolCapabilityGroup.Docker,
    ToolCapabilityGroup.Logs,
    ToolCapabilityGroup.Caddy,
  ],
  orion: [ToolCapabilityGroup.Runtime, ToolCapabilityGroup.Logs],
  aurora: [ToolCapabilityGroup.Finance],
  themis: [ToolCapabilityGroup.Documents],
  mercurio: [ToolCapabilityGroup.RepositoryDocs],
  nexus: [ToolCapabilityGroup.RoadmapDocs],
  // Opera coordena; ferramentas de leitura ficam com especialistas.
  "operaia-ceo": [],
};

export interface ToolPermissionPolicyOptions {
  readonly employeeGroups?: Readonly<
    Record<string, readonly ToolCapabilityGroup[]>
  >;
  readonly groupTools?: Readonly<
    Record<ToolCapabilityGroup, readonly ToolIdType[]>
  >;
}

/**
 * Politica centralizada: resolve quais ToolIds um Employee pode usar.
 */
export class ToolPermissionPolicy {
  private readonly employeeGroups: Readonly<
    Record<string, readonly ToolCapabilityGroup[]>
  >;
  private readonly groupTools: Readonly<
    Record<ToolCapabilityGroup, readonly ToolIdType[]>
  >;

  constructor(options: ToolPermissionPolicyOptions = {}) {
    this.employeeGroups =
      options.employeeGroups ?? DEFAULT_EMPLOYEE_TOOL_GROUPS;
    this.groupTools = options.groupTools ?? TOOL_GROUP_TOOLS;
  }

  groupsFor(employeeId: string): readonly ToolCapabilityGroup[] {
    return this.employeeGroups[employeeId] ?? [];
  }

  allowedTools(employeeId: string): readonly ToolIdType[] {
    const groups = this.groupsFor(employeeId);
    const set = new Set<ToolIdType>();
    for (const group of groups) {
      for (const toolId of this.groupTools[group] ?? []) {
        set.add(toolId);
      }
    }
    return [...set];
  }

  isAllowed(employeeId: string, toolId: ToolIdType): boolean {
    return this.allowedTools(employeeId).includes(toolId);
  }
}

export const defaultToolPermissionPolicy = new ToolPermissionPolicy();
