/** Projeção isométrica 2:1 do Interactive Office (câmera fixa, fit + centro). */

export const TILE_W = 50;
export const TILE_H = 25;
/** Margem superior extra para caber a altura dos avatares. */
const TOP_MARGIN = 52;

export interface Point {
  x: number;
  y: number;
}

export interface View {
  scale: number;
  ox: number;
  oy: number;
}

/** Tile (col,row) fracionário -> ponto de mundo (px, sem escala). */
export function tileToWorld(col: number, row: number): Point {
  return { x: (col - row) * (TILE_W / 2), y: (col + row) * (TILE_H / 2) };
}

export function worldToScreen(x: number, y: number, view: View): Point {
  return { x: x * view.scale + view.ox, y: y * view.scale + view.oy };
}

/** Conveniência: tile -> tela. */
export function tileToScreen(col: number, row: number, view: View): Point {
  const w = tileToWorld(col, row);
  return worldToScreen(w.x, w.y, view);
}

export function computeView(
  cols: number,
  rows: number,
  cssWidth: number,
  cssHeight: number,
  padding = 40,
): View {
  const minX = -((rows - 1) * (TILE_W / 2)) - TILE_W / 2;
  const maxX = (cols - 1) * (TILE_W / 2) + TILE_W / 2;
  const minY = -TILE_H / 2 - TOP_MARGIN;
  const maxY = (cols - 1 + rows - 1) * (TILE_H / 2) + TILE_H / 2;

  const worldW = maxX - minX;
  const worldH = maxY - minY;
  const scale = Math.min(
    (cssWidth - padding * 2) / worldW,
    (cssHeight - padding * 2) / worldH,
    1.7,
  );
  const contentW = worldW * scale;
  const contentH = worldH * scale;
  return {
    scale,
    ox: (cssWidth - contentW) / 2 - minX * scale,
    oy: (cssHeight - contentH) / 2 - minY * scale,
  };
}
