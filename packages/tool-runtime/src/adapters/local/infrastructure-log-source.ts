/**
 * Fonte de logs (journal + arquivos). Injecao obrigatoria em testes.
 * Nao expoe shell arbitrario — apenas leituras tipadas.
 */
import type { LogEntry } from "../../tools.js";
import type { InfrastructureFileSystem } from "./infrastructure-fs.js";

export const MAX_LOG_LINES = 500;

export interface ReadJournalInput {
  readonly unit?: string;
  readonly limit: number;
  readonly since?: string;
}

export interface InfrastructureLogSource {
  readJournal(input: ReadJournalInput): Promise<readonly LogEntry[]>;
  readLogFile(
    absolutePath: string,
    limit: number,
  ): Promise<readonly LogEntry[]>;
}

/**
 * Leitor de *.log via FS injetado (ultimas N linhas).
 */
export class FileInfrastructureLogSource implements InfrastructureLogSource {
  constructor(
    private readonly fs: InfrastructureFileSystem,
    private readonly journalEntries: readonly LogEntry[] = [],
  ) {}

  async readJournal(input: ReadJournalInput): Promise<readonly LogEntry[]> {
    const limit = clampLimit(input.limit);
    let entries = this.journalEntries;
    if (input.since) {
      const sinceMs = Date.parse(input.since);
      if (!Number.isNaN(sinceMs)) {
        entries = entries.filter((e) => {
          if (!e.timestamp) {
            return true;
          }
          const t = Date.parse(e.timestamp);
          return Number.isNaN(t) || t >= sinceMs;
        });
      }
    }
    return entries.slice(-limit);
  }

  async readLogFile(
    absolutePath: string,
    limit: number,
  ): Promise<readonly LogEntry[]> {
    const content = await this.fs.readFile(absolutePath);
    const lines = content.split(/\r?\n/);
    const last = lines.slice(-clampLimit(limit));
    return last
      .filter((line) => line.length > 0)
      .map((message) => ({
        timestamp: null,
        level: null,
        message,
      }));
  }
}

/**
 * Log source em memoria para testes (journal + arquivos via FS).
 */
export class MemoryInfrastructureLogSource
  extends FileInfrastructureLogSource
{
  constructor(
    fs: InfrastructureFileSystem,
    journalEntries: readonly LogEntry[] = [],
  ) {
    super(fs, journalEntries);
  }
}

export function clampLimit(limit: number | undefined): number {
  if (limit == null || !Number.isFinite(limit) || limit <= 0) {
    return MAX_LOG_LINES;
  }
  return Math.min(Math.floor(limit), MAX_LOG_LINES);
}
