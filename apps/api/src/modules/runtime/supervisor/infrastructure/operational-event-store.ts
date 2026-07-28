import type { SupervisorEvent } from "../types.js";
import type { SupervisorLoggerPort } from "../ports.js";

export interface OperationalEventRecord {
  readonly id: string;
  readonly event: SupervisorEvent;
  readonly at: string;
  readonly data: Readonly<Record<string, unknown>>;
}

/** Persistencia de eventos operacionais do Supervisor (sem regras de negocio). */
export interface OperationalEventStorePort {
  append(
    event: SupervisorEvent,
    data?: Readonly<Record<string, unknown>>,
  ): Promise<void>;
  list(limit?: number): Promise<readonly OperationalEventRecord[]>;
}

export class InMemoryOperationalEventStore implements OperationalEventStorePort {
  private readonly items: OperationalEventRecord[] = [];
  private seq = 0;

  async append(
    event: SupervisorEvent,
    data: Readonly<Record<string, unknown>> = {},
  ): Promise<void> {
    this.seq += 1;
    this.items.unshift({
      id: `evt-${this.seq}`,
      event,
      at: new Date().toISOString(),
      data,
    });
    if (this.items.length > 500) {
      this.items.length = 500;
    }
  }

  async list(limit = 50): Promise<readonly OperationalEventRecord[]> {
    return this.items.slice(0, limit);
  }
}

/**
 * Logger que emite eventos estruturados e persiste no EventStore.
 */
export class PersistingSupervisorLogger implements SupervisorLoggerPort {
  constructor(
    private readonly store: OperationalEventStorePort,
    private readonly inner?: SupervisorLoggerPort,
  ) {}

  emit(
    event: SupervisorEvent,
    data: Readonly<Record<string, unknown>> = {},
  ): void {
    this.inner?.emit(event, data);
    void this.store.append(event, data);
  }
}
