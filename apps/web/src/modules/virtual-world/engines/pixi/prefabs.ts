/**
 * PREFABS de props isométricos (desenho vetorial genérico).
 *
 * São formas genéricas (mesa, cadeira, planta, tapete…) desenhadas a partir de
 * primitivas isométricas. A engine associa um `ref` (string de dado) a uma
 * função de desenho — sem qualquer semântica de negócio. O domínio decide QUAIS
 * refs usar e ONDE posicioná-los (via dados do mapa).
 */

import type { Graphics } from "pixi.js";

export interface PrefabCtx {
  /** Graphics já adicionado a uma layer; o prefab só desenha nele. */
  readonly g: Graphics;
  /** Centro do tile (coords de mundo). */
  readonly cx: number;
  readonly cy: number;
  /** Tamanho do tile isométrico. */
  readonly tw: number;
  readonly th: number;
}

type PrefabFn = (ctx: PrefabCtx) => void;

/** Ponto de mundo para um deslocamento (dcol,drow) tiles a partir do centro. */
function iso(ctx: PrefabCtx, dcol: number, drow: number, dy = 0): [number, number] {
  return [
    ctx.cx + (dcol - drow) * (ctx.tw / 2),
    ctx.cy + (dcol + drow) * (ctx.th / 2) - dy,
  ];
}

/** Losango plano (footprint) — para tapetes e sombras. */
function isoDiamond(ctx: PrefabCtx, halfW: number, halfD: number, dy = 0): number[] {
  return [
    ...iso(ctx, halfW, -halfD, dy),
    ...iso(ctx, halfW, halfD, dy),
    ...iso(ctx, -halfW, halfD, dy),
    ...iso(ctx, -halfW, -halfD, dy),
  ];
}

interface PrismColors {
  readonly top: number;
  readonly left: number;
  readonly right: number;
}

/**
 * Caixa isométrica (top + duas faces frontais) centrada no tile.
 * `hw`/`hd` = meia-largura/meia-profundidade em tiles; `height` em px.
 */
function isoPrism(ctx: PrefabCtx, hw: number, hd: number, height: number, colors: PrismColors, baseDy = 0): void {
  const { g } = ctx;
  const A = (dy: number): number[] => iso(ctx, hw, -hd, dy); // direita-fundo
  const B = (dy: number): number[] => iso(ctx, hw, hd, dy); // frente (mais baixo)
  const C = (dy: number): number[] => iso(ctx, -hw, hd, dy); // esquerda-frente
  const D = (dy: number): number[] => iso(ctx, -hw, -hd, dy); // fundo

  const top = baseDy + height;
  // face direita (A-B)
  g.poly([...A(baseDy), ...B(baseDy), ...B(top), ...A(top)]).fill({ color: colors.right, alpha: 1 });
  // face esquerda (B-C)
  g.poly([...B(baseDy), ...C(baseDy), ...C(top), ...B(top)]).fill({ color: colors.left, alpha: 1 });
  // topo
  g.poly([...A(top), ...B(top), ...C(top), ...D(top)]).fill({ color: colors.top, alpha: 1 });
}

// ---- Prefabs concretos ------------------------------------------------------

const WOOD: PrismColors = { top: 0xc78d52, left: 0x9c6a37, right: 0xb17c44 };
const WOOD_DARK: PrismColors = { top: 0x9c6a37, left: 0x744c26, right: 0x855a30 };
const SEAT: PrismColors = { top: 0x6f8a52, left: 0x50663a, right: 0x5f7845 };
const WHITE: PrismColors = { top: 0xf2ede2, left: 0xcfc7b6, right: 0xe0d8c6 };
const SOFA: PrismColors = { top: 0x5f88a0, left: 0x466a7d, right: 0x527a8f };
const SOFA_CUSHION: PrismColors = { top: 0x77a0b8, left: 0x5b8399, right: 0x6a92aa };
const METAL: PrismColors = { top: 0xc2c8d2, left: 0x949bab, right: 0xacb3c1 };
const DARK: PrismColors = { top: 0x2b2f42, left: 0x1c2036, right: 0x24283c };

