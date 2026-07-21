/**
 * PixiWorldEngine — ADAPTER do renderer PixiJS para a porta `WorldEngine`.
 *
 * NAO cria arquitetura nova: apenas implementa a interface existente.
 * Conhece SOMENTE conceitos genericos: Map, Layer, Tile, Area, Entity, Portal.
 * Nao sabe o que e "escritorio", "CEO", "agente" ou "NEXO" — tudo vem por dados
 * (MapManifest) e eventos. Fase 1: primeiro renderer funcional (sem avatar,
 * movimento, colisao, IA ou multiplayer).
 *
 * O PixiJS e carregado sob demanda (dynamic import) dentro de `init`, mantendo
 * o modulo leve para testes/SSR e a fabrica sincrona.
 */

import type { Application, Container, Graphics, Sprite, Texture } from "pixi.js";
import type { Viewport } from "pixi-viewport";

import type { PresenceComponent, RenderLayer } from "../../contracts/components";
import type { EntityId, Unsubscribe } from "../../contracts/ids";
import type { AreaBlueprint, EntityBlueprint, FloorDef, MapManifest } from "../../contracts/map";
import type { WorldEngine, WorldEngineContext } from "../../contracts/world-engine";
import { computeCameraFraming } from "./camera-framing";
import { areaPolygon, colorFromString, depthOf, tileCenter, tileCorner, tileDiamond } from "./iso";
import { drawPrefab } from "./prefabs";

type PixiModule = typeof import("pixi.js");

const LAYER_ORDER: readonly RenderLayer[] = ["floor", "walls", "objects", "actors", "overlay"];

// Paleta ILUSTRADA aconchegante (madeira/creme/terracota). Identidade própria.
const SCENE_BG = 0xf3ead6; // fundo quente (creme)
const FLOOR_TILE_A = 0xd9a869; // madeira mel (clara)
const FLOOR_TILE_B = 0xce9c59; // madeira mel (tábua alternada)
const FLOOR_GRID = 0xb07f42; // linha das tábuas (sutil)
const FLOOR_SKIRT_LEFT = 0x9c6a37; // espessura do piso (frente esquerda)
const FLOOR_SKIRT_RIGHT = 0xae7940; // espessura do piso (frente direita)
const WALL_LEFT = 0xede0c8; // parede creme (fundo esquerdo)
const WALL_RIGHT = 0xb5623c; // parede terracota (fundo direito)
const WALL_TOP_RIM = 0xfff6e6; // rodateto claro
const WALL_BASE_LINE = 0x8a6b4a; // rodapé/linhas
const WINDOW_FRAME = 0xf2e7d2; // moldura da janela
const WINDOW_GLOW_A = 0xffe9a8; // vidro (topo, mais claro)
const WINDOW_GLOW_B = 0xf6c56b; // vidro (base, dourado)
const PORTAL_FILL = 0xffd166;
const OBJECT_FILL = 0xc7b299;
const ACTOR_HEAD = 0xf3d6b8;

// Tons quentes para os avatares (cápsula). Cor estável derivada do id.
const ACTOR_PALETTE = [0x6d5bd0, 0xc4633f, 0x5f8a4e, 0xd79a3c, 0x3f7fa3, 0xb1557f];

const WALL_HEIGHT_TILES = 3;
const SKIRT_HEIGHT_RATIO = 0.4;
// Empurra as paredes texturizadas para trás de todo o piso/atores no depth-sort.
const WALL_DEPTH_BIAS = 1000;

