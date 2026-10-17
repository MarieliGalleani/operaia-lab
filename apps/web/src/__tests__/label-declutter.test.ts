import { describe, expect, it } from "vitest";

import { declutterPlates, type PlateRect } from "@/modules/virtual-world/engines/pixi/label-declutter";

const plate = (id: string, x: number, bottom: number, width = 100, height = 20): PlateRect => ({
  id,
  x,
  bottom,
  width,
  height,
});

describe("declutterPlates — plaquinhas de nome sem sobreposição", () => {
  it("não move plaquinhas que não colidem", () => {
    const offsets = declutterPlates([plate("a", 0, 100), plate("b", 300, 100)]);
    expect(offsets.get("a")).toBe(0);
    expect(offsets.get("b")).toBe(0);
  });

  it("o ator da frente (maior y) mantém a posição e o de trás sobe", () => {
    const offsets = declutterPlates([plate("back", 10, 90), plate("front", 0, 100)]);
    expect(offsets.get("front")).toBe(0);
    expect(offsets.get("back")).toBeLessThan(0);
  });

  it("empilha três plaquinhas sobrepostas sem colisão entre si", () => {
    const plates = [plate("a", 0, 100), plate("b", 5, 98), plate("c", -5, 96)];
    const offsets = declutterPlates(plates);
    const tops = plates.map((p) => (offsets.get(p.id) ?? 0) + p.bottom);
    const sorted = [...tops].sort((x, y) => x - y);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThanOrEqual(20);
    }
  });

  it("é determinístico independentemente da ordem de entrada", () => {
    const a = plate("a", 0, 100);
    const b = plate("b", 5, 100);
    expect(declutterPlates([a, b])).toEqual(declutterPlates([b, a]));
  });
});
