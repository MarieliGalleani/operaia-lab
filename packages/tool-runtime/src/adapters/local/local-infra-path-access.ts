/**
 * Acesso seguro a arquivos sob o root do workspace (whitelist + isolamento).
 */
import { ToolErrorCode, toolError, type ToolError } from "../../result.js";
import { toolFail, toolOk, type ToolResult } from "../../tool-result.js";
import type { ToolId as ToolIdType } from "../../tool-id.js";
import type { InfrastructureFileSystem } from "./infrastructure-fs.js";
import {
  basenameOf,
  isWhitelistedRelativePath,
  normalizeRelativePath,
} from "./path-whitelist.js";
import type { WorkspaceInfrastructureResolver } from "./workspace-infra-resolver.js";

export class LocalInfraPathAccess {
  constructor(
    private readonly workspaceId: string,
    private readonly resolver: WorkspaceInfrastructureResolver,
    private readonly fs: InfrastructureFileSystem,
    private readonly employeeId?: string,
  ) {}

  async resolveExistingRelative(
    toolId: ToolIdType,
    requested: string | undefined,
    defaults: readonly string[],
    nameOk: (name: string) => boolean,
  ): Promise<ToolResult<string>> {
    const candidates = requested?.trim()
      ? [requested.trim()]
      : [...defaults];

    for (const candidate of candidates) {
      const normalized = normalizeRelativePath(candidate);
      if (!normalized) {
        return this.fail(
          toolId,
          ToolErrorCode.PATH_FORBIDDEN,
          `Path invalido: ${candidate}`,
          { path: candidate },
        );
      }
      if (!nameOk(basenameOf(normalized))) {
        return this.fail(
          toolId,
          ToolErrorCode.PATH_FORBIDDEN,
          `Path fora da whitelist: ${candidate}`,
          { path: candidate },
        );
      }
      if (!isWhitelistedRelativePath(normalized)) {
        return this.fail(
          toolId,
          ToolErrorCode.PATH_FORBIDDEN,
          `Path fora da whitelist: ${candidate}`,
          { path: candidate },
        );
      }

      const abs = await this.toAbsolute(toolId, normalized);
      if (!abs.ok) {
        return abs;
      }
      const stat = await this.fs.stat(abs.data);
      if (stat?.isFile) {
        return toolOk(normalized);
      }
      if (requested?.trim()) {
        return this.fail(
          toolId,
          ToolErrorCode.NOT_FOUND,
          `Arquivo nao encontrado: ${normalized}`,
        );
      }
    }

    return this.fail(
      toolId,
      ToolErrorCode.NOT_FOUND,
      "Nenhum arquivo correspondente encontrado no workspace",
    );
  }

  async readTextFile<T>(
    toolId: ToolIdType,
    relative: string,
    map: (content: string, path: string, lastModified: string | null) => T,
  ): Promise<ToolResult<T>> {
    const abs = await this.toAbsolute(toolId, relative);
    if (!abs.ok) {
      return abs;
    }
    try {
      const [content, stat] = await Promise.all([
        this.fs.readFile(abs.data),
        this.fs.stat(abs.data),
      ]);
      const lastModified =
        stat && Number.isFinite(stat.mtimeMs)
          ? new Date(stat.mtimeMs).toISOString()
          : null;
      return toolOk(map(content, relative, lastModified));
    } catch (error) {
      return this.fail(
        toolId,
        ToolErrorCode.IO_ERROR,
        error instanceof Error ? error.message : "Falha de I/O",
      );
    }
  }

  async toAbsolute(
    toolId: ToolIdType,
    relative: string,
  ): Promise<ToolResult<string>> {
    const root = await this.resolver.resolveRoot(this.workspaceId);
    if (!root) {
      return this.fail(
        toolId,
        ToolErrorCode.NOT_FOUND,
        `Workspace sem root de infraestrutura: ${this.workspaceId}`,
      );
    }
    return toolOk(`${root}/${relative}`);
  }

  async resolveRoot(): Promise<string | null> {
    return this.resolver.resolveRoot(this.workspaceId);
  }

  fail<T = never>(
    toolId: ToolIdType,
    code: ToolError["code"],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): ToolResult<T> {
    return toolFail(
      toolError({
        code,
        message,
        toolId,
        employeeId: this.employeeId,
        details,
      }),
    );
  }
}