function shadow(ctx: PrefabCtx, hw: number, hd: number): void {
  ctx.g.poly(isoDiamond(ctx, hw, hd)).fill({ color: 0x000000, alpha: 0.12 });
}

/** Deriva um contexto cujo centro está deslocado (dcol,drow) tiles. */
function offsetCtx(ctx: PrefabCtx, dcol: number, drow: number): PrefabCtx {
  const [cx, cy] = iso(ctx, dcol, drow);
  return { ...ctx, cx, cy };
}

const desk: PrefabFn = (ctx) => {
  shadow(ctx, 0.85, 0.6);
  const h = ctx.th * 0.7;
  isoPrism(ctx, 0.8, 0.5, h, WOOD);
  // laptop sobre a mesa
  isoPrism(ctx, 0.22, 0.16, ctx.th * 0.18, { top: 0x2b2f42, left: 0x1c2036, right: 0x24283c }, h);
};

const chair: PrefabFn = (ctx) => {
  shadow(ctx, 0.4, 0.4);
  const seatH = ctx.th * 0.42;
  isoPrism(ctx, 0.34, 0.34, seatH, SEAT);
  // encosto (fino, atrás)
  ctx.g
    .poly([...iso(ctx, -0.34, -0.28, seatH), ...iso(ctx, 0.34, -0.28, seatH), ...iso(ctx, 0.34, -0.28, seatH + ctx.th * 0.5), ...iso(ctx, -0.34, -0.28, seatH + ctx.th * 0.5)])
    .fill({ color: 0x50663a, alpha: 1 });
};

const bookshelf: PrefabFn = (ctx) => {
  shadow(ctx, 0.7, 0.35);
  const h = ctx.th * 1.7;
  isoPrism(ctx, 0.7, 0.28, h, WOOD_DARK);
  // livros coloridos na face frontal-esquerda
  const books = [0xb1557f, 0xd79a3c, 0x5f8a4e, 0x3f7fa3, 0x6d5bd0];
  for (let i = 0; i < 4; i += 1) {
    const y = ctx.th * (0.35 + i * 0.32);
    ctx.g
      .poly([...iso(ctx, 0.7, 0.05, y), ...iso(ctx, 0.7, 0.28, y), ...iso(ctx, 0.7, 0.28, y + ctx.th * 0.22), ...iso(ctx, 0.7, 0.05, y + ctx.th * 0.22)])
      .fill({ color: books[i % books.length], alpha: 0.95 });
  }
};

const plant: PrefabFn = (ctx) => {
  shadow(ctx, 0.32, 0.32);
  const potH = ctx.th * 0.5;
  isoPrism(ctx, 0.24, 0.24, potH, { top: 0xc98a5a, left: 0x9a6338, right: 0xb2764a });
  // folhagem: círculos verdes sobrepostos
  const [fx, fy] = iso(ctx, 0, 0, potH);
  const r = ctx.th * 0.7;
  ctx.g.circle(fx, fy - r * 0.6, r * 0.7).fill({ color: 0x4e7a3e, alpha: 1 });
  ctx.g.circle(fx - r * 0.4, fy - r * 0.3, r * 0.55).fill({ color: 0x5f8a4e, alpha: 1 });
  ctx.g.circle(fx + r * 0.4, fy - r * 0.35, r * 0.5).fill({ color: 0x6b9b4e, alpha: 1 });
  ctx.g.circle(fx, fy - r, r * 0.5).fill({ color: 0x6b9b4e, alpha: 1 });
};

const watercooler: PrefabFn = (ctx) => {
  shadow(ctx, 0.3, 0.3);
  const h = ctx.th * 0.9;
  isoPrism(ctx, 0.24, 0.24, h, WHITE);
  const [bx, by] = iso(ctx, 0, 0, h);
  ctx.g.ellipse(bx, by - ctx.th * 0.35, ctx.tw * 0.2, ctx.th * 0.32).fill({ color: 0x7fb8e6, alpha: 0.9 });
};

