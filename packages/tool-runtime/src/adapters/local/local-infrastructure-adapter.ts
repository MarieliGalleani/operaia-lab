/**
 * LocalInfrastructureAdapter — leitura de infra local (somente READ).
 * Nao depende de Employees nem do Runtime.
 * Health/queue/workers: reutilizar Operational Snapshot / VPS (nao duplicar aqui).
 */
import { ToolErrorCode } from "../../result.js";
import { toolOk, type ToolResult } from "../../tool-result.js";
import { ToolId, type ToolId as ToolIdType } from "../../tool-id.js";
import type {
  CaddyInfo,
  DockerComposeInfo,
  DockerfileInfo,
  InfrastructureInventory,
  ListInfrastructureInput,
  ReadCaddyInput,
  ReadDockerComposeInput,
  ReadDockerfileInput,
  ReadLogsInput,
  ReadLogsResult,
  ReadWorkflowInput,
  ToolPorts,
  WorkflowInfo,
} from "../../tools.js";
import type { InfrastructureFileSystem } from "./infrastructure-fs.js";
import {
  clampLimit,
  type InfrastructureLogSource,
} from "./infrastructure-log-source.js";
import { walkInfrastructureInventory } from "./inventory-walker.js";
import { LocalInfraPathAccess } from "./local-infra-path-access.js";
import { parseComposeServices } from "./parse-compose-services.js";
import {
  basenameOf,
  isCaddyfileName,
  isDockerComposeName,
  isDockerfileName,
  isWhitelistedRelativePath,
  isWorkflowRelativePath,
  normalizeRelativePath,
} from "./path-whitelist.js";
import type { WorkspaceInfrastructureResolver } from "./workspace-infra-resolver.js";

const DEFAULT_COMPOSE_CANDIDATES = [
  "docker-compose.yml",
  "docker-compose.yaml",
  "infra/docker-compose.yml",
  "infra/docker-compose.yaml",
] as const;

const DEFAULT_DOCKERFILE_CANDIDATES = [
  "Dockerfile",
  "infra/Dockerfile",
] as const;

const DEFAULT_CADDY_CANDIDATES = [
  "Caddyfile",
  "infra/caddy/Caddyfile",
  "infra/Caddyfile",
] as const;

const JOURNAL_SOURCES = new Set([
  "journal",
  "systemd",
  "api",
  "operaia-lab-api",
  "operaia-api",
]);

export interface LocalInfrastructureAdapterOptions {
  readonly workspaceId: string;
  readonly resolver: WorkspaceInfrastructureResolver;
  readonly fs: InfrastructureFileSystem;
  readonly logs: InfrastructureLogSource;
  readonly employeeId?: string;
}

export class LocalInfrastructureAdapter {
  private readonly workspaceId: string;
  private readonly fs: InfrastructureFileSystem;
  private readonly logs: InfrastructureLogSource;
  private readonly paths: LocalInfraPathAccess;

  constructor(options: LocalInfrastructureAdapterOptions) {
    this.workspaceId = options.workspaceId;
    this.fs = options.fs;
    this.logs = options.logs;
    this.paths = new LocalInfraPathAccess(
      options.workspaceId,
      options.resolver,
      options.fs,
      options.employeeId,
    );
  }

  asToolPorts(): ToolPorts {
    return {
      readDockerCompose: {
        execute: (input) => this.readDockerCompose(input),
      },
      readDockerfile: { execute: (input) => this.readDockerfile(input) },
      readCaddy: { execute: (input) => this.readCaddy(input) },
      readWorkflow: { execute: (input) => this.readWorkflow(input) },
      readLogs: { execute: (input) => this.readLogs(input) },
      listInfrastructure: {
        execute: (input) => this.listInfrastructure(input),
      },
    };
  }

