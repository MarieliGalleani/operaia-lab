import { BRAND } from "../config/office-config";
import type { Tile } from "../types";
import { box, poly, shade } from "./primitives";
import { tileToWorld, type View } from "./projection";

export interface DeskStyle {
  accent: string;
  monitorOn: boolean;
}

/**
 * Estação de trabalho de um funcionário: cadeira, mesa e monitor.
 * O monitor "acende" (tela clara + brilho) quando o funcionário está produzindo.
 * Desenhada no tile da mesa; o avatar (DOM) fica logo à frente, como sentado.
 */
export function drawDesk(
  ctx: CanvasRenderingContext2D,
  view: View,
  desk: Tile,
  style: DeskStyle,
): void {
  const c = tileToWorld(desk.col, desk.row);

  // cadeira (atrás)
  box(ctx, view, c.x, c.y - 12, 8, 4, 12, shade(BRAND.primary, -0.1));

  // tampo da mesa
  const top = box(ctx, view, c.x, c.y + 8, 22, 11, 18, BRAND.deskTop);

  // pé/gaveteiro
  box(ctx, view, c.x + 12, c.y + 12, 6, 3, 16, BRAND.deskLeg);

  // monitor sobre a mesa
  const screenBase = { x: top.top.x - 2, y: top.top.y + 3 };
  const stand = box(ctx, view, screenBase.x, screenBase.y, 3, 2, 6, "#334155");
  const screenColor = style.monitorOn ? "#dbeafe" : "#1e293b";
  const frame = box(ctx, view, stand.top.x, stand.top.y, 9, 2, 11, "#0f172a");
  // face frontal da tela (levemente destacada)
  const s = frame.top;
  poly(
    ctx,
    view,
    [
      { x: s.x - 8, y: s.y + 1 },
      { x: s.x + 8, y: s.y + 1 },
      { x: s.x + 8, y: s.y + 9 },
      { x: s.x - 8, y: s.y + 9 },
    ],
    screenColor,
  );
  if (style.monitorOn) {
    poly(
      ctx,
      view,
      [
        { x: s.x - 6, y: s.y + 2.5 },
        { x: s.x + 2, y: s.y + 2.5 },
        { x: s.x + 2, y: s.y + 4 },
        { x: s.x - 6, y: s.y + 4 },
      ],
      style.accent,
    );
  }
}
