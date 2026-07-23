import type { OperationalRun } from "./operational-run.js";

/** Store em memoria das missoes assistidas (auditoria operacional). */
export class OperationalRunStore {
  private readonly runs = new Map<string, OperationalRun>();

  save(run: OperationalRun): void {
    this.runs.set(run.id, run);
  }

  get(id: string): OperationalRun | undefined {
    return this.runs.get(id);
  }

  list(): readonly OperationalRun[] {
    return [...this.runs.values()].sort((a, b) =>
      a.startedAt < b.startedAt ? 1 : -1,
    );
  }
}
