/**
 * Projeção isométrica GENÉRICA (matemática pura, sem PixiJS, sem negócio).
 *
 * Define o espaço de coordenadas de "mundo" usado pela câmera e pelo renderer:
 * converte tiles (col,row) → pontos de mundo (x,y) na projeção 2:1 (diamante).
 * Fica em `core` porque a câmera (genérica) precisa projetar tiles sem depender
 * de nenhum engine específico.
 */

import type { MapManifest } from "../../contracts/map";
import type { WorldRect } from "../../contracts/ids";

export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

/** Canto superior do tile (col,row) em coordenadas de mundo. */
export function tileCorner(col: number, row: number, tileW: number, tileH: number): WorldPoint {
  return { x: (col - row) * (tileW / 2), y: (col + row) * (tileH / 2) };
}

/** Centro visual do losango do tile (col,row) em coordenadas de mundo. */
export function tileToWorld(col: number, row: number, tileW: number, tileH: number): WorldPoint {
  const corner = tileCorner(col, row, tileW, tileH);
  return { x: corner.x, y: corner.y + tileH / 2 };
}

/**
 * Retângulo de mundo que engloba TODOS os tiles do mapa (bounding box dos
 * cantos em projeção iso). Usado para limitar a câmera aos limites do mapa.
 */
export function computeMapWorldBounds(manifest: MapManifest): WorldRect {
  const { tileWidth: tw, tileHeight: th } = manifest;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const floor of manifest.floors) {
    const { cols, rows } = floor.size;
    const corners: WorldPoint[] = [
      tileToWorld(0, 0, tw, th),
      tileToWorld(cols - 1, 0, tw, th),
      tileToWorld(0, rows - 1, tw, th),
      tileToWorld(cols - 1, rows - 1, tw, th),
    ];
    for (const point of corners) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