  async readDockerCompose(
    input: ReadDockerComposeInput = {},
  ): Promise<ToolResult<DockerComposeInfo>> {
    return this.guard(ToolId.readDockerCompose, async () => {
      const relative = await this.paths.resolveExistingRelative(
        ToolId.readDockerCompose,
        input.path,
        DEFAULT_COMPOSE_CANDIDATES,
        (name) => isDockerComposeName(name),
      );
      if (!relative.ok) {
        return relative;
      }
      return this.paths.readTextFile(
        ToolId.readDockerCompose,
        relative.data,
        (content, path, lastModified) => ({
          path,
          content,
          lastModified,
          services: parseComposeServices(content),
          raw: content,
        }),
      );
    });
  }

  async readDockerfile(
    input: ReadDockerfileInput = {},
  ): Promise<ToolResult<DockerfileInfo>> {
    return this.guard(ToolId.readDockerfile, async () => {
      const relative = await this.paths.resolveExistingRelative(
        ToolId.readDockerfile,
        input.path,
        DEFAULT_DOCKERFILE_CANDIDATES,
        (name) => isDockerfileName(name),
      );
      if (!relative.ok) {
        return relative;
      }
      return this.paths.readTextFile(
        ToolId.readDockerfile,
        relative.data,
        (content, path, lastModified) => ({
          path,
          content,
          lastModified,
        }),
      );
    });
  }

  async readCaddy(input: ReadCaddyInput = {}): Promise<ToolResult<CaddyInfo>> {
    return this.guard(ToolId.readCaddy, async () => {
      const relative = await this.paths.resolveExistingRelative(
        ToolId.readCaddy,
        input.path,
        DEFAULT_CADDY_CANDIDATES,
        (name) => isCaddyfileName(name),
      );
      if (!relative.ok) {
        return relative;
      }
      return this.paths.readTextFile(
        ToolId.readCaddy,
        relative.data,
        (content, path, lastModified) => ({
          path,
          content,
          lastModified,
          raw: content,
        }),
      );
    });
  }

  async readWorkflow(
    input: ReadWorkflowInput,
  ): Promise<ToolResult<WorkflowInfo>> {
    return this.guard(ToolId.readWorkflow, async () => {
      const requested = input.workflowIdOrPath.trim();
      if (!requested) {
        return this.paths.fail(
          ToolId.readWorkflow,
          ToolErrorCode.INVALID_INPUT,
          "workflowIdOrPath obrigatorio",
        );
      }

      const normalizedRequest = normalizeRelativePath(requested);
      if (!normalizedRequest) {
        return this.paths.fail(
          ToolId.readWorkflow,
          ToolErrorCode.PATH_FORBIDDEN,
          `Path invalido: ${requested}`,
          { path: requested },
        );
      }

      const candidates: string[] = [];
      if (isWorkflowRelativePath(normalizedRequest)) {
        candidates.push(normalizedRequest);
      } else if (!normalizedRequest.includes("/")) {
        candidates.push(`.github/workflows/${normalizedRequest}`);
      } else {
        return this.paths.fail(
          ToolId.readWorkflow,
          ToolErrorCode.PATH_FORBIDDEN,
          `Path fora da whitelist: ${requested}`,
          { path: requested },
        );
      }

      for (const normalized of candidates) {
        if (!isWhitelistedRelativePath(normalized)) {
          return this.paths.fail(
            ToolId.readWorkflow,
            ToolErrorCode.PATH_FORBIDDEN,
            `Path fora da whitelist: ${normalized}`,
            { path: normalized },
          );
        }
        const abs = await this.paths.toAbsolute(
          ToolId.readWorkflow,
          normalized,
        );
        if (!abs.ok) {
          return abs;
        }
        const stat = await this.fs.stat(abs.data);
        if (!stat || !stat.isFile) {
          continue;
        }
        const content = await this.fs.readFile(abs.data);
        return toolOk({
          repository: `local:${this.workspaceId}`,
          id: basenameOf(normalized),
          name: basenameOf(normalized),
          path: normalized,
          state: null,
          status: null,
          lastRunAt: null,
          branch: null,
          conclusion: null,
          content,
          lastModified: new Date(stat.mtimeMs).toISOString(),
        } satisfies WorkflowInfo);
      }

      return this.paths.fail(
        ToolId.readWorkflow,
        ToolErrorCode.NOT_FOUND,
        `Workflow nao encontrado: ${requested}`,
      );
    });
  }

