import type { OperationalSnapshot } from "../types.js";
import type { SnapshotStorePort } from "../ports.js";

/** Store in-memory de snapshots (testes e runtime sem backend dedicado). */
export class InMemorySnapshotStore implements SnapshotStorePort {
  private readonly items: OperationalSnapshot[] = [];

  async save(snapshot: OperationalSnapshot): Promise<void> {
    this.items.unshift(snapshot);
    if (this.items.length > 100) {
      this.items.length = 100;
    }
  }

  async latest(): Promise<OperationalSnapshot | null> {
    return this.items[0] ?? null;
  }

  async list(limit = 20): Promise<readonly OperationalSnapshot[]> {
    return this.items.slice(0, limit);
  }
}