const rug: PrefabFn = (ctx) => {
  ctx.g.poly(isoDiamond(ctx, 1.4, 1.1)).fill({ color: 0x7e8c5a, alpha: 0.92 });
  ctx.g.poly(isoDiamond(ctx, 1.4, 1.1)).stroke({ width: 3, color: 0x66723f, alpha: 0.9 });
  ctx.g.poly(isoDiamond(ctx, 0.9, 0.7)).stroke({ width: 2, color: 0x5a4a9e, alpha: 0.6 });
  ctx.g.poly(isoDiamond(ctx, 0.28, 0.22)).fill({ color: 0x5a4a9e, alpha: 0.5 });
};

const lamp: PrefabFn = (ctx) => {
  const h = ctx.th * 0.6;
  isoPrism(ctx, 0.12, 0.12, h, { top: 0x8a6b4a, left: 0x6f553b, right: 0x7d6142 });
  const [lx, ly] = iso(ctx, 0, 0, h);
  ctx.g.circle(lx, ly - ctx.th * 0.2, ctx.th * 0.42).fill({ color: 0xffe9a8, alpha: 0.95 });
};

// Sofá aconchegante (~2 tiles): encosto alto, dois braços e almofadas.
const sofa: PrefabFn = (ctx) => {
  shadow(ctx, 1.05, 0.72);
  const seatH = ctx.th * 0.42;
  // encosto (parede traseira, desenhado primeiro = mais ao fundo)
  const backTop = seatH + ctx.th * 0.62;
  ctx.g
    .poly([...iso(ctx, -0.9, -0.5, seatH), ...iso(ctx, 0.9, -0.5, seatH), ...iso(ctx, 0.9, -0.5, backTop), ...iso(ctx, -0.9, -0.5, backTop)])
    .fill({ color: SOFA.left, alpha: 1 });
  ctx.g
    .poly([...iso(ctx, -0.9, -0.66, backTop), ...iso(ctx, 0.9, -0.66, backTop), ...iso(ctx, 0.9, -0.5, backTop), ...iso(ctx, -0.9, -0.5, backTop)])
    .fill({ color: SOFA.top, alpha: 1 });
  // base do assento
  isoPrism(ctx, 0.9, 0.5, seatH, SOFA);
  // almofadas do assento
  isoPrism(offsetCtx(ctx, -0.42, 0), 0.36, 0.42, seatH + ctx.th * 0.16, SOFA_CUSHION, seatH);
  isoPrism(offsetCtx(ctx, 0.42, 0), 0.36, 0.42, seatH + ctx.th * 0.16, SOFA_CUSHION, seatH);
  // braços (esquerda/direita)
  isoPrism(offsetCtx(ctx, -0.86, 0), 0.14, 0.5, seatH + ctx.th * 0.34, SOFA);
  isoPrism(offsetCtx(ctx, 0.86, 0), 0.14, 0.5, seatH + ctx.th * 0.34, SOFA);
};

// Mesa de reunião (~2 tiles): tampo grande, laptops e papéis.
const meetingTable: PrefabFn = (ctx) => {
  shadow(ctx, 1.25, 0.75);
  const h = ctx.th * 0.72;
  isoPrism(ctx, 1.15, 0.62, h, WOOD);
  isoPrism(offsetCtx(ctx, -0.55, 0), 0.18, 0.14, ctx.th * 0.16, DARK, h);
  isoPrism(offsetCtx(ctx, 0.55, 0), 0.18, 0.14, ctx.th * 0.16, DARK, h);
  ctx.g.poly(isoDiamond(offsetCtx(ctx, 0, 0.25), 0.18, 0.12, h)).fill({ color: 0xf5f2ea, alpha: 0.95 });
};

