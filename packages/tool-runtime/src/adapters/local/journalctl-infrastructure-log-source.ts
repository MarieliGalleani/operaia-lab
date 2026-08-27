/**
 * Bridge READ-ONLY journald via journalctl.
 * Reutiliza InfrastructureLogSource — sem segundo sistema de logs.
 *
 * - Unit allowlist explicita (aliases → operaia-lab-api.service)
 * - Sem shell arbitrario / sem unit do objective
 * - Timeout + limite de entries
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { LogEntry } from "../../tools.js";
import type { InfrastructureFileSystem } from "./infrastructure-fs.js";
import {
  clampLimit,
  FileInfrastructureLogSource,
  type InfrastructureLogSource,
  type ReadJournalInput,
} from "./infrastructure-log-source.js";

const execFileAsync = promisify(execFile);

export const JOURNALCTL_BIN = "/usr/bin/journalctl";
export const DEFAULT_JOURNALCTL_TIMEOUT_MS = 5_000;

/** Aliases aceitos pelo adapter local (JOURNAL_SOURCES) → unit systemd real. */
export const JOURNAL_UNIT_ALLOWLIST: Readonly<Record<string, string>> = {
  journal: "operaia-lab-api.service",
  systemd: "operaia-lab-api.service",
  api: "operaia-lab-api.service",
  "operaia-lab-api": "operaia-lab-api.service",
  "operaia-api": "operaia-lab-api.service",
  "operaia-lab-api.service": "operaia-lab-api.service",
};

export type JournalctlExec = (
  file: string,
  args: readonly string[],
  options: { readonly timeout: number; readonly maxBuffer: number },
) => Promise<{ readonly stdout: string; readonly stderr: string }>;

export interface JournalctlInfrastructureLogSourceOptions {
  readonly timeoutMs?: number;
  readonly exec?: JournalctlExec;
}

export class JournalctlUnitNotAllowedError extends Error {
  constructor(unit: string) {
    super(`Unit de journal nao permitida: ${unit}`);
    this.name = "JournalctlUnitNotAllowedError";
  }
}

export class JournalctlExecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JournalctlExecError";
  }
}

export function resolveAllowedJournalUnit(
  requested: string | undefined,
): string | null {
  const key = (requested ?? "journal").trim().toLowerCase();
  if (!key) {
    return null;
  }
  return JOURNAL_UNIT_ALLOWLIST[key] ?? null;
}

function defaultExec(
  file: string,
  args: readonly string[],
  options: { readonly timeout: number; readonly maxBuffer: number },
): Promise<{ readonly stdout: string; readonly stderr: string }> {
  return execFileAsync(file, [...args], {
    timeout: options.timeout,
    maxBuffer: options.maxBuffer,
    encoding: "utf8",
  }) as Promise<{ stdout: string; stderr: string }>;
}

function priorityToLevel(priority: unknown): string | null {
  const n =
    typeof priority === "number"
      ? priority
      : typeof priority === "string"
        ? Number.parseInt(priority, 10)
        : Number.NaN;
  if (!Number.isFinite(n)) {
    return null;
  }
  if (n <= 2) return "error";
  if (n === 3) return "error";
  if (n === 4) return "warn";
  if (n <= 6) return "info";
  return "debug";
}

function timestampFromJournal(raw: Record<string, unknown>): string | null {
  const realtime = raw["__REALTIME_TIMESTAMP"];
  if (typeof realtime === "string" && /^\d+$/.test(realtime)) {
    const ms = Math.floor(Number.parseInt(realtime, 10) / 1000);
    if (Number.isFinite(ms)) {
      return new Date(ms).toISOString();
    }
  }
  const ts = raw["timestamp"];
  return typeof ts === "string" ? ts : null;
}

function messageFromJournal(raw: Record<string, unknown>): string {
  const message = raw["MESSAGE"];
  if (typeof message === "string") {
    return message;
  }
  if (Array.isArray(message)) {
    return message.map(String).join(" ");
  }
  return JSON.stringify(raw);
}

export function parseJournalctlJsonLines(
  stdout: string,
  limit: number,
): readonly LogEntry[] {
  const lines = stdout.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const entries: LogEntry[] = [];
  for (const line of lines.slice(-limit)) {
    try {
      const raw = JSON.parse(line) as Record<string, unknown>;
      entries.push({
        timestamp: timestampFromJournal(raw),
        level: priorityToLevel(raw["PRIORITY"]),
        message: messageFromJournal(raw),
      });
    } catch {
      entries.push({
        timestamp: null,
        level: null,
        message: line.slice(0, 4000),
      });
    }
  }
  return entries.slice(-limit);
}

/**
 * Le journald real (journalctl) + *.log via FileInfrastructureLogSource.
 * Falha de journalctl propaga (nao mascara com lista vazia).
 */
export class JournalctlInfrastructureLogSource
  implements InfrastructureLogSource
{
  private readonly fileSource: FileInfrastructureLogSource;
  private readonly timeoutMs: number;
  private readonly exec: JournalctlExec;

  constructor(
    fs: InfrastructureFileSystem,
    options: JournalctlInfrastructureLogSourceOptions = {},
  ) {
    this.fileSource = new FileInfrastructureLogSource(fs);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_JOURNALCTL_TIMEOUT_MS;
    this.exec = options.exec ?? defaultExec;
  }

  async readJournal(input: ReadJournalInput): Promise<readonly LogEntry[]> {
    const limit = clampLimit(input.limit);
    const unit = resolveAllowedJournalUnit(input.unit);
    if (!unit) {
      throw new JournalctlUnitNotAllowedError(String(input.unit ?? ""));
    }

    const args = [
      "-u",
      unit,
      "-n",
      String(limit),
      "-o",
      "json",
      "--no-pager",
      "-q",
    ];
    if (input.since?.trim()) {
      args.push("--since", input.since.trim());
    }

    try {
      const { stdout } = await this.exec(JOURNALCTL_BIN, args, {
        timeout: this.timeoutMs,
        maxBuffer: 2 * 1024 * 1024,
      });
      return parseJournalctlJsonLines(stdout, limit);
    } catch (error) {
      if (
        error instanceof JournalctlUnitNotAllowedError ||
        error instanceof JournalctlExecError
      ) {
        throw error;
      }
      const err = error as {
        message?: string;
        stderr?: string;
        code?: string | number;
        killed?: boolean;
      };
      if (err.killed || err.code === "ETIMEDOUT") {
        throw new JournalctlExecError(
          `journalctl timeout apos ${this.timeoutMs}ms (unit=${unit})`,
        );
      }
      const detail =
        (typeof err.stderr === "string" && err.stderr.trim()) ||
        (typeof err.message === "string" && err.message) ||
        "falha ao executar journalctl";
      throw new JournalctlExecError(
        `journalctl falhou (unit=${unit}): ${detail.slice(0, 500)}`,
      );
    }
  }

  readLogFile(
    absolutePath: string,
    limit: number,
  ): Promise<readonly LogEntry[]> {
    return this.fileSource.readLogFile(absolutePath, limit);
  }
}
