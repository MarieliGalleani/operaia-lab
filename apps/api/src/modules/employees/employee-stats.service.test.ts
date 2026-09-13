import { describe, expect, it } from "vitest";
import { resolveConfidence } from "./employee-stats.service.js";

describe("resolveConfidence", () => {
  it("retorna SEM_DADOS com amostra menor que o minimo", () => {
    expect(resolveConfidence(2, 1)).toBe("SEM_DADOS");
    expect(resolveConfidence(0, null)).toBe("SEM_DADOS");
  });

  it("retorna CONFIANTE com amostra suficiente e taxa de sucesso alta", () => {
    expect(resolveConfidence(10, 0.9)).toBe("CONFIANTE");
    expect(resolveConfidence(5, 0.8)).toBe("CONFIANTE");
  });

  it("retorna PRECISA_REVISAO com amostra suficiente mas taxa de sucesso baixa", () => {
    expect(resolveConfidence(10, 0.5)).toBe("PRECISA_REVISAO");
    expect(resolveConfidence(4, 0.79)).toBe("PRECISA_REVISAO");
  });

  it("nunca retorna CONFIANTE sem successRate, mesmo com amostra grande", () => {
    expect(resolveConfidence(50, null)).toBe("SEM_DADOS");
  });
});
