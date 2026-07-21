/**
 * Presenca / multiplayer.
 *
 * Modelo preparado para varios atores simultaneos em qualquer mapa.
 */

import type { ActorKind } from "./components";
import type { TileCoord, Unsubscribe } from "./ids";

export interface PresenceActor {
  readonly id: string;
  readonly displayName: string;
  readonly kind: ActorKind;
  /** true para o ator controlado localmente por este cliente. */
  readonly local: boolean;
  readonly color?: string;
  readonly tile?: TileCoord;
}

export type PresenceEvent =
  | { readonly type: "join"; readonly actor: PresenceActor }
  | { readonly type: "leave"; readonly actorId: string }
  | { readonly type: "move"; readonly actorId: string; readonly tile: TileCoord };

export interface PresenceProvider {
  getLocalActor(): PresenceActor;
  listActors(scopeId: string): Promise<readonly PresenceActor[]>;
  subscribe?(handler: (event: PresenceEvent) => void): Unsubscribe;
  move?(tile: TileCoord): void;
}
