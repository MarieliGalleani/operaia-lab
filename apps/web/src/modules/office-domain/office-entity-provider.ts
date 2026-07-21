/**
 * EntityProvider do dominio: entrega os atores do escritorio como dados genericos.
 *
 * Aqui e onde, na Fase 1+, os agentes reais (Employee Registry/Runtime) serao
 * traduzidos para `ActorDescriptor`. Hoje: dados mock, mesma interface.
 */

import type { ActorDescriptor, EntityProvider } from "../virtual-world/contracts/providers";
import { OFFICE_ACTORS } from "./data/office-actors";

export class OfficeEntityProvider implements EntityProvider {
  async listActors(_mapId: string): Promise<readonly ActorDescriptor[]> {
    return OFFICE_ACTORS;
  }
}