/** Hash estável (não-negativo) de uma string, para escolher cor da paleta. */
function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export class PixiWorldEngine implements WorldEngine {
  readonly id = "pixi";

  private context: WorldEngineContext | undefined;
  private pixi: PixiModule | undefined;
  private app: Application | undefined;
  private viewport: Viewport | undefined;
  private worldRoot: Container | undefined;
  private readonly layers = new Map<RenderLayer, Container>();
  private readonly actorSprites = new Map<EntityId, Container>();
  // Balão sutil de atividade ("trabalhando") por ator não-local.
  private readonly actorBubbles = new Map<EntityId, Container>();
  /** Telas/luzes que pulsam (monitores, TVs, hologramas) — só apresentação. */
  private readonly ambientPulses: Graphics[] = [];

  private readonly ambientSteam: { g: Graphics; baseY: number; phase: number }[] = [];
  private tickHandler: (() => void) | undefined;
  private tileW = 0;
  private tileH = 0;
  private offCamera: Unsubscribe | undefined;
  private resizeObserver: ResizeObserver | undefined;

  // Texturas do tema (opcionais): quando ausentes, cai no render vetorial.
  private textures: {
    floor?: Texture;
    wallLeft?: Texture;
    wallRight?: Texture;
  } = {};
  private assetScale = 1;
  private tileAnchor = { x: 0.5, y: 0.873 };
  // Sprites de ator por spriteId (pixel-art). Vazio -> capsula vetorial.
  private readonly actorTextures = new Map<string, Texture>();
  private readonly actorAnchors = new Map<string, { x: number; y: number }>();

  async init(context: WorldEngineContext): Promise<void> {
    this.context = context;
    const PIXI = await import("pixi.js");
    const { Viewport } = await import("pixi-viewport");
    this.pixi = PIXI;

    const width = context.container.clientWidth || 960;
    const height = context.container.clientHeight || 600;

    const app = new PIXI.Application();
    await app.init({
      width,
      height,
      background: SCENE_BG,
      antialias: true,
      autoDensity: true,
      resolution: globalThis.devicePixelRatio ?? 1,
    });
    this.app = app;

    const canvas = app.canvas;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    context.container.appendChild(canvas);

    const viewport = new Viewport({
      screenWidth: width,
      screenHeight: height,
      worldWidth: width,
      worldHeight: height,
      events: app.renderer.events,
    });
    viewport.drag().pinch().wheel().decelerate().clampZoom({ minScale: 0.2, maxScale: 4 });
    app.stage.addChild(viewport as unknown as Container);
    this.viewport = viewport;

    const worldRoot = new PIXI.Container();
    worldRoot.sortableChildren = true;
    viewport.addChild(worldRoot);
    this.worldRoot = worldRoot;
    this.buildLayers();

    context.camera.setViewport(width, height);
    // Reconciliação câmera lógica <-> viewport, sem loop de eventos.
    let syncing = false;
    this.offCamera = context.bus.on("camera:moved", ({ state }) => {
      if (syncing) {
        return;
      }
      syncing = true;
      viewport.setZoom(state.zoom, false);
      viewport.moveCenter(state.x, state.y);
      syncing = false;
    });
    // Gestos do usuário (arrastar/pinça/roda) atualizam a câmera lógica.
    const syncFromViewport = (): void => {
      if (syncing) {
        return;
      }
      syncing = true;
      context.camera.zoomTo(viewport.scale.x);
      context.camera.moveTo(viewport.center.x, viewport.center.y);
      syncing = false;
    };
    viewport.on("moved", syncFromViewport);
    viewport.on("zoomed", syncFromViewport);

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        this.resize(context.container.clientWidth || width, context.container.clientHeight || height);
      });
      this.resizeObserver.observe(context.container);
    }

    // Loop de RENDER (apenas leitura do ECS): atores + pulsos ambiente leves.
    this.tickHandler = () => {
      this.syncActors();
      this.syncAmbient();
    };
    app.ticker.add(this.tickHandler);
  }

  async loadMap(manifest: MapManifest): Promise<void> {
    if (!this.pixi || !this.worldRoot || !this.viewport) {
      return;
    }
    this.tileW = manifest.tileWidth;
    this.tileH = manifest.tileHeight;
    await this.loadThemeAssets(manifest);
    this.clearLayers();
    this.actorSprites.clear();
    this.actorBubbles.clear();
    this.ambientPulses.length = 0;
    this.ambientSteam.length = 0;
    for (const floor of manifest.floors) {
      this.drawRoomShell(floor, manifest);
      this.drawFloor(floor, manifest);
      for (const area of floor.areas) {
        this.drawArea(area, manifest);
        for (const decoration of area.decorations) {
          this.drawEntity(decoration, manifest);
        }
      }
      for (const entity of floor.entities) {
        this.drawEntity(entity, manifest);
      }
    }
    this.syncActors();
    this.frameCamera();
  }

  resize(width: number, height: number): void {
    if (!this.app || !this.viewport) {
      return;
    }
    this.app.renderer.resize(width, height);
    this.viewport.resize(width, height, this.viewport.worldWidth, this.viewport.worldHeight);
    this.context?.camera.setViewport(width, height);
  }

  destroy(): void {
    this.offCamera?.();
    this.offCamera = undefined;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    if (this.app && this.tickHandler) {
      this.app.ticker.remove(this.tickHandler);
    }
    this.tickHandler = undefined;
    this.clearLayers();
    this.actorSprites.clear();
    this.actorBubbles.clear();
    this.ambientPulses.length = 0;
    this.ambientSteam.length = 0;
    this.layers.clear();
    this.viewport?.destroy();
    this.viewport = undefined;
    this.app?.destroy({ removeView: true }, { children: true });
    this.app = undefined;
    this.worldRoot = undefined;
    this.pixi = undefined;
    this.context = undefined;
  }

  private buildLayers(): void {
    if (!this.pixi || !this.worldRoot) {
      return;
    }
    for (const name of LAYER_ORDER) {
      const layer = new this.pixi.Container();
      layer.sortableChildren = true;
      layer.label = `layer:${name}`;
      this.worldRoot.addChild(layer);
      this.layers.set(name, layer);
    }
  }

  private clearLayers(): void {
    for (const layer of this.layers.values()) {
      for (const child of layer.removeChildren()) {
        child.destroy();
      }
    }
  }

  private newGraphics(): Graphics {
    return new this.pixi!.Graphics();
  }

  /**
   * Carrega as texturas do tema (via AssetProvider) para render com sprites.
   * Se qualquer asset faltar/falhar, mantém `undefined` e o render cai no
   * modo vetorial (fallback) — nada quebra.
   */
  private async loadThemeAssets(manifest: MapManifest): Promise<void> {
    this.textures = {};
    this.assetScale = 1;
    this.actorTextures.clear();
    this.actorAnchors.clear();
    if (!this.pixi || !this.context) {
      return;
    }
    try {
      const theme = await this.context.assets.getManifest(manifest.themeId);
      const floorTs = theme.tilesets.find((t) => t.id === "floor");
      const wallLeftTs = theme.tilesets.find((t) => t.id === "wall-left");
      const wallRightTs = theme.tilesets.find((t) => t.id === "wall-right");

      const sourceTileW = floorTs?.tileWidth ?? manifest.tileWidth;
      this.assetScale = manifest.tileWidth / sourceTileW;

      if (floorTs) {
        this.tileAnchor = { x: floorTs.anchorX ?? 0.5, y: floorTs.anchorY ?? 0.5 };
        this.textures.floor = await this.loadTexture(floorTs.imageUrl);
      }
      if (wallLeftTs) {
        this.textures.wallLeft = await this.loadTexture(wallLeftTs.imageUrl);
      }
      if (wallRightTs) {
        this.textures.wallRight = await this.loadTexture(wallRightTs.imageUrl);
      }
      // Sprites de ator (um por spriteId).
      for (const sheet of theme.spritesheets) {
        const tex = await this.loadTexture(sheet.imageUrl);
        if (tex) {
          this.actorTextures.set(sheet.id, tex);
          this.actorAnchors.set(sheet.id, { x: sheet.anchorX ?? 0.5, y: sheet.anchorY ?? 0.95 });
        }
      }
    } catch {
      this.textures = {};
    }
  }

  private async loadTexture(url: string): Promise<Texture | undefined> {
    if (!this.pixi) {
      return undefined;
    }
    try {
      return (await this.pixi.Assets.load(url)) as Texture;
    } catch {
      return undefined;
    }
  }

  /** Cria um sprite de tile posicionado no centro do losango (col,row). */
  private placeTileSprite(
    texture: Texture,
    col: number,
    row: number,
    tw: number,
    th: number,
    zIndex: number,
    layer: Container,
  ): Sprite {
    const center = tileCenter(col, row, tw, th);
    const sprite = new this.pixi!.Sprite(texture);
    sprite.anchor.set(this.tileAnchor.x, this.tileAnchor.y);
    sprite.scale.set(this.assetScale);
    sprite.position.set(center.x, center.y);
    sprite.zIndex = zIndex;
    layer.addChild(sprite);
    return sprite;
  }

  /** Desenha o piso do mapa (Map + Tile + Layer "floor"). */
  private drawFloor(floor: FloorDef, manifest: MapManifest): void {
    const layer = this.layers.get("floor");
    if (!layer) {
      return;
    }
    const { tileWidth: tw, tileHeight: th } = manifest;

    // Caminho com TEXTURA (sprites por tile, com depth-sort).
    if (this.textures.floor) {
      for (let row = 0; row < floor.size.rows; row += 1) {
        for (let col = 0; col < floor.size.cols; col += 1) {
          this.placeTileSprite(this.textures.floor, col, row, tw, th, depthOf(col, row), layer);
        }
      }
      return;
    }

    // Fallback vetorial: xadrez isométrico.
    const g = this.newGraphics();
    for (let row = 0; row < floor.size.rows; row += 1) {
      for (let col = 0; col < floor.size.cols; col += 1) {
        const pts = tileDiamond(col, row, tw, th);
        const shade = (col + row) % 2 === 0 ? FLOOR_TILE_A : FLOOR_TILE_B;
        g.poly(pts).fill({ color: shade, alpha: 1 });
        g.poly(pts).stroke({ width: 1, color: FLOOR_GRID, alpha: 0.6 });
      }
    }
    g.zIndex = 0;
    layer.addChild(g);
  }

  /**
   * "Casca" da sala isométrica: espessura do piso (skirt) + duas paredes ao
   * fundo. Genérico: derivado apenas do tamanho da grade (cols x rows), sem
   * nenhum dado de negócio. Dá o visual de uma salinha 3D.
   */
  private drawRoomShell(floor: FloorDef, manifest: MapManifest): void {
    const layer = this.layers.get("floor");
    if (!layer) {
      return;
    }
    const { tileWidth: tw, tileHeight: th } = manifest;
    const { cols, rows } = floor.size;

    // Caminho com TEXTURA: segmentos de parede nas duas bordas do fundo.
    if (this.textures.wallLeft && this.textures.wallRight) {
      // borda traseira-esquerda: coluna col=0
      for (let row = 0; row < rows; row += 1) {
        this.placeTileSprite(this.textures.wallLeft, 0, row, tw, th, depthOf(0, row) - WALL_DEPTH_BIAS, layer);
      }
      // borda traseira-direita: linha row=0
      for (let col = 0; col < cols; col += 1) {
        this.placeTileSprite(this.textures.wallRight, col, 0, tw, th, depthOf(col, 0) - WALL_DEPTH_BIAS, layer);
      }
      return;
    }

    // Cantos externos da grade (limites inteiros do piso).
    const top = tileCorner(0, 0, tw, th);
    const right = tileCorner(cols, 0, tw, th);
    const bottom = tileCorner(cols, rows, tw, th);
    const left = tileCorner(0, rows, tw, th);

    const skirtH = th * SKIRT_HEIGHT_RATIO;
    const wallH = th * WALL_HEIGHT_TILES;

    // Espessura do piso (bordas frontais: esquerda-frente e direita-frente).
    const skirt = this.newGraphics();
    skirt
      .poly([left.x, left.y, bottom.x, bottom.y, bottom.x, bottom.y + skirtH, left.x, left.y + skirtH])
      .fill({ color: FLOOR_SKIRT_LEFT, alpha: 1 });
    skirt
      .poly([bottom.x, bottom.y, right.x, right.y, right.x, right.y + skirtH, bottom.x, bottom.y + skirtH])
      .fill({ color: FLOOR_SKIRT_RIGHT, alpha: 1 });
    skirt.zIndex = -5;
    layer.addChild(skirt);

    // Paredes ao fundo (bordas traseiras: esquerda-fundo e direita-fundo).
    const walls = this.newGraphics();
    // parede esquerda (top → left), creme
    walls
      .poly([top.x, top.y - wallH, left.x, left.y - wallH, left.x, left.y, top.x, top.y])
      .fill({ color: WALL_LEFT, alpha: 1 });
    // parede direita (top → right), terracota
    walls
      .poly([top.x, top.y - wallH, right.x, right.y - wallH, right.x, right.y, top.x, top.y])
      .fill({ color: WALL_RIGHT, alpha: 1 });
    // rodapé (faixa escura na base de cada parede)
    const baseH = th * 0.28;
    walls
      .poly([top.x, top.y, left.x, left.y, left.x, left.y - baseH, top.x, top.y - baseH])
      .fill({ color: WALL_BASE_LINE, alpha: 0.35 });
    walls
      .poly([top.x, top.y, right.x, right.y, right.x, right.y - baseH, top.x, top.y - baseH])
      .fill({ color: WALL_BASE_LINE, alpha: 0.35 });
    // rodateto (linhas superiores das paredes)
    walls
      .moveTo(left.x, left.y - wallH)
      .lineTo(top.x, top.y - wallH)
      .lineTo(right.x, right.y - wallH)
      .stroke({ width: 3, color: WALL_TOP_RIM, alpha: 0.9 });
    walls.zIndex = -30;
    layer.addChild(walls);

    // Janela na parede direita (terracota): vidro dourado + moldura + caixilhos.
    // Ponto na parede: horizontal segue a aresta base (top→right); vertical sobe.
    const winP = (u: number, v: number): { x: number; y: number } => ({
      x: top.x + (right.x - top.x) * u,
      y: top.y + (right.y - top.y) * u - v * wallH,
    });
    const u0 = 0.5;
    const u1 = 0.86;
    const um = (u0 + u1) / 2;
    const v0 = 0.34;
    const v1 = 0.82;
    const vm = 0.6;
    const win = this.newGraphics();
    const c = (u: number, v: number): number[] => {
      const p = winP(u, v);
      return [p.x, p.y];
    };
    win
      .poly([...c(u0, v0), ...c(u1, v0), ...c(u1, vm), ...c(u0, vm)])
      .fill({ color: WINDOW_GLOW_B, alpha: 1 });
    win
      .poly([...c(u0, vm), ...c(u1, vm), ...c(u1, v1), ...c(u0, v1)])
      .fill({ color: WINDOW_GLOW_A, alpha: 1 });
    win
      .poly([...c(u0, v0), ...c(u1, v0), ...c(u1, v1), ...c(u0, v1)])
      .stroke({ width: 3, color: WINDOW_FRAME, alpha: 1 });
    win.moveTo(...(c(um, v0) as [number, number])).lineTo(...(c(um, v1) as [number, number])).stroke({ width: 2, color: WINDOW_FRAME, alpha: 1 });
    win.moveTo(...(c(u0, vm) as [number, number])).lineTo(...(c(u1, vm) as [number, number])).stroke({ width: 2, color: WINDOW_FRAME, alpha: 1 });
    win.zIndex = -28;
    layer.addChild(win);

    // Facho de luz suave no chão, saindo da janela (bem sutil).
    const glow = this.newGraphics();
    const gc0 = tileCorner(Math.floor(cols * 0.55), 0, tw, th);
    const gc1 = tileCorner(cols, 0, tw, th);
    const gc2 = tileCorner(cols, Math.ceil(rows * 0.45), tw, th);
    const gc3 = tileCorner(Math.floor(cols * 0.55), Math.ceil(rows * 0.3), tw, th);
    glow
      .poly([gc0.x, gc0.y, gc1.x, gc1.y, gc2.x, gc2.y, gc3.x, gc3.y])
      .fill({ color: WINDOW_GLOW_A, alpha: 0.14 });
    glow.zIndex = -2;
    layer.addChild(glow);
  }

  /** Desenha uma Area (recinto generico): preenchimento + borda + rotulo. */
  private drawArea(area: AreaBlueprint, manifest: MapManifest): void {
    const floorLayer = this.layers.get("floor");
    const overlay = this.layers.get("overlay");
    if (!floorLayer || !overlay) {
      return;
    }
    const { tileWidth: tw, tileHeight: th } = manifest;
    const enc = area.enclosure;
    const color = enc?.color ?? colorFromString(area.id);
    const poly = areaPolygon(area.bounds, tw, th);

    const g = this.newGraphics();
    // Piso do departamento (identidade): blend forte quando há floorColor.
    if (enc?.floorColor !== undefined) {
      g.poly(poly).fill({ color: enc.floorColor, alpha: 0.55 });
    }
    g.poly(poly)
      .fill({ color, alpha: enc?.floorColor !== undefined ? 0.06 : 0.08 })
      .stroke({ width: 1.5, color, alpha: 0.4 });
    g.zIndex = 1;
    floorLayer.addChild(g);

    this.drawEnclosure(area, manifest);

    const center = tileCenter(
      area.bounds.col + area.bounds.w / 2 - 0.5,
      area.bounds.row + area.bounds.h / 2 - 0.5,
      tw,
      th,
    );
    const label = new this.pixi!.Text({
      text: area.name,
      style: {
        fill: 0x5a4030,
        fontSize: 11,
        fontFamily: "Segoe UI, system-ui, sans-serif",
        fontWeight: "600",
      },
    });
    label.anchor.set(0.5);
    label.position.set(center.x, center.y);
    label.alpha = 0.55;
    label.zIndex = 10;
    overlay.addChild(label);
  }

  /** Mistura duas cores RGB (t=0 → a, t=1 → b). Puro, sem PixiJS. */
  private mixColor(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 0xff;
    const ag = (a >> 8) & 0xff;
    const ab = a & 0xff;
    const br = (b >> 16) & 0xff;
    const bg = (b >> 8) & 0xff;
    const bb = b & 0xff;
    const r = Math.round(ar + (br - ar) * t);
    const gg = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (gg << 8) | bl;
  }

  /**
   * Paredes/portas/janelas de um recinto. Só as DUAS arestas ao fundo (norte e
   * oeste) são desenhadas — as frontais ficam abertas para não ocultar o
   * interior. Totalmente genérico: apenas formas a partir de `area.enclosure`.
   */
  private drawEnclosure(area: AreaBlueprint, manifest: MapManifest): void {
    const enc = area.enclosure;
    if (!enc?.walls) {
      return;
    }
    const wallsLayer = this.layers.get("walls");
    if (!wallsLayer) {
      return;
    }
    const { tileWidth: tw, tileHeight: th } = manifest;
    const { col, row, w, h } = area.bounds;
    const a = tileCorner(col, row, tw, th);
    const b = tileCorner(col + w, row, tw, th);
    const d = tileCorner(col, row + h, tw, th);
    const wallH = th * 1.7;
    const accent = enc.color ?? WALL_RIGHT;
    const accentLight = this.mixColor(accent, 0xffffff, 0.42);
    const zBase = depthOf(col, row) - 20;

    const doorN = enc.doors?.find((o) => o.side === "n");
    const doorW = enc.doors?.find((o) => o.side === "w");
    const winN = enc.windows?.find((o) => o.side === "n");
    const winW = enc.windows?.find((o) => o.side === "w");

    // aresta norte (a → b): parede de acento
    const north = this.drawWallSide(a, b, wallH, th, accent, doorN, winN);
    north.zIndex = zBase;
    wallsLayer.addChild(north);
    // aresta oeste (a → d): variação clara do acento
    const west = this.drawWallSide(a, d, wallH, th, accentLight, doorW, winW);
    west.zIndex = zBase;
    wallsLayer.addChild(west);
  }

  /** Desenha uma parede (aresta p0→p1) com rodapé, rodateto, porta e janela. */
  private drawWallSide(
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    wallH: number,
    th: number,
    color: number,
    door?: { at: number; width?: number },
    win?: { at: number; width?: number },
  ): Graphics {
    const g = this.newGraphics();
    const baseH = th * 0.22;
    const lerp = (t: number): { x: number; y: number } => ({
      x: p0.x + (p1.x - p0.x) * t,
      y: p0.y + (p1.y - p0.y) * t,
    });
    const segments: [number, number][] = [];
    if (door) {
      const a0 = Math.max(0, door.at);
      const a1 = Math.min(1, door.at + (door.width ?? 0.22));
      if (a0 > 0.001) {
        segments.push([0, a0]);
      }
      if (a1 < 0.999) {
        segments.push([a1, 1]);
      }
    } else {
      segments.push([0, 1]);
    }
    for (const [t0, t1] of segments) {
      const s = lerp(t0);
      const e = lerp(t1);
      g.poly([s.x, s.y - wallH, e.x, e.y - wallH, e.x, e.y, s.x, s.y]).fill({ color, alpha: 1 });
      g.poly([s.x, s.y, e.x, e.y, e.x, e.y - baseH, s.x, s.y - baseH]).fill({
        color: WALL_BASE_LINE,
        alpha: 0.26,
      });
      g.moveTo(s.x, s.y - wallH)
        .lineTo(e.x, e.y - wallH)
        .stroke({ width: 2, color: WALL_TOP_RIM, alpha: 0.85 });
    }
    // Janela: painel de vidro claro na faixa superior da parede.
    if (win) {
      const a0 = Math.max(0, win.at);
      const a1 = Math.min(1, win.at + (win.width ?? 0.3));
      const s = lerp(a0);
      const e = lerp(a1);
      const y0 = wallH * 0.34;
      const y1 = wallH * 0.82;
      g.poly([s.x, s.y - y1, e.x, e.y - y1, e.x, e.y - y0, s.x, s.y - y0])
        .fill({ color: 0xcdeaff, alpha: 0.5 })
        .stroke({ width: 1.5, color: 0xffffff, alpha: 0.55 });
    }
    return g;
  }

  /** Desenha uma Entity generica; Portais recebem marcador distinto. */
  private drawEntity(blueprint: EntityBlueprint, manifest: MapManifest): void {
    const c = blueprint.components;
    const { tileWidth: tw, tileHeight: th } = manifest;
    const center = tileCenter(c.transform.col, c.transform.row, tw, th);
    const isPortal = c.portal !== undefined;

    const layerName: RenderLayer = c.renderable?.layer ?? (isPortal ? "walls" : "objects");
    const layer = this.layers.get(layerName) ?? this.layers.get("objects");
    if (!layer) {
      return;
    }

    const g = this.newGraphics();
    if (isPortal) {
      const w = tw * 0.5;
      const h = th * 1.4;
      g.roundRect(center.x - w / 2, center.y - h, w, h, 4)
        .fill({ color: PORTAL_FILL, alpha: 0.9 })
        .stroke({ width: 2, color: 0x8a5a00, alpha: 0.9 });
    } else if (!drawPrefab(blueprint.ref, { g, cx: center.x, cy: center.y, tw, th })) {
      // Sem prefab conhecido: prop genérico (bolinha).
      const r = Math.min(tw, th) * 0.28;
      g.circle(center.x, center.y - r * 0.4, r)
        .fill({ color: OBJECT_FILL, alpha: 0.95 })
        .stroke({ width: 2, color: WALL_BASE_LINE, alpha: 0.9 });
    }
    // Tapete fica no chão (atrás de tudo); demais props acima do piso.
    const isRug = blueprint.ref === "rug";
    g.zIndex = isRug ? 2 : depthOf(c.transform.col, c.transform.row) + (isPortal ? 100 : 50);
    layer.addChild(g);

    // Brilho ambiente em telas/tecnologia (pulse leve no ticker).
    if (
      blueprint.ref === "monitor" ||
      blueprint.ref === "tv" ||
      blueprint.ref === "hologram" ||
      blueprint.ref === "server-rack" ||
      blueprint.ref === "arcade"
    ) {
      const glow = this.newGraphics();
      glow.circle(center.x, center.y - th * 0.9, tw * 0.18).fill({
        color: blueprint.ref === "hologram" ? 0x5ec8ff : 0xa8e4ff,
        alpha: 0.22,
      });
      glow.zIndex = g.zIndex + 1;
      layer.addChild(glow);
      this.ambientPulses.push(glow);
    }

    // Vapor subindo da cafeteira (só apresentação; animado no ticker).
    if (blueprint.ref === "coffee-machine" || blueprint.ref === "coffee-table") {
      const steam = this.newGraphics();
      steam.ellipse(0, 0, tw * 0.05, th * 0.05).fill({ color: 0xffffff, alpha: 0.6 });
      steam.ellipse(tw * 0.04, -th * 0.14, tw * 0.045, th * 0.045).fill({ color: 0xffffff, alpha: 0.5 });
      steam.ellipse(-tw * 0.03, -th * 0.26, tw * 0.04, th * 0.04).fill({ color: 0xffffff, alpha: 0.4 });
      const baseY = center.y - th * 1.05;
      steam.position.set(center.x, baseY);
      steam.zIndex = g.zIndex + 2;
      layer.addChild(steam);
      this.ambientSteam.push({ g: steam, baseY, phase: this.ambientSteam.length * 0.9 });
    }
  }

  /** Pulsa telas/luzes e sobe o vapor (só apresentação; sem lógica de domínio). */
  private syncAmbient(): void {
    const t = (globalThis.performance?.now?.() ?? 0) / 1000;
    for (let i = 0; i < this.ambientPulses.length; i += 1) {
      const g = this.ambientPulses[i]!;
      const phase = (i % 7) * 0.7;
      g.alpha = 0.35 + Math.sin(t * 2.2 + phase) * 0.25;
    }
    for (let i = 0; i < this.ambientSteam.length; i += 1) {
      const { g, baseY, phase } = this.ambientSteam[i]!;
      const f = (t * 0.5 + phase) % 1;
      g.alpha = (1 - f) * 0.55;
      g.position.y = baseY - f * this.tileH * 0.9;
    }
  }

  /**
   * Sincroniza os sprites dos Actors com o ECS (somente leitura).
   * Actor = entidade com presence + transform + renderable. Cria/remove sprites
   * conforme entram/saem do mundo e reposiciona pela `position` (tile) atual.
   */
  private syncActors(): void {
    if (!this.pixi || !this.context || !this.tileW || !this.tileH) {
      return;
    }
    const layer = this.layers.get("actors");
    if (!layer) {
      return;
    }
    const world = this.context.world;
    const alive = new Set<EntityId>();

    for (const id of world.query("presence", "transform", "renderable")) {
      const transform = world.get(id, "transform");
      if (!transform) {
        continue;
      }
      alive.add(id);
      let sprite = this.actorSprites.get(id);
      if (!sprite) {
        sprite = this.createActorSprite(id);
        layer.addChild(sprite);
        this.actorSprites.set(id, sprite);
      }
      const center = tileCenter(transform.col, transform.row, this.tileW, this.tileH);
      // Vida: saltinho ao andar; respiração leve ao ficar parado ("trabalhando").
      const t = (globalThis.performance?.now?.() ?? 0) / 1000;
      const moving = world.get(id, "movable")?.moving ?? false;
      const phase = (Number(id) % 10) * 0.6;
      const bob = moving
        ? Math.abs(Math.sin(t * 8 + phase)) * (this.tileH * 0.14)
        : Math.sin(t * 2 + phase) * (this.tileH * 0.05);
      sprite.position.set(center.x, center.y - bob);
      sprite.zIndex = depthOf(transform.col, transform.row) + 500;
      // Balão "trabalhando": aparece quando parado, com respiração suave.
      const bubble = this.actorBubbles.get(id);
      if (bubble) {
        bubble.visible = !moving;
        if (!moving) {
          bubble.alpha = 0.7 + Math.sin(t * 3 + phase) * 0.25;
        }
      }
    }

    for (const [id, sprite] of this.actorSprites) {
      if (!alive.has(id)) {
        sprite.destroy();
        this.actorSprites.delete(id);
        this.actorBubbles.delete(id);
      }
    }
  }

  /**
   * Personagem genérico estilo isométrico (sombra + corpo + cabeça).
   * Sem rótulos de negócio: a cor vem da presença (usuário local) ou é derivada
   * de forma determinística do actorId. O "domínio" decide quem é o ator.
   */
  private createActorSprite(id: EntityId): Container {
    const container = new this.pixi!.Container();
    const presence = this.context?.world.get(id, "presence");
    let topY: number;

    // Caminho com TEXTURA: sprite pixel-art do ator (por spriteId), apoiado pelos pés.
    const spriteId = this.context?.world.get(id, "renderable")?.spriteId;
    const tex = spriteId ? this.actorTextures.get(spriteId) : undefined;
    if (tex) {
      // sombra macia no chão (evita o avatar "flutuando").
      const shadow = this.newGraphics();
      shadow.ellipse(0, 0, this.tileW * 0.3, this.tileH * 0.26).fill({ color: 0x000000, alpha: 0.2 });
      container.addChild(shadow);
      const sprite = new this.pixi!.Sprite(tex);
      const anchor = this.actorAnchors.get(spriteId ?? "") ?? { x: 0.5, y: 0.95 };
      sprite.anchor.set(anchor.x, anchor.y);
      // Altura-alvo ~1.5 tile (Habbo-like). Escala mantém proporção do sprite.
      const targetH = this.tileW * 1.5;
      sprite.scale.set(targetH / (tex.height || targetH));
      container.addChild(sprite);
      topY = -targetH - this.tileH * 0.08;
      const bubbleTop = this.attachNamePlate(container, presence, topY);
      this.attachStatusBubble(id, container, presence?.local ?? false, bubbleTop);
      return container;
    }

    const g = this.newGraphics();
    const actorId = presence?.actorId ?? String(id);
    // cor da presença (hex) quando disponível; senão, tom quente estável do id.
    const paletteColor = ACTOR_PALETTE[hashString(actorId) % ACTOR_PALETTE.length] ?? ACTOR_PALETTE[0];
    const color =
      presence?.color && /^#?[0-9a-fA-F]{6}$/.test(presence.color)
        ? Number.parseInt(presence.color.replace("#", ""), 16)
        : paletteColor;

    const unit = Math.min(this.tileW, this.tileH);
    const bodyW = unit * 0.42;
    const bodyH = unit * 0.7;
    const headR = unit * 0.24;
    const outline = 0x1c2036;

    // sombra no chão (base do tile)
    g.ellipse(0, 0, bodyW * 0.7, bodyH * 0.22).fill({ color: 0x000000, alpha: 0.22 });
    // corpo (cápsula) apoiado sobre o chão
    g.roundRect(-bodyW / 2, -bodyH, bodyW, bodyH, bodyW / 2)
      .fill({ color, alpha: 1 })
      .stroke({ width: 1.5, color: outline, alpha: 0.85 });
    // cabeça
    g.circle(0, -bodyH - headR * 0.55, headR)
      .fill({ color: ACTOR_HEAD, alpha: 1 })
      .stroke({ width: 1.5, color: outline, alpha: 0.85 });
    container.addChild(g);
    topY = -(bodyH + headR * 1.6) - this.tileH * 0.08;
    const bubbleTop = this.attachNamePlate(container, presence, topY);
    this.attachStatusBubble(id, container, presence?.local ?? false, bubbleTop);
    return container;
  }

  /**
   * Plaquinha de nome/cargo acima do ator (sempre visível). O texto vem de
   * `presence.displayName` (dado do domínio, ex.: "CEO — Opera"); a engine só
   * desenha. Retorna o topo (y) para posicionar o balão de status acima dela.
   */
  private attachNamePlate(
    container: Container,
    presence: PresenceComponent | undefined,
    topY: number,
  ): number {
    const name = presence?.displayName;
    if (!name || !this.pixi) {
      return topY;
    }
    const local = presence?.local ?? false;
    const label = new this.pixi.Text({
      text: name,
      style: {
        fill: local ? 0xffffff : 0x3a2b20,
        fontSize: 11,
        fontFamily: "Segoe UI, system-ui, sans-serif",
        fontWeight: "700",
      },
    });
    label.anchor.set(0.5, 1);
    const padX = 7;
    const padY = 3;
    const w = label.width + padX * 2;
    const h = label.height + padY * 2;
    const bottom = topY - 2;
    const bg = this.newGraphics();
    bg.roundRect(-w / 2, bottom - h, w, h, h / 2)
      .fill({ color: local ? 0x2f6b8a : 0xfff6e6, alpha: 0.96 })
      .stroke({ width: 1, color: local ? 0x1c2036 : 0xb5623c, alpha: 0.5 });
    container.addChild(bg);
    label.position.set(0, bottom - padY);
    container.addChild(label);
    return bottom - h - 3;
  }

  /**
   * Balão sutil de "trabalhando" (três pontinhos) acima do ator. Só para atores
   * NÃO-locais; genérico (sem semântica de negócio — o domínio dá sentido).
   */
  private attachStatusBubble(id: EntityId, container: Container, local: boolean, topY: number): void {
    if (local) {
      return;
    }
    const bubble = new this.pixi!.Container();
    bubble.position.set(0, topY);
    bubble.visible = false;
    const g = this.newGraphics();
    const w = 22;
    const h = 14;
    g.roundRect(-w / 2, -h, w, h, 7).fill({ color: 0xfff6e6, alpha: 0.96 }).stroke({ width: 1, color: 0xb5623c, alpha: 0.45 });
    g.poly([-3, -1, 3, -1, 0, 5]).fill({ color: 0xfff6e6, alpha: 0.96 });
    const dot = 0x8a6b4a;
    g.circle(-6, -h / 2, 1.8).fill({ color: dot, alpha: 1 });
    g.circle(0, -h / 2, 1.8).fill({ color: dot, alpha: 1 });
    g.circle(6, -h / 2, 1.8).fill({ color: dot, alpha: 1 });
    bubble.addChild(g);
    container.addChild(bubble);
    this.actorBubbles.set(id, bubble);
  }

  /**
   * Sistema básico de câmera: centraliza no mapa, aplica zoom de fit e define
   * os limites de pan (clamp) + faixa de zoom. Genérico (sem regra de negócio).
   */
  private frameCamera(): void {
    if (!this.worldRoot || !this.viewport) {
      return;
    }
    const bounds = this.worldRoot.getLocalBounds();
    const vp = this.viewport;
    // Após o fit, sincroniza o zoom de jogo na câmera lógica (follow continua fluido).
    const framing = computeCameraFraming(
      { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      { width: vp.screenWidth, height: vp.screenHeight },
    );

    vp.worldWidth = Math.max(1, bounds.width);
    vp.worldHeight = Math.max(1, bounds.height);

    vp.clampZoom({ minScale: framing.minZoom, maxScale: framing.maxZoom });
    vp.clamp({
      left: framing.limits.left,
      right: framing.limits.right,
      top: framing.limits.top,
      bottom: framing.limits.bottom,
      underflow: "center",
    });
    // Aplica via câmera lógica → evita luta com o follow (mesmo canal de eventos).
    this.context?.camera.zoomTo(framing.zoom);
    this.context?.camera.moveTo(framing.center.x, framing.center.y);
  }
}
