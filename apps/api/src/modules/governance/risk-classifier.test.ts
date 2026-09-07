import { describe, expect, it } from "vitest";
import { detectActionRisk } from "./risk-classifier.js";

describe("detectActionRisk", () => {
  it("classifica CRITICAL para termos de producao/credenciais", () => {
    expect(detectActionRisk("Fazer deploy em produção")).toBe("CRITICAL");
    expect(detectActionRisk("Remover a senha do usuário")).toBe("CRITICAL");
    expect(detectActionRisk("rotate secret token")).toBe("CRITICAL");
  });

  it("classifica HIGH para termos de infra/dados sem ser critico", () => {
    expect(detectActionRisk("Rodar migration no banco de dados")).toBe("HIGH");
    expect(detectActionRisk("revisar payment gateway")).toBe("HIGH");
  });

  it("classifica MEDIUM para texto longo sem palavras-chave", () => {
    expect(detectActionRisk("a".repeat(401))).toBe("MEDIUM");
  });

  it("classifica LOW para texto curto e benigno", () => {
    expect(detectActionRisk("Revisar o estado operacional do workspace")).toBe("LOW");
  });
});
