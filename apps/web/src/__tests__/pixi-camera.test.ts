import { describe, expect, it } from "vitest";

import { computeCameraFraming } from "@/modules/virtual-world/engines/pixi/camera-framing";

describe("computeCameraFraming — sistema básico de câmera", () => {
  it("centraliza no centro do mapa (inclui origem negativa do iso)", () => {
    const framing = computeCameraFraming(
      { x: -400, y: 0, width: 800, height: 600 },
      { width: 1000, height: 800 },
    );
    expect(framing.center).toEqual({ x: 0, y: 300 });
  });

  it("faz fit do mapa dentro da tela quando playZoom não sobe o zoom", () => {
    const world = { x: 0, y: 0, width: 1000, height: 500 };
    const screen = { width: 800, height: 600 };
    // playZoom baixo: permanece no fit clássico
    const framing = computeCameraFraming(world, screen, { playZoom: 0.1 });

    expect(framing.zoom).toBeLessThanOrEqual(
      Math.min(screen.width / world.width, screen.height / world.height),
    );
    expect(framing.zoom * world.width).toBeLessThanOrEqual(screen.width);
    expect(framing.zoom * world.height).toBeLessThanOrEqual(screen.height);
    expect(framing.zoom).toBeGreaterThanOrEqual(framing.minZoom);
  });

  it("preferência de playZoom aproxima a câmera (estilo simulação)", () => {
    const world = { x: 0, y: 0, width: 2000, height: 1500 };
    const screen = { width: 800, height: 600 };
    const framing = computeCameraFraming(world, screen, { playZoom: 1.35 });
    const zoomFit =
      Math.min(screen.width / world.width, screen.height / world.height) * 0.95;
    expect(framing.zoom).toBeGreaterThan(zoomFit);
    expect(framing.zoom).toBeCloseTo(1.35, 5);
  });

  it("limita o zoom máximo em mapas pequenos", () => {
    const framing = computeCameraFraming(
      { x: 0, y: 0, width: 10, height: 10 },
      { width: 1000, height: 1000 },
      { maxZoom: 4 },
    );
    expect(framing.zoom).toBe(4);
    expect(framing.maxZoom).toBe(4);
  });

  it("define limites de pan que englobam o mundo com padding", () => {
    const world = { x: -100, y: 50, width: 400, height: 200 };
    const framing = computeCameraFraming(world, { width: 800, height: 600 }, { boundsPadding: 32 });

    expect(framing.limits.left).toBe(world.x - 32);
    expect(framing.limits.right).toBe(world.x + world.width + 32);
    expect(framing.limits.top).toBe(world.y - 32);
    expect(framing.limits.bottom).toBe(world.y + world.height + 32);
    // os limites contêm o mundo inteiro
    expect(framing.limits.left).toBeLessThanOrEqual(world.x);
    expect(framing.limits.right).toBeGreaterThanOrEqual(world.x + world.width);
  });

  it("nunca deixa minZoom acima do maxZoom", () => {
    const framing = computeCameraFraming(
      { x: 0, y: 0, width: 5, height: 5 },
      { width: 1000, height: 1000 },
      { maxZoom: 3 },
    );
    expect(framing.minZoom).toBeLessThanOrEqual(framing.maxZoom);
  });

  it("é robusto com mundo degenerado (sem NaN)", () => {
    const framing = computeCameraFraming(
      { x: 0, y: 0, width: 0, height: 0 },
      { width: 800, height: 600 },
    );
    expect(Number.isFinite(framing.zoom)).toBe(true);
    expect(framing.zoom).toBe(1);
    expect(Number.isFinite(framing.center.x)).toBe(true);
  });
});