// Planta alta (tipo palmeira/ficus) para dar volume ao ambiente.
const plantTall: PrefabFn = (ctx) => {
  shadow(ctx, 0.38, 0.38);
  const potH = ctx.th * 0.7;
  isoPrism(ctx, 0.28, 0.28, potH, { top: 0xc98a5a, left: 0x9a6338, right: 0xb2764a });
  const [fx, fy] = iso(ctx, 0, 0, potH);
  ctx.g.rect(fx - 2, fy - ctx.th * 1.4, 4, ctx.th * 1.4).fill({ color: 0x6f553b, alpha: 1 });
  const r = ctx.th * 0.95;
  ctx.g.circle(fx, fy - ctx.th * 1.45, r * 0.7).fill({ color: 0x4e7a3e, alpha: 1 });
  ctx.g.circle(fx - r * 0.5, fy - ctx.th * 1.15, r * 0.55).fill({ color: 0x5f8a4e, alpha: 1 });
  ctx.g.circle(fx + r * 0.5, fy - ctx.th * 1.2, r * 0.5).fill({ color: 0x6b9b4e, alpha: 1 });
  ctx.g.circle(fx, fy - ctx.th * 1.85, r * 0.55).fill({ color: 0x6b9b4e, alpha: 1 });
};

// Quadro branco com rabiscos coloridos.
const whiteboard: PrefabFn = (ctx) => {
  shadow(ctx, 0.6, 0.18);
  const y0 = ctx.th * 0.45;
  const y1 = ctx.th * 1.95;
  isoPrism(offsetCtx(ctx, -0.55, 0.15), 0.04, 0.04, y0, METAL);
  isoPrism(offsetCtx(ctx, 0.55, 0.15), 0.04, 0.04, y0, METAL);
  ctx.g
    .poly([...iso(ctx, -0.7, 0.15, y0), ...iso(ctx, 0.7, 0.15, y0), ...iso(ctx, 0.7, 0.15, y1), ...iso(ctx, -0.7, 0.15, y1)])
    .fill({ color: 0xf7f5ef, alpha: 1 })
    .stroke({ width: 2, color: 0x9aa0a6, alpha: 1 });
  ctx.g.moveTo(...iso(ctx, -0.5, 0.15, y1 - ctx.th * 0.4)).lineTo(...iso(ctx, 0.1, 0.15, y1 - ctx.th * 0.55)).stroke({ width: 2, color: 0x3f7fa3, alpha: 1 });
  ctx.g.moveTo(...iso(ctx, -0.4, 0.15, y1 - ctx.th * 0.9)).lineTo(...iso(ctx, 0.4, 0.15, y1 - ctx.th * 0.8)).stroke({ width: 2, color: 0xb1557f, alpha: 1 });
};

// Armário/gaveteiro.
const cabinet: PrefabFn = (ctx) => {
  shadow(ctx, 0.55, 0.45);
  const h = ctx.th * 1.15;
  isoPrism(ctx, 0.45, 0.35, h, WOOD_DARK);
  for (let i = 0; i < 3; i += 1) {
    const y = ctx.th * (0.25 + i * 0.32);
    ctx.g.moveTo(...iso(ctx, -0.4, 0.35, y)).lineTo(...iso(ctx, 0.4, 0.35, y)).stroke({ width: 1.5, color: 0x5a3f22, alpha: 0.8 });
    ctx.g.circle(...iso(ctx, 0, 0.35, y + ctx.th * 0.14), 1.6).fill({ color: 0xc9a15a, alpha: 1 });
  }
};

// Mesa de centro com xícara e livro.
const coffeeTable: PrefabFn = (ctx) => {
  shadow(ctx, 0.6, 0.5);
  const h = ctx.th * 0.38;
  isoPrism(ctx, 0.55, 0.45, h, WOOD);
  const [cx, cy] = iso(ctx, -0.15, 0, h);
  ctx.g.circle(cx, cy - 2, ctx.th * 0.1).fill({ color: 0xffffff, alpha: 1 }).stroke({ width: 1, color: 0xb5623c, alpha: 1 });
  ctx.g.poly(isoDiamond(offsetCtx(ctx, 0.2, 0), 0.16, 0.11, h)).fill({ color: 0x5f8a4e, alpha: 0.95 });
};

