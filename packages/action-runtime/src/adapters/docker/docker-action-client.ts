/**
 * Porta Docker injetavel — sem child_process / docker exec generico.
 */
export interface DockerServiceStatus {
  readonly name: string;
  readonly state: string;
  readonly health: string | null;
}

export interface DockerLogEntry {
  readonly timestamp: string | null;
  readonly message: string;
}

export interface DockerActionClient {
  status(input: {
    readonly workspaceId: string;
    readonly target: string;
  }): Promise<DockerServiceStatus>;

  logs(input: {
    readonly workspaceId: string;
    readonly target: string;
    readonly limit?: number;
  }): Promise<readonly DockerLogEntry[]>;

  /**
   * Restart apenas do target explicitamente identificado (sem shell livre).
   */
  restart(input: {
    readonly workspaceId: string;
    readonly target: string;
  }): Promise<{ readonly restarted: boolean; readonly message: string }>;
}

export class MemoryDockerActionClient implements DockerActionClient {
  private readonly states = new Map<string, DockerServiceStatus>();
  private readonly logEntries = new Map<string, DockerLogEntry[]>();
  readonly restartCalls: string[] = [];

  seedStatus(workspaceId: string, status: DockerServiceStatus): void {
    this.states.set(key(workspaceId, status.name), status);
  }

  seedLogs(
    workspaceId: string,
    target: string,
    entries: readonly DockerLogEntry[],
  ): void {
    this.logEntries.set(key(workspaceId, target), [...entries]);
  }

  async status(input: {
    readonly workspaceId: string;
    readonly target: string;
  }): Promise<DockerServiceStatus> {
    const found = this.states.get(key(input.workspaceId, input.target));
    if (!found) {
      throw new Error(`Docker service nao encontrado: ${input.target}`);
    }
    return found;
  }

  async logs(input: {
    readonly workspaceId: string;
    readonly target: string;
    readonly limit?: number;
  }): Promise<readonly DockerLogEntry[]> {
    const entries =
      this.logEntries.get(key(input.workspaceId, input.target)) ?? [];
    const limit =
      input.limit && input.limit > 0 ? Math.min(input.limit, 500) : 100;
    return entries.slice(-limit);
  }

  async restart(input: {
    readonly workspaceId: string;
    readonly target: string;
  }): Promise<{ readonly restarted: boolean; readonly message: string }> {
    this.restartCalls.push(`${input.workspaceId}:${input.target}`);
    const current = this.states.get(key(input.workspaceId, input.target));
    if (!current) {
      throw new Error(`Docker service nao encontrado: ${input.target}`);
    }
    this.states.set(key(input.workspaceId, input.target), {
      ...current,
      state: "running",
    });
    return {
      restarted: true,
      message: `Restart solicitado para ${input.target}`,
    };
  }
}

function key(workspaceId: string, target: string): string {
  return `${workspaceId}::${target}`;
}
