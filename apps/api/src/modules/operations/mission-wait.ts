import { MissionQueueStatus } from "../runtime/mission-states.js";

/** Visão mínima para polling de término. */
export interface MissionTerminalView {
  readonly id: string;
  readonly status: string;
}

export interface MissionTerminalLookup {
  get(id: string): Promise<MissionTerminalView | null>;
}

export interface WaitUntilTerminalOptions {
  readonly timeoutMs?: number;
  readonly pollIntervalMs?: number;
  readonly terminalStatuses?: readonly string[];
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => number;
}

export class MissionWaitTimeoutError extends Error {
  constructor(
    readonly missionId: string,
    readonly timeoutMs: number,
    readonly lastStatus: string | null,
  ) {
    super(
      `Timeout aguardando missao ${missionId} (${timeoutMs}ms); ultimo status: ${lastStatus ?? "null"}`,
    );
    this.name = "MissionWaitTimeoutError";
  }
}

export class MissionNotFoundDuringWaitError extends Error {
  constructor(readonly missionId: string) {
    super(`Missao desapareceu durante wait: ${missionId}`);
    this.name = "MissionNotFoundDuringWaitError";
  }
}

/** Worker/fila terminou em FAILED ou CANCELLED (ADR-007 Fase 2.2b). */
export class AssistedQueueMissionFailedError extends Error {
  constructor(
    readonly missionId: string,
    readonly status: string,
    readonly detail?: string,
  ) {
    super(
      detail
        ? `Missao ${missionId} terminou em ${status}: ${detail}`
        : `Missao ${missionId} terminou em ${status} sem OperationalRun`,
    );
    this.name = "AssistedQueueMissionFailedError";
  }
}

const DEFAULT_TERMINAL: readonly string[] = [
  MissionQueueStatus.COMPLETED,
  MissionQueueStatus.FAILED,
  MissionQueueStatus.CANCELLED,
];

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Poll isolado ate status terminal da fila (ADR-007 Fase 2.0).
 * Testavel via lookup/sleep/now injetaveis.
 */
export async function waitUntilTerminal(
  lookup: MissionTerminalLookup,
  missionId: string,
  options: WaitUntilTerminalOptions = {},
): Promise<MissionTerminalView> {
  const timeoutMs = options.timeoutMs ?? 180_000;
  const pollIntervalMs = options.pollIntervalMs ?? 500;
  const terminal = new Set(options.terminalStatuses ?? DEFAULT_TERMINAL);
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;

  const deadline = now() + timeoutMs;
  let lastStatus: string | null = null;

  for (;;) {
    const current = await lookup.get(missionId);
    if (!current) {
      throw new MissionNotFoundDuringWaitError(missionId);
    }
    lastStatus = current.status;
    if (terminal.has(current.status)) {
      return current;
    }
    if (now() >= deadline) {
      throw new MissionWaitTimeoutError(missionId, timeoutMs, lastStatus);
    }
    await sleep(pollIntervalMs);
  }
}
