/**
 * Porta systemd injetavel — apenas status (sem systemctl restart generico aqui).
 */
export interface SystemdUnitStatus {
  readonly unit: string;
  readonly activeState: string;
  readonly subState: string;
  readonly loadState: string;
}

export interface SystemdActionClient {
  status(input: {
    readonly workspaceId: string;
    readonly target: string;
  }): Promise<SystemdUnitStatus>;
}

export class MemorySystemdActionClient implements SystemdActionClient {
  private readonly units = new Map<string, SystemdUnitStatus>();

  seed(workspaceId: string, status: SystemdUnitStatus): void {
    this.units.set(`${workspaceId}::${status.unit}`, status);
  }

  async status(input: {
    readonly workspaceId: string;
    readonly target: string;
  }): Promise<SystemdUnitStatus> {
    const found = this.units.get(`${input.workspaceId}::${input.target}`);
    if (!found) {
      throw new Error(`Unit systemd nao encontrada: ${input.target}`);
    }
    return found;
  }
}
