import { createHttpClient, type HttpClient } from "./http-client";

/**
 * Espelha OfficeStatusResponse de apps/api/src/modules/office/build-office-status.ts.
 * GET /office/status e andar-agnostico (agrega o escritorio inteiro) —
 * nao existe endpoint por floor. A UI mostra isso honestamente.
 */
export interface OfficeStatusDto {
  readonly generatedAt: string;
  readonly windowHours: number;
  readonly status: {
    readonly level: "OPERATING" | "ATTENTION" | "PROBLEM";
    readonly label: string;
    readonly summary: string;
    readonly reasons: readonly string[];
    readonly healthOk: boolean;
    readonly readyOk: boolean;
    readonly supervisor: {
      readonly running: boolean;
      readonly cycle: number;
      readonly lastSnapshotAt: string | null;
      readonly uptimeMs: number;
    };
    readonly workers: {
      readonly alive: number;
      readonly expected: number;
      readonly busy: number;
      readonly available: number;
    };
    readonly queue: {
      readonly queued: number;
      readonly running: number;
      readonly waiting: number;
      readonly failedHistorical: number;
    };
    readonly uptimeMs: number | null;
  };
  readonly activity: {
    readonly idle: boolean;
    readonly message: string;
    readonly missionsRunning: number;
    readonly missionsQueued: number;
    readonly missionsWaiting: number;
    readonly workersBusy: number;
    readonly workersAvailable: number;
    readonly runningObjectives: readonly { id: string; objective: string }[];
  };
  readonly attention: {
    readonly items: readonly {
      readonly severity: "blocker" | "critical" | "warning" | "info";
      readonly code: string;
      readonly title: string;
      readonly detail: string;
    }[];
    readonly failed: {
      readonly historicalTotal: number;
      readonly newInWindow: number;
      readonly note: string;
    };
  };
  readonly governance: {
    readonly gate: {
      readonly windowHours: number;
      readonly execute: number;
      readonly skip: number;
      readonly reuse: number;
      readonly reopen: number;
      readonly recent: readonly {
        readonly decision: string;
        readonly reason: string;
        readonly source: string;
        readonly createdAt: string;
      }[];
    };
    readonly policy: {
      readonly deferInWindow: number;
      readonly ignoreInWindow: number;
      readonly convertCandidateInWindow: number;
      readonly note: string;
    };
  };
  readonly completed: {
    readonly items: readonly {
      readonly id: string;
      readonly title: string;
      readonly finishedAt: string | null;
      readonly kind: string;
    }[];
    readonly emptyMessage: string;
  };
  readonly humanAction: {
    readonly needed: boolean;
    readonly message: string;
    readonly proposals: readonly {
      readonly id: string;
      readonly title: string;
      readonly status: string;
      readonly createdAt: string;
    }[];
  };
  readonly sources: Record<string, "ok" | "error">;
  readonly degradations: readonly string[];
}

export interface OfficeStatusClient {
  get(): Promise<OfficeStatusDto>;
}

export function createOfficeStatusClient(
  client: HttpClient = createHttpClient(),
): OfficeStatusClient {
  return {
    async get(): Promise<OfficeStatusDto> {
      return client.get<OfficeStatusDto>("/office/status");
    },
  };
}
