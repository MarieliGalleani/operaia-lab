import {
  type Point,
  TILE_H,
  TILE_W,
  tileToWorld,
  type View,
  worldToScreen,
} from "./projection";

/** Clareia (amt>0) ou escurece (amt<0) uma cor hex. */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const f = (v: number): number =>
    amt >= 0 ? Math.round(v + (255 - v) * amt) : Math.round(v * (1 + amt));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export function poly(
  ctx: CanvasRenderingContext2D,
  view: View,
  points: Point[],
  fill: string,
  stroke?: string,
): void {
  ctx.beginPath();
  points.forEach((p, i) => {
    const s = worldToScreen(p.x, p.y, view);
    if (i === 0) {
      ctx.moveTo(s.x, s.y);
    } else {
      ctx.lineTo(s.x, s.y);
    }
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** Losango de um tile (col,row). */
export function tile(
  ctx: CanvasRenderingContext2D,
  view: View,
  col: number,
  row: number,
  fill: string,
  inset = 0,
): void {
  const c = tileToWorld(col, row);
  const hw = TILE_W / 2 - inset;
  const hh = TILE_H / 2 - inset / 2;
  poly(
    ctx,
    view,
    [
      { x: c.x, y: c.y - hh },
      { x: c.x + hw, y: c.y },
      { x: c.x, y: c.y + hh },
      { x: c.x - hw, y: c.y },
    ],
    fill,
  );
}

/** Caixa isométrica centrada num ponto de mundo; `lift` empilha sobre outra. */
export function box(
  ctx: CanvasRenderingContext2D,
  view: View,
  wx: number,
  wy: number,
  hw: number,
  hh: number,
  height: number,
  base: string,
  lift = 0,
): { top: Point; screenTop: Point } {
  const y = wy - lift;
  const b = {
    top: { x: wx, y: y - hh },
    right: { x: wx + hw, y },
    bottom: { x: wx, y: y + hh },
    left: { x: wx - hw, y },
  };
  const up = (p: Point): Point => ({ x: p.x, y: p.y - height });
  poly(ctx, view, [b.left, b.bottom, up(b.bottom), up(b.left)], shade(base, -0.24));
  poly(ctx, view, [b.bottom, b.right, up(b.right), up(b.bottom)], base);
  poly(ctx, view, [up(b.top), up(b.right), up(b.bottom), up(b.left)], shade(base, 0.16));
  const topCenter = { x: wx, y: y - height };
  return { top: topCenter, screenTop: worldToScreen(topCenter.x, topCenter.y, view) };
}
