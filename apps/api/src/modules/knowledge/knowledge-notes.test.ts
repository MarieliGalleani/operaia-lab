import { describe, expect, it } from "vitest";
import { rankKnowledgeNotes } from "./knowledge-notes.js";

describe("rankKnowledgeNotes (Base de conhecimento na memoria da missao)", () => {
  const d = (s: string) => new Date(s);
  it("traz primeiro o que tem a ver com o pedido", () => {
    const notes = rankKnowledgeNotes("melhorar o README para novos colaboradores", [
      { title: "Padrao de commits", content: "Usar conventional commits.", updatedAt: d("2026-10-19") },
      { title: "Onboarding", content: "Novos colaboradores devem ler o README e docs/architecture.", updatedAt: d("2026-09-01") },
    ]);
    expect(notes[0]).toContain("Onboarding");
    expect(notes[0]!.startsWith("[CONHECIMENTO]")).toBe(true);
  });

  it("limita a 3 notas e corta textos longos", () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ title: `Nota ${i}`, content: "x".repeat(2000), updatedAt: d(`2026-10-0${i + 1}`) }));
    const notes = rankKnowledgeNotes("qualquer", items);
    expect(notes).toHaveLength(3);
    expect(notes[0]!.length).toBeLessThan(700);
  });
});
