/**
 * Composition: ToolContext + GitHub + LocalInfrastructure (read-only).
 * Merge de ports: local preenche Infra/Logs; GitHub sobrescreve readWorkflow (API).
 */
import type { DomainSignalService } from "@operaia/domain-signals";
import {
  buildToolsForEmployee,
  type EmployeeToolsFactory,
} from "@operaia/employee-runtime";
import {
  createGithubToolPorts,
  createLocalInfrastructureToolPorts,
  FileInfrastructureLogSource,
  MapWorkspaceInfrastructureResolver,
  MemoryTtlCache,
  NodeInfrastructureFileSystem,
  type GithubApiClient,
  type GithubApiClientOptions,
  type InfrastructureFileSystem,
  type InfrastructureLogSource,
  type ToolPorts,
  type WorkspaceInfrastructureResolver,
} from "@operaia/tool-runtime";
import { createBindingGithubRepositoryResolver } from "./github-binding-repository-resolver.js";

export interface EmployeeToolsFactoryOptions {
  readonly signals?: DomainSignalService;
  /** Cliente HTTP compartilhado com o scanner — preferir sempre. */
  readonly client?: GithubApiClient;
  readonly token?: string | null;
  readonly clientOptions?: GithubApiClientOptions;
  readonly cache?: MemoryTtlCache;
  /** workspaceId → absolute root (isolamento). */
  readonly workspaceInfraRoots?: Readonly<Record<string, string>>;
  readonly infraResolver?: WorkspaceInfrastructureResolver;
  readonly infraFs?: InfrastructureFileSystem;
  readonly infraLogs?: InfrastructureLogSource;
}

/**
 * Factory unificada (GitHub A.2 + Local Infra A.3).
 */
export function createEmployeeToolsFactory(
  input: EmployeeToolsFactoryOptions = {},
): EmployeeToolsFactory {
  const resolver = input.signals
    ? createBindingGithubRepositoryResolver(input.signals)
    : null;
  const sharedCache = input.cache ?? new MemoryTtlCache(60_000);
  const infraResolver =
    input.infraResolver ??
    new MapWorkspaceInfrastructureResolver(input.workspaceInfraRoots ?? {});
  const infraFs = input.infraFs ?? new NodeInfrastructureFileSystem();
  const infraLogs =
    input.infraLogs ?? new FileInfrastructureLogSource(infraFs);

  return (employeeId, workspaceId) => {
    const localPorts = createLocalInfrastructureToolPorts({
      workspaceId,
      resolver: infraResolver,
      fs: infraFs,
      logs: infraLogs,
      employeeId,
    });

    let githubPorts: ToolPorts = {};
    if (resolver) {
      githubPorts = createGithubToolPorts({
        workspaceId,
        resolver,
        cache: sharedCache,
        employeeId,
        client: input.client,
        clientOptions: input.client
          ? undefined
          : {
              token: input.token,
              ...input.clientOptions,
            },
      });
    }

    // Local primeiro; GitHub sobrescreve readWorkflow (API Actions).
    const ports: ToolPorts = { ...localPorts, ...githubPorts };
    return buildToolsForEmployee(employeeId, { ports });
  };
}

/** @deprecated Prefer createEmployeeToolsFactory — mantido para callers A.2. */
export function createGithubEmployeeToolsFactory(input: {
  readonly signals: DomainSignalService;
  readonly client?: GithubApiClient;
  readonly token?: string | null;
  readonly clientOptions?: GithubApiClientOptions;
  readonly cache?: MemoryTtlCache;
  readonly workspaceInfraRoots?: Readonly<Record<string, string>>;
  readonly infraResolver?: WorkspaceInfrastructureResolver;
  readonly infraFs?: InfrastructureFileSystem;
  readonly infraLogs?: InfrastructureLogSource;
}): EmployeeToolsFactory {
  return createEmployeeToolsFactory(input);
}
