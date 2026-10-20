import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: Array<{ method: string; path: string }> = [];
vi.mock("@/data/adapters/http-client", () => ({
  createHttpClient: () => ({
    get: async (path: string) => {
      calls.push({ method: "GET", path });
      return { runId: "11111111-1111-1111-1111-111111111111", saved: true, run: { curated: [], rejected: [], drafts: [] } };
    },
    post: async (path: string) => {
      calls.push({ method: "POST", path });
      await new Promise((r) => setTimeout(r, 30));
      return { runId: "22222222-2222-2222-2222-222222222222" };
    },
    put: async (path: string) => {
      calls.push({ method: "PUT", path });
      return {};
    },
    patch: async () => ({}),
    delete: async () => ({}),
  }),
}));

import { importRun, latestRun, pushRun, syncState } from "./run-sync";

const run = { curated: [], rejected: [], drafts: [] };

describe("Store Flow salvo no servidor", () => {
  beforeEach(() => {
    calls.length = 0;
    vi.useRealTimers();
  });

  it("carrega a última rodada do servidor", async () => {
    const r = await latestRun();
    expect(r?.drafts).toEqual([]);
    expect(syncState.value).toBe("saved");
  });

  it("aprovação grava na rodada atual", async () => {
    await latestRun();
    pushRun(run);
    await new Promise((r) => setTimeout(r, 700));
    expect(calls.at(-1)).toEqual({ method: "PUT", path: "/store-flow/runs/11111111-1111-1111-1111-111111111111" });
  });

  it("importar .json nunca sobrescreve a rodada anterior", async () => {
    await latestRun();
    pushRun(run); // edicao pendente na rodada antiga
    const p = importRun(run);
    pushRun(run); // watch disparado durante a importacao
    await p;
    await new Promise((r) => setTimeout(r, 700));
    const puts = calls.filter((c) => c.method === "PUT").map((c) => c.path);
    expect(puts.every((x) => !x.endsWith("1111-111111111111"))).toBe(true);
    expect(calls.some((c) => c.method === "POST" && c.path === "/store-flow/runs/import")).toBe(true);
  });
});
