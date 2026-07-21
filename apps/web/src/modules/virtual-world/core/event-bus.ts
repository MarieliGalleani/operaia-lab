/**
 * EventBus tipado (implementacao). Fronteira unica de comunicacao por eventos.
 *
 * Camada: CORE (agnostico de framework, sem DOM). Testavel isoladamente.
 */

import type {
  EventBus,
  WorldEventHandler,
  WorldEventMap,
  WorldEventType,
} from "../contracts/events";
import type { Unsubscribe } from "../contracts/ids";

type AnyHandler = (payload: unknown) => void;

export class TypedEventBus implements EventBus {
  private readonly handlers = new Map<WorldEventType, Set<AnyHandler>>();

  on<K extends WorldEventType>(type: K, handler: WorldEventHandler<K>): Unsubscribe {
    const set = this.handlers.get(type) ?? new Set<AnyHandler>();
    set.add(handler as AnyHandler);
    this.handlers.set(type, set);
    return () => this.off(type, handler);
  }

  once<K extends WorldEventType>(type: K, handler: WorldEventHandler<K>): Unsubscribe {
    const wrapper: WorldEventHandler<K> = (payload) => {
      this.off(type, wrapper);
      handler(payload);
    };
    return this.on(type, wrapper);
  }

  off<K extends WorldEventType>(type: K, handler: WorldEventHandler<K>): void {
    const set = this.handlers.get(type);
    if (!set) {
      return;
    }
    set.delete(handler as AnyHandler);
    if (set.size === 0) {
      this.handlers.delete(type);
    }
  }

  emit<K extends WorldEventType>(type: K, payload: WorldEventMap[K]): void {
    const set = this.handlers.get(type);
    if (!set) {
      return;
    }
    for (const handler of [...set]) {
      handler(payload);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
