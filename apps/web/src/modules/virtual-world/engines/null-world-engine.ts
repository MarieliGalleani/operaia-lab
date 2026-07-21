/**
 * Motor "nulo": implementa a porta WorldEngine SEM renderizar nada.
 *
 * Valida a arquitetura (Fase 0) e serve a testes. Prova que runtime, ECS e
 * carregamento de mapa por dados funcionam independentemente do renderer.
 * O motor PixiJS (Fase 1) implementa a MESMA interface.
 */

import type { MapManifest } from "../contracts/map";
import type { WorldEngine, WorldEngineContext } from "../contracts/world-engine";

export class NullWorldEngine implements WorldEngine {
  readonly id = "null";
  private context: WorldEngineContext | undefined;
  private lastMapId: string | undefined;

  async init(context: WorldEngineContext): Promise<void> {
    this.context = context;
  }

  async loadMap(manifest: MapManifest): Promise<void> {
    this.lastMapId = manifest.id;
  }

  resize(_width: number, _height: number): void {
    // no-op: sem viewport sem renderer.
  }

  destroy(): void {
    this.context = undefined;
    this.lastMapId = undefined;
  }

  /** Introspeccao para testes/depuracao (fora da porta). */
  debug(): { readonly initialized: boolean; readonly lastMapId: string | undefined } {
    return { initialized: this.context !== undefined, lastMapId: this.lastMapId };
  }
}
