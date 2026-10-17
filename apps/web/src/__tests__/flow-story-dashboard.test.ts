import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { bucketReason, computeDashboard } from "@/modules/flow-story/dashboard-stats";
import { decide, parseRun, replaceDraft, type ReviewRun } from "@/modules/flow-story/review-queue";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(HERE, "fixtures", "flow-story-rodada.json"), "utf8");

describe("Painel do andar Flow Story", () => {
  it("resume a rodada do CLI: funil, potencial, ranking e motivos", () => {
    const stats = computeDashboard(parseRun(FIXTURE));
    expect(stats.funnel.map((f) => f.value)).toEqual([3, 2, 8, 0]); // A/B: 2 produtos × 2 canais × 2 versões
    expect(stats.potentialCommission).toBe(15.78); // 10,79 + 4,99
    expect(stats.approvedCommission).toBe(0);
    expect(stats.ranking.map((r) => r.id)).toEqual(["x1", "x2"]);
    expect(stats.ranking[0]?.signals).toEqual(["Em alta", "Com desconto", "Loja top"]);
    expect(stats.reasons).toEqual([
      { id: "commission", label: "Comissão baixa", count: 1, examples: ["Tapete antiderrapante"] },
    ]);
    expect(stats.channels.map((c) => [c.channel, c.pending])).toEqual([
      ["instagram", 4],
      ["whatsapp", 4],
    ]);
    expect(stats.pendingLinks).toBe(2);
    expect(stats.aiShare).toBe(0);
  });

  it("atualiza ao aprovar: conta a comissão só dos produtos liberados", () => {
    let run: ReviewRun = parseRun(FIXTURE);
    const x1Draft = run.drafts.find((d) => d.productId === "x1")!;
    run = replaceDraft(run, decide(x1Draft, "APPROVED"));
    const stats = computeDashboard(run);
    expect(stats.approvedCommission).toBe(4.99);
    expect(stats.drafts.APPROVED).toBe(1);
    expect(stats.funnel.at(-1)?.value).toBe(1);
  });

  it("classifica cada motivo de recusa da Flow", () => {
    expect(bucketReason("nota 4.1 abaixo de 4.5").id).toBe("rating");
    expect(bucketReason("loja com nota 3.9 abaixo de 4.5").id).toBe("store");
    expect(bucketReason("poucas vendas (10)").id).toBe("sales");
    expect(bucketReason("fora do nicho (Moda)").id).toBe("niche");
    expect(bucketReason("ficou fora do top 5").id).toBe("top");
    expect(bucketReason("produto repetido").id).toBe("duplicate");
    expect(bucketReason("categoria cheia (Casa, max 2)").id).toBe("category");
    expect(bucketReason("comissao 2% abaixo de 5%").id).toBe("commission");
    expect(bucketReason("URL invalida").id).toBe("invalid");
  });
});
