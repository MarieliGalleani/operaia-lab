/**
 * Porta de filesystem para o LocalInfrastructureAdapter.
 * Testes usam MemoryInfrastructureFileSystem — nunca FS real.
 */

export interface InfrastructureStat {
  readonly mtimeMs: number;
  readonly isFile: boolean;
  readonly isDirectory: boolean;
}

export interface InfrastructureDirEntry {
  readonly name: string;
  readonly isFile: boolean;
  readonly isDirectory: boolean;
}

export interface InfrastructureFileSystem {
  readFile(absolutePath: string): Promise<string>;
  readdir(absolutePath: string): Promise<readonly InfrastructureDirEntry[]>;
  stat(absolutePath: string): Promise<InfrastructureStat | null>;
}

export type MemoryFsFile = {
  readonly content: string;
  readonly mtimeMs: number;
};

/**
 * Filesystem em memoria — unico FS permitido em testes.
 */
export class MemoryInfrastructureFileSystem implements InfrastructureFileSystem {
  private readonly files: Map<string, MemoryFsFile>;

  constructor(files: Readonly<Record<string, MemoryFsFile | string>> = {}) {
    this.files = new Map();
    for (const [path, value] of Object.entries(files)) {
      const key = normalizeAbs(path);
      if (typeof value === "string") {
        this.files.set(key, { content: value, mtimeMs: 0 });
      } else {
        this.files.set(key, value);
      }
    }
  }

  async readFile(absolutePath: string): Promise<string> {
    const key = normalizeAbs(absolutePath);
    const entry = this.files.get(key);
    if (!entry) {
      throw new Error(`ENOENT: ${key}`);
    }
    return entry.content;
  }

  async readdir(
    absolutePath: string,
  ): Promise<readonly InfrastructureDirEntry[]> {
    const root = normalizeAbs(absolutePath);
    const prefix = root.endsWith("/") ? root : `${root}/`;
    const names = new Map<string, InfrastructureDirEntry>();

    for (const path of this.files.keys()) {
      if (!path.startsWith(prefix)) {
        continue;
      }
      const rest = path.slice(prefix.length);
      const slash = rest.indexOf("/");
      if (slash < 0) {
        names.set(rest, { name: rest, isFile: true, isDirectory: false });
      } else {
        const dirName = rest.slice(0, slash);
        if (!names.has(dirName)) {
          names.set(dirName, {
            name: dirName,
            isFile: false,
            isDirectory: true,
          });
        }
      }
    }

    return [...names.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async stat(absolutePath: string): Promise<InfrastructureStat | null> {
    const key = normalizeAbs(absolutePath);
    const file = this.files.get(key);
    if (file) {
      return { mtimeMs: file.mtimeMs, isFile: true, isDirectory: false };
    }

    const prefix = key.endsWith("/") ? key : `${key}/`;
    for (const path of this.files.keys()) {
      if (path.startsWith(prefix)) {
        return { mtimeMs: 0, isFile: false, isDirectory: true };
      }
    }
    return null;
  }
}

function normalizeAbs(path: string): string {
  const trimmed = path.replace(/\\/g, "/").replace(/\/+/g, "/");
  if (trimmed.length > 1 && trimmed.endsWith("/")) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
}
