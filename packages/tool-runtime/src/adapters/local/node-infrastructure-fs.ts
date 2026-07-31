/**
 * FS Node (somente leitura) — usado no composition root da API.
 * Testes do package NAO devem importar este modulo.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import type {
  InfrastructureDirEntry,
  InfrastructureFileSystem,
  InfrastructureStat,
} from "./infrastructure-fs.js";

export class NodeInfrastructureFileSystem implements InfrastructureFileSystem {
  async readFile(absolutePath: string): Promise<string> {
    return readFile(absolutePath, "utf8");
  }

  async readdir(
    absolutePath: string,
  ): Promise<readonly InfrastructureDirEntry[]> {
    const entries = await readdir(absolutePath, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      isFile: entry.isFile(),
      isDirectory: entry.isDirectory(),
    }));
  }

  async stat(absolutePath: string): Promise<InfrastructureStat | null> {
    try {
      const info = await stat(absolutePath);
      return {
        mtimeMs: info.mtimeMs,
        isFile: info.isFile(),
        isDirectory: info.isDirectory(),
      };
    } catch {
      return null;
    }
  }
}
