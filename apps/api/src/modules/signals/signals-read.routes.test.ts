import { describe, expect, it } from "vitest";
import { summarizePayload } from "./signals-read.routes.js";

describe("summarizePayload (aba Sinais)", () => {
  it("usa o titulo direto do payload", () => {
    expect(summarizePayload("pr.opened", { title: "Corrige login" })).toBe("Corrige login");
  });

  it("procura dentro de pull_request/issue", () => {
    expect(summarizePayload("pr.opened", { pull_request: { title: "Novo fluxo" } })).toBe("Novo fluxo");
  });

  it("corta textos longos em 160 caracteres", () => {
    expect(summarizePayload("x", { message: "a".repeat(300) })).toHaveLength(160);
  });

  it("cai no tipo quando nao ha texto", () => {
    expect(summarizePayload("build.failed", { count: 2 })).toBe("build.failed");
    expect(summarizePayload("build.failed", null)).toBe("build.failed");
  });
});