// TV/monitor grande sobre rack.
const tv: PrefabFn = (ctx) => {
  shadow(ctx, 0.75, 0.32);
  const standH = ctx.th * 0.5;
  isoPrism(ctx, 0.75, 0.28, standH, WOOD_DARK);
  const y0 = standH + ctx.th * 0.12;
  const y1 = standH + ctx.th * 1.45;
  ctx.g
    .poly([...iso(ctx, -0.62, 0.1, y0), ...iso(ctx, 0.62, 0.1, y0), ...iso(ctx, 0.62, 0.1, y1), ...iso(ctx, -0.62, 0.1, y1)])
    .fill({ color: 0x11151f, alpha: 1 })
    .stroke({ width: 2, color: 0x2b2f42, alpha: 1 });
  ctx.g
    .poly([...iso(ctx, -0.5, 0.1, y0 + ctx.th * 0.15), ...iso(ctx, 0.5, 0.1, y0 + ctx.th * 0.15), ...iso(ctx, 0.5, 0.1, y1 - ctx.th * 0.15), ...iso(ctx, -0.5, 0.1, y1 - ctx.th * 0.15)])
    .fill({ color: 0x3f7fa3, alpha: 0.55 });
};

// Rack de servidores com "luzinhas".
const serverRack: PrefabFn = (ctx) => {
  shadow(ctx, 0.42, 0.36);
  const h = ctx.th * 1.8;
  isoPrism(ctx, 0.35, 0.3, h, DARK);
  const leds = [0x5f8a4e, 0xd79a3c, 0x3f7fa3, 0xb1557f, 0x6b9b4e];
  for (let i = 0; i < 6; i += 1) {
    const y = ctx.th * (0.3 + i * 0.24);
    ctx.g.circle(...iso(ctx, -0.18, 0.3, y), 1.4).fill({ color: leds[i % leds.length], alpha: 0.95 });
    ctx.g.circle(...iso(ctx, 0.05, 0.3, y), 1.4).fill({ color: leds[(i + 2) % leds.length], alpha: 0.95 });
  }
};

// Balcão de recepção (largo, com tampo claro).
const receptionDesk: PrefabFn = (ctx) => {
  shadow(ctx, 1.15, 0.72);
  const h = ctx.th * 0.9;
  isoPrism(ctx, 1.05, 0.58, h, WOOD);
  ctx.g.poly(isoDiamond(ctx, 1.12, 0.64, h + ctx.th * 0.08)).fill({ color: 0xe7d8bf, alpha: 1 });
  ctx.g
    .poly([...iso(ctx, -1.0, 0.58, 0), ...iso(ctx, 1.0, 0.58, 0), ...iso(ctx, 1.0, 0.58, h * 0.7), ...iso(ctx, -1.0, 0.58, h * 0.7)])
    .fill({ color: 0xb5623c, alpha: 0.35 });
};

// Quadro/arte em cavalete.
const painting: PrefabFn = (ctx) => {
  shadow(ctx, 0.4, 0.18);
  const y0 = ctx.th * 0.55;
  const y1 = ctx.th * 1.55;
  ctx.g.poly([...iso(ctx, -0.5, 0.14, y0), ...iso(ctx, 0.5, 0.14, y0), ...iso(ctx, 0.5, 0.14, y1), ...iso(ctx, -0.5, 0.14, y1)]).fill({ color: 0x8a6b4a, alpha: 1 });
  ctx.g
    .poly([...iso(ctx, -0.4, 0.14, y0 + ctx.th * 0.1), ...iso(ctx, 0.4, 0.14, y0 + ctx.th * 0.1), ...iso(ctx, 0.4, 0.14, y1 - ctx.th * 0.1), ...iso(ctx, -0.4, 0.14, y1 - ctx.th * 0.1)])
    .fill({ color: 0xf2e7d2, alpha: 1 });
  ctx.g.circle(...iso(ctx, -0.15, 0.14, y1 - ctx.th * 0.45), ctx.th * 0.2).fill({ color: 0xd79a3c, alpha: 1 });
  ctx.g.poly([...iso(ctx, 0.05, 0.14, y0 + ctx.th * 0.2), ...iso(ctx, 0.35, 0.14, y0 + ctx.th * 0.2), ...iso(ctx, 0.2, 0.14, y0 + ctx.th * 0.7)]).fill({ color: 0x3f7fa3, alpha: 1 });
  isoPrism(offsetCtx(ctx, -0.35, 0.1), 0.03, 0.03, y0, WOOD_DARK);
  isoPrism(offsetCtx(ctx, 0.35, 0.1), 0.03, 0.03, y0, WOOD_DARK);
};

