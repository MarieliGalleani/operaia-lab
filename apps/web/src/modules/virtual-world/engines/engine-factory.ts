/**
 * Fabrica de motores graficos.
 *
 * A troca do renderer e feita AQUI, sem impacto na casca nem no runtime.
 * "null" (headless/testes) e "pixi" (renderer real) implementam a MESMA porta.
 */

import type { WorldEngine } from "../contracts/world-engine";
import { NullWorldEngine } from "./null-world-engine";
import { PixiWorldEngine } from "./pixi/pixi-world-engine";

export type WorldEngineId = "null" | "pixi";

export function createWorldEngine(id: WorldEngineId = "null"): WorldEngine {
  switch (id) {
    case "null":
      return new NullWorldEngine();
    case "pixi":
      return new PixiWorldEngine();
    default: {
      const exhaustive: never = id;
      throw new Error(`Motor desconhecido: ${String(exhaustive)}`);
    }
  }
}
