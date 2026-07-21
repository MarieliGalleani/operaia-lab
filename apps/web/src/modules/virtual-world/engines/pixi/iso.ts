/**
 * Utilitarios de RENDER iso (poligonos + paleta) — puros (sem PixiJS, sem negocio).
 *
 * A PROJECAO (tile → mundo) vive em `core/geometry/iso` porque define o espaco
 * de coordenadas da camera; aqui apenas reexportamos e adicionamos os helpers de
 * desenho (losango/area) e a paleta usados pelo renderer.
 */

import type { TileRect } from "../../contracts/ids";
import { tileCorner, tileToWorld, type WorldPoint } from "../../core/geometry/iso";

export type ScreenPoint = WorldPoint;

/** Centro visual do losango do tile (col,row). */
export const tileCenter = tileToWorld;
export { tileCorner };

/** Pontos (flat) do losango de um tile, para `Graphics.poly`. */
export function tileDiamond(
  col: number,
  row: number,
  tileW: number,
  tileH: number,
): number[] {
  const { x, y } = tileCorner(col, row, tileW, tileH);
  return [x, y, x + tileW / 2, y + tileH / 2, x, y + tileH, x - tileW / 2, y + tileH / 2];
}

/** Poligono (flat) que cobre um retangulo de tiles em iso, para `Graphics.poly`. */
export function areaPolygon(rect: TileRect, tileW: number, tileH: number): number[] {
  const a = tileCorner(rect.col, rect.row, tileW, tileH);
  const b = tileCorner(rect.col + rect.w, rect.row, tileW, tileH);
  const c = tileCorner(rect.col + rect.w, rect.row + rect.h, tileW, tileH);
  const d = tileCorner(rect.col, rect.row + rect.h, tileW, tileH);
  return [a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y];
}

/** Profundidade (depth-sort) de um tile: mais "ao fundo" = menor. */
export function depthOf(col: number, row: number): number {
  return col + row;
}

/** Paleta generica (nao tematica). Cores derivadas de forma deterministica. */
const AREA_PALETTE: readonly number[] = [
  0x3b82f6, 0x8b5cf6, 0x10b981, 0xf59e0b, 0xef4444, 0x06b6d4, 0xec4899, 0x84cc16,
];

/** Cor estavel a partir de uma string (para diferenciar areas sem conhecer o dominio). */
export function colorFromString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return AREA_PALETTE[hash % AREA_PALETTE.length] as number;
}