// Estação de trabalho: mesinha + monitor ligado.
const monitor: PrefabFn = (ctx) => {
  shadow(ctx, 0.55, 0.4);
  const deskH = ctx.th * 0.7;
  isoPrism(ctx, 0.5, 0.35, deskH, WOOD);
  const y0 = deskH + ctx.th * 0.05;
  const y1 = deskH + ctx.th * 0.7;
  ctx.g
    .poly([...iso(ctx, -0.35, 0.1, y0), ...iso(ctx, 0.35, 0.1, y0), ...iso(ctx, 0.35, 0.1, y1), ...iso(ctx, -0.35, 0.1, y1)])
    .fill({ color: 0x11151f, alpha: 1 })
    .stroke({ width: 1.5, color: 0x2b2f42, alpha: 1 });
  ctx.g
    .poly([...iso(ctx, -0.28, 0.1, y0 + ctx.th * 0.08), ...iso(ctx, 0.28, 0.1, y0 + ctx.th * 0.08), ...iso(ctx, 0.28, 0.1, y1 - ctx.th * 0.08), ...iso(ctx, -0.28, 0.1, y1 - ctx.th * 0.08)])
    .fill({ color: 0x5f8a4e, alpha: 0.5 });
};

const arcade: PrefabFn = (ctx) => {
  shadow(ctx, 0.4, 0.35);
  const h = ctx.th * 1.5;
  isoPrism(ctx, 0.32, 0.28, h, DARK);
  const y0 = h * 0.45;
  const y1 = h * 0.9;
  ctx.g
    .poly([...iso(ctx, -0.22, 0.28, y0), ...iso(ctx, 0.22, 0.28, y0), ...iso(ctx, 0.22, 0.28, y1), ...iso(ctx, -0.22, 0.28, y1)])
    .fill({ color: 0x6d5bd0, alpha: 0.85 });
  ctx.g.circle(...iso(ctx, -0.1, 0.28, h * 0.25), 2).fill({ color: 0xb1557f, alpha: 1 });
  ctx.g.circle(...iso(ctx, 0.1, 0.28, h * 0.25), 2).fill({ color: 0x3f7fa3, alpha: 1 });
};

const poolTable: PrefabFn = (ctx) => {
  shadow(ctx, 1.1, 0.7);
  const h = ctx.th * 0.45;
  isoPrism(ctx, 1.0, 0.55, h, { top: 0x2f6b45, left: 0x1f4a30, right: 0x275a3a });
  isoPrism(ctx, 1.05, 0.6, h * 0.15, WOOD_DARK, h);
  ctx.g.circle(...iso(ctx, -0.3, 0, h + 2), 2.2).fill({ color: 0xffffff, alpha: 1 });
  ctx.g.circle(...iso(ctx, 0.2, 0.1, h + 2), 2.2).fill({ color: 0xd79a3c, alpha: 1 });
  ctx.g.circle(...iso(ctx, 0.05, -0.15, h + 2), 2.2).fill({ color: 0xb1557f, alpha: 1 });
};

