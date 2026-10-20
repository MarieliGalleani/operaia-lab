import { describe, expect, it } from "vitest";
import { renderChatText } from "./chat-text";

describe("renderChatText", () => {
  it("escapa HTML vindo da IA", () => {
    const html = renderChatText('<img src=x onerror="alert(1)"> oi');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
  it("entende negrito e listas", () => {
    const html = renderChatText("**2 aprovações** esperando\n- Podiário\n- Cardápio\nfim");
    expect(html).toBe("<p><strong>2 aprovações</strong> esperando</p><ul><li>Podiário</li><li>Cardápio</li></ul><p>fim</p>");
  });
  it("títulos markdown viram negrito", () => {
    expect(renderChatText("## Resumo")).toBe("<p><strong>Resumo</strong></p>");
  });
});
