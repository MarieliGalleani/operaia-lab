import type { Timestamps, UUID } from "@operaia/shared";

/** Entidade de dominio Agent, independente de detalhes de persistencia. */
export interface Agent extends Timestamps {
  readonly id: UUID;
  readonly name: string;
  readonly role: string;
  readonly description: string | null;
  readonly systemInstructions: string;
  readonly active: boolean;
}
