import { describe, expect, it } from "vitest";
import { cosineSimilarity } from "./gemini-embeddings-provider.js";

describe("cosineSimilarity", () => {
  it("vetores identicos = 1", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });

  it("vetores ortogonais = 0", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10);
  });

  it("vetores opostos = -1", () => {
    expect(cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1, 10);
  });

  it("tamanhos diferentes retorna 0 em vez de lancar", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
  });

  it("vetor vazio retorna 0 em vez de lancar", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("vetor nulo (todo zero) retorna 0 em vez de NaN", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });
});
