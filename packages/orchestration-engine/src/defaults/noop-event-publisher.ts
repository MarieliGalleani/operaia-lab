import type { EventPublisher } from "../ports/event-publisher.js";

/** Publicador que descarta eventos. Default seguro quando nao ha consumidores. */
export class NoopEventPublisher implements EventPublisher {
  publish(): void {}
}