const foosball: PrefabFn = (ctx) => {
  shadow(ctx, 0.85, 0.5);
  const h = ctx.th * 0.5;
  isoPrism(ctx, 0.75, 0.4, h, { top: 0xc4633f, left: 0x9a482e, right: 0xb05535 });
  ctx.g.moveTo(...iso(ctx, -0.7, 0, h + 4)).lineTo(...iso(ctx, 0.7, 0, h + 4)).stroke({ width: 2, color: 0xc2c8d2, alpha: 1 });
  ctx.g.moveTo(...iso(ctx, -0.7, 0.15, h + 4)).lineTo(...iso(ctx, 0.7, 0.15, h + 4)).stroke({ width: 2, color: 0xc2c8d2, alpha: 1 });
};

const beanbag: PrefabFn = (ctx) => {
  shadow(ctx, 0.45, 0.4);
  const [x, y] = iso(ctx, 0, 0, 0);
  ctx.g.ellipse(x, y - ctx.th * 0.15, ctx.tw * 0.28, ctx.th * 0.35).fill({ color: 0xb1557f, alpha: 1 });
  ctx.g.ellipse(x, y - ctx.th * 0.28, ctx.tw * 0.2, ctx.th * 0.22).fill({ color: 0xc97aa0, alpha: 1 });
};

const hologram: PrefabFn = (ctx) => {
  shadow(ctx, 0.35, 0.35);
  isoPrism(ctx, 0.2, 0.2, ctx.th * 0.35, METAL);
  const [x, y] = iso(ctx, 0, 0, ctx.th * 0.4);
  ctx.g.ellipse(x, y - ctx.th * 0.55, ctx.tw * 0.18, ctx.th * 0.55).fill({ color: 0x5ec8ff, alpha: 0.35 });
  ctx.g.ellipse(x, y - ctx.th * 0.55, ctx.tw * 0.1, ctx.th * 0.35).fill({ color: 0xa8e4ff, alpha: 0.45 });
};

const coffeeMachine: PrefabFn = (ctx) => {
  shadow(ctx, 0.35, 0.3);
  const h = ctx.th * 1.1;
  isoPrism(ctx, 0.28, 0.22, h, WHITE);
  ctx.g.circle(...iso(ctx, 0, 0.22, h * 0.55), 3).fill({ color: 0x3f7fa3, alpha: 0.9 });
  isoPrism(offsetCtx(ctx, 0, 0.05), 0.1, 0.08, ctx.th * 0.2, { top: 0xffffff, left: 0xd0d0d0, right: 0xe8e8e8 }, h * 0.2);
};

const vending: PrefabFn = (ctx) => {
  shadow(ctx, 0.4, 0.3);
  const h = ctx.th * 1.6;
  isoPrism(ctx, 0.35, 0.25, h, { top: 0x3f7fa3, left: 0x2c5f7a, right: 0x356f8c });
  for (let i = 0; i < 3; i += 1) {
    const y = ctx.th * (0.4 + i * 0.35);
    ctx.g
      .poly([...iso(ctx, -0.25, 0.25, y), ...iso(ctx, 0.25, 0.25, y), ...iso(ctx, 0.25, 0.25, y + ctx.th * 0.25), ...iso(ctx, -0.25, 0.25, y + ctx.th * 0.25)])
      .fill({ color: 0xffe9a8, alpha: 0.35 });
  }
};

const PREFABS: Record<string, PrefabFn> = {
  desk,
  chair,
  bookshelf,
  plant,
  watercooler,
  rug,
  lamp,
  sofa,
  "meeting-table": meetingTable,
  "plant-tall": plantTall,
  whiteboard,
  cabinet,
  "coffee-table": coffeeTable,
  tv,
  "server-rack": serverRack,
  "reception-desk": receptionDesk,
  painting,
  monitor,
  arcade,
  "pool-table": poolTable,
  foosball,
  beanbag,
  hologram,
  "coffee-machine": coffeeMachine,
  vending,
};

/**
 * Desenha o prefab correspondente ao `ref`. Retorna false quando não há prefab
 * (o chamador então usa o desenho genérico padrão).
 */
export function drawPrefab(ref: string, ctx: PrefabCtx): boolean {
  const fn = PREFABS[ref];
  if (!fn) {
    return false;
  }
  fn(ctx);
  return true;
}
