/**
 * Anti-sobreposição de plaquinhas de nome (puro, sem PixiJS).
 *
 * Cada plaquinha tem um retângulo em coordenadas de mundo. Os atores mais à
 * frente (maior `y`) mantêm a posição; os de trás sobem em passos de altura
 * da plaquinha até não colidirem com nenhuma já posicionada.
 */

export interface PlateRect {
  readonly id: string;
  /** Centro horizontal da plaquinha (mundo). */
  readonly x: number;
  /** Base da plaquinha (mundo, antes do deslocamento). */
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

const GAP = 2;
const MAX_STEPS = 6;

function overlaps(a: PlateRect, aDy: number, b: PlateRect, bDy: number): boolean {
  const aTop = a.bottom + aDy - a.height;
  const bTop = b.bottom + bDy - b.height;
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 &&
    aTop < b.bottom + bDy + GAP &&
    bTop < a.bottom + aDy + GAP
  );
}

/** Retorna o deslocamento vertical (≤ 0) de cada plaquinha, por id. */
export function declutterPlates(plates: readonly PlateRect[]): Map<string, number> {
  const offsets = new Map<string, number>();
  const placed: PlateRect[] = [];
  const ordered = [...plates].sort((a, b) => b.bottom - a.bottom || a.id.localeCompare(b.id));

  for (const plate of ordered) {
    let dy = 0;
    for (let step = 0; step < MAX_STEPS; step++) {
      const hit = placed.some((other) => overlaps(plate, dy, other, offsets.get(other.id) ?? 0));
      if (!hit) {
        break;
      }
      dy -= plate.height + GAP;
    }
    offsets.set(plate.id, dy);
    placed.push(plate);
  }
  return offsets;
}