  async readLogs(input: ReadLogsInput): Promise<ToolResult<ReadLogsResult>> {
    return this.guard(ToolId.readLogs, async () => {
      const source = input.source.trim();
      if (!source) {
        return this.paths.fail(
          ToolId.readLogs,
          ToolErrorCode.INVALID_INPUT,
          "source obrigatorio",
        );
      }

      const limit = clampLimit(input.limit);

      if (JOURNAL_SOURCES.has(source.toLowerCase())) {
        const entries = await this.logs.readJournal({
          unit: source,
          limit,
          since: input.since,
        });
        return toolOk({ source, entries: entries.slice(-limit) });
      }

      const normalized = normalizeRelativePath(source);
      if (!normalized) {
        return this.paths.fail(
          ToolId.readLogs,
          ToolErrorCode.PATH_FORBIDDEN,
          `Path de log invalido: ${source}`,
          { path: source },
        );
      }
      if (
        !normalized.endsWith(".log") ||
        !isWhitelistedRelativePath(normalized)
      ) {
        return this.paths.fail(
          ToolId.readLogs,
          ToolErrorCode.PATH_FORBIDDEN,
          `Path fora da whitelist de logs: ${source}`,
          { path: source },
        );
      }

      const abs = await this.paths.toAbsolute(ToolId.readLogs, normalized);
      if (!abs.ok) {
        return abs;
      }
      const stat = await this.fs.stat(abs.data);
      if (!stat || !stat.isFile) {
        return this.paths.fail(
          ToolId.readLogs,
          ToolErrorCode.NOT_FOUND,
          `Log nao encontrado: ${normalized}`,
        );
      }

      const entries = await this.logs.readLogFile(abs.data, limit);
      return toolOk({
        source: normalized,
        entries: entries.slice(-limit),
      });
    });
  }

  async listInfrastructure(
    input: ListInfrastructureInput = {},
  ): Promise<ToolResult<InfrastructureInventory>> {
    return this.guard(ToolId.listInfrastructure, async () => {
      const root = await this.paths.resolveRoot();
      if (!root) {
        return this.paths.fail(
          ToolId.listInfrastructure,
          ToolErrorCode.NOT_FOUND,
          `Workspace sem root de infraestrutura: ${this.workspaceId}`,
        );
      }

      let startRelative = "";
      if (input.pathPrefix && input.pathPrefix.trim()) {
        const normalized = normalizeRelativePath(input.pathPrefix);
        if (!normalized || !isWhitelistedRelativePath(normalized)) {
          return this.paths.fail(
            ToolId.listInfrastructure,
            ToolErrorCode.PATH_FORBIDDEN,
            `pathPrefix fora da whitelist: ${input.pathPrefix}`,
          );
        }
        startRelative = normalized;
      }

      const found = {
        dockerfiles: [] as string[],
        dockerComposes: [] as string[],
        workflows: [] as string[],
        caddyfiles: [] as string[],
      };

      await walkInfrastructureInventory({
        fs: this.fs,
        workspaceRoot: root,
        relativeDir: startRelative,
        depth: 0,
        found,
      });

      found.dockerfiles.sort();
      found.dockerComposes.sort();
      found.workflows.sort();
      found.caddyfiles.sort();

      return toolOk({
        workspaceId: this.workspaceId,
        dockerfiles: found.dockerfiles,
        dockerComposes: found.dockerComposes,
        workflows: found.workflows,
        caddyfiles: found.caddyfiles,
      });
    });
  }

  private async guard<T>(
    toolId: ToolIdType,
    run: () => Promise<ToolResult<T>>,
  ): Promise<ToolResult<T>> {
    try {
      return await run();
    } catch (error) {
      return this.paths.fail(
        toolId,
        ToolErrorCode.UNKNOWN,
        error instanceof Error ? error.message : "Erro desconhecido",
      );
    }
  }
}

export function createLocalInfrastructureToolPorts(
  options: LocalInfrastructureAdapterOptions,
): ToolPorts {
  return new LocalInfrastructureAdapter(options).asToolPorts();
}
