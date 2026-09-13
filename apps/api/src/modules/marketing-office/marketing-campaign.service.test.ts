import { describe, expect, it } from "vitest";
import { stripCodeFence } from "./marketing-campaign.service.js";

describe("stripCodeFence", () => {
  it("remove um bloco de codigo markdown envolvendo o conteudo", () => {
    const input = "```html\n<!doctype html><html></html>\n```";
    expect(stripCodeFence(input)).toBe("<!doctype html><html></html>");
  });

  it("remove bloco de codigo sem linguagem declarada", () => {
    const input = "```\nconteudo puro\n```";
    expect(stripCodeFence(input)).toBe("conteudo puro");
  });

  it("mantem o conteudo intacto quando nao ha cerca de codigo", () => {
    const input = "## Mapa de Nicho\nPublico-alvo: adultos 25-45";
    expect(stripCodeFence(input)).toBe(input);
  });

  it("apara espacos nas bordas mesmo sem cerca de codigo", () => {
    expect(stripCodeFence("  texto com espaco  \n")).toBe("texto com espaco");
  });
});
