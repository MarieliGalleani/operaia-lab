import { BRAND, GRID, ROOMS } from "../config/office-config";
import { isMonitorOn } from "../engine/animation-controller";
import type { OfficeEmployee, RoomDef } from "../types";
import { drawDesk } from "./draw-desk";
import { box, poly, shade, tile } from "./primitives";
import {
  type Point,
  tileToWorld,
  type View,
  worldToScreen,
} from "./projection";

const ACCENTS = ["#4f46e5", "#0ea5e9", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316"];

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

function accentFor(id: string): string {
  return ACCENTS[hash(id) % ACCENTS.length]!;
}

function rug(ctx: CanvasRenderingContext2D, view: View, room: RoomDef, color: string): void {
  for (let r = room.row + 1; r < room.row + room.h - 1; r += 1) {
    for (let c = room.col + 1; c < room.col + room.w - 1; c += 1) {
      tile(ctx, view, c, r, color, 3);
    }
  }
}

function roomZone(ctx: CanvasRenderingContext2D, view: View, room: RoomDef): void {
  for (let r = room.row; r < room.row + room.h; r += 1) {
    for (let c = room.col; c < room.col + room.w; c += 1) {
      tile(ctx, view, c, r, room.tint);
    }
  }
  const tl = tileToWorld(room.col - 0.5, room.row - 0.5);
  const tr = tileToWorld(room.col + room.w - 0.5, room.row - 0.5);
  const br = tileToWorld(room.col + room.w - 0.5, room.row + room.h - 0.5);
  const bl = tileToWorld(room.col - 0.5, room.row + room.h - 0.5);
  poly(ctx, view, [tl, tr, br, bl], "rgba(0,0,0,0)", shade(room.tint, -0.32));
}

function text(
  ctx: CanvasRenderingContext2D,
  p: Point,
  value: string,
  size: number,
  color: string,
  weight = 600,
): void {
  ctx.save();
  ctx.font = `${weight} ${Math.round(size)}px "Inter", "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(value, p.x, p.y);
  ctx.restore();
}

function furniture(ctx: CanvasRenderingContext2D, view: View, room: RoomDef): void {
  const cx = room.col + room.w / 2 - 0.5;
  const cy = room.row + room.h / 2 - 0.5;
  const center = tileToWorld(cx, cy);

  if (room.kind === "reception") {
    const w = tileToWorld(cx, room.row + room.h - 1.5);
    box(ctx, view, w.x, w.y, 34, 17, 20, shade(BRAND.primary, 0.1));
    const sign = worldToScreen(center.x, tileToWorld(cx, room.row).y - 10, view);
    text(ctx, sign, "OperaIA.lab", 15 * Math.max(view.scale, 0.8), BRAND.ink, 800);
    return;
  }
  if (room.kind === "meeting") {
    box(ctx, view, center.x, center.y, 30, 15, 12, "#a78bfa");
    for (const [dc, dr] of [[-1.4, 0], [1.4, 0], [0, -1], [0, 1]] as const) {
      const w = tileToWorld(cx + dc, cy + dr);
      box(ctx, view, w.x, w.y, 6, 3, 12, "#7c3aed");
    }
    return;
  }
  if (room.kind === "library") {
    for (let i = 0; i < 3; i += 1) {
      const w = tileToWorld(room.col + 1 + i * 1.6, room.row + 0.6);
      box(ctx, view, w.x, w.y, 10, 5, 30, ACCENTS[i % ACCENTS.length]!);
    }
    return;
  }
  if (room.kind === "lounge") {
    const sofa = tileToWorld(cx - 0.6, cy);
    box(ctx, view, sofa.x, sofa.y, 24, 12, 14, "#f87171");
    const table = tileToWorld(cx + 1, cy);
    box(ctx, view, table.x, table.y, 9, 5, 8, "#fbbf24");
    const plant = tileToWorld(room.col + room.w - 1.4, room.row + 0.6);
    box(ctx, view, plant.x, plant.y, 6, 3, 20, "#16a34a");
    return;
  }
}

function label(ctx: CanvasRenderingContext2D, view: View, room: RoomDef): void {
  const w = tileToWorld(room.col + room.w / 2 - 0.5, room.row - 0.4);
  const s = worldToScreen(w.x, w.y, view);
  text(ctx, s, `${room.emoji} ${room.label}`, 12 * Math.max(view.scale, 0.72), "#475569", 700);
}

/** Escritório estático + estações. Redesenhado quando os estados mudam. */
export function drawOffice(
  ctx: CanvasRenderingContext2D,
  view: View,
  employees: readonly OfficeEmployee[],
): void {
  // piso com acento diagonal (identidade)
  for (let r = 0; r < GRID.rows; r += 1) {
    for (let c = 0; c < GRID.cols; c += 1) {
      const base = (c + r) % 2 === 0 ? BRAND.floorA : BRAND.floorB;
      tile(ctx, view, c, r, (c + r) % 7 === 0 ? BRAND.floorAccent : base);
    }
  }

  for (const room of ROOMS) {
    roomZone(ctx, view, room);
  }
  // tapetes de identidade
  const exec = ROOMS.find((room) => room.kind === "executive");
  if (exec) {
    rug(ctx, view, exec, BRAND.primarySoft);
  }

  for (const room of ROOMS) {
    furniture(ctx, view, room);
  }

  // estações de trabalho por funcionário (ordenadas por profundidade)
  const desks = employees
    .filter((employee) => employee.hired)
    .slice()
    .sort((a, b) => a.homeTile.col + a.homeTile.row - (b.homeTile.col + b.homeTile.row));
  for (const employee of desks) {
    drawDesk(ctx, view, employee.homeTile, {
      accent: accentFor(employee.id),
      monitorOn: isMonitorOn(employee.state, employee.moving),
    });
  }

  for (const room of ROOMS) {
    label(ctx, view, room);
  }
}
