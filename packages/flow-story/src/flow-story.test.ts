import type { LLMCompletion, LLMMessage, LLMProvider } from "@operaia/ai-core";
import { describe, expect, it } from "vitest";
import {
  AFFILIATE_DISCLOSURE,
  CHANNEL_MAX_CHARS,
  FlowRobot,
  ManualAffiliateLinkProvider,
  checkStoryText,
  anglesFor,
  DEFAULT_POST_TIMES,
  scoreProduct,
  flowProfile,
  parseProductsCsv,
  reviewDraft,
  runFlowStory,
  storyProfile,
  type AffiliateLinkProvider,
  type FlowStoryConfig,
  type ProductCandidate,
} from "./index.js";

class StubLLM implements LLMProvider {
  readonly name = "stub";
  readonly calls: LLMMessage[][] = [];
  constructor(private readonly content: string | Error) {}
  async complete(messages: readonly LLMMessage[]): Promise<LLMCompletion> {
    this.calls.push([...messages]);
    if (this.content instanceof Error) throw this.content;
    return { content: this.content, model: "stub" };
  }
}

const trackedLinks: AffiliateLinkProvider = {
  name: "tracked",
  async createLink({ productUrl, subId }) {
    return { url: `https://s.example/${subId}?u=${encodeURIComponent(productUrl)}`, pending: false };
  },
};

function product(overrides: Partial<ProductCandidate> = {}): ProductCandidate {
  return {
    id: "p1",
    title: "Organizador de gaveta 6 divisórias",
    url: "https://loja.example/produto/p1",
    price: 49.9,
    commissionRate: 0.1,
    rating: 4.8,
    soldCount: 3200,
    category: "Casa",
    storeRating: 4.9,
    ...overrides,
  };
}

const config: FlowStoryConfig = {
  niche: "casa e organização",
  categories: ["casa"],
  channels: ["instagram", "whatsapp"],
};

describe("Flow Story — elenco", () => {
  it("Flow é o Robô de Ofertas e Story é a Escritora", () => {
    expect(flowProfile.id).toBe("flow");
    expect(flowProfile.role).toBe("Robô de Ofertas");
    expect(storyProfile.id).toBe("story");
    expect(storyProfile.role).toBe("Escritora");
  });
});

describe("Flow — curadoria", () => {
  it("filtra por nicho, nota, loja, vendas e comissão, explicando o motivo", async () => {
    const flow = new FlowRobot(new ManualAffiliateLinkProvider());
    const { curated, rejected } = await flow.curate(
      [
        product(),
        product({ id: "p2", url: "https://loja.example/p2", category: "Moda" }),
        product({ id: "p3", url: "https://loja.example/p3", rating: 4.1 }),
        product({ id: "p4", url: "https://loja.example/p4", storeRating: 3.9 }),
        product({ id: "p5", url: "https://loja.example/p5", soldCount: 10 }),
        product({ id: "p6", url: "https://loja.example/p6", commissionRate: 0.02 }),
        product({ id: "p7", url: "https://loja.example/produto/p1?ref=x" }),
        product({ id: "p8", url: "nao-e-url" }),
      ],
      config,
    );
    expect(curated.map((c) => c.product.id)).toEqual(["p1"]);
    expect(curated[0]?.linkPending).toBe(true);
    expect(curated[0]?.estimatedCommission).toBe(4.99);
    const reasons = Object.fromEntries(rejected.map((r) => [r.productId, r.reason]));
    expect(reasons.p2).toMatch(/fora do nicho/);
    expect(reasons.p3).toMatch(/nota 4.1/);
    expect(reasons.p4).toMatch(/loja/);
    expect(reasons.p5).toMatch(/poucas vendas/);
    expect(reasons.p6).toMatch(/comissao/);
    expect(reasons.p7).toMatch(/repetido/);
    expect(reasons.p8).toMatch(/URL invalida/);
  });

  it("ordena pela pontuação e respeita o máximo de produtos", async () => {
    const flow = new FlowRobot(trackedLinks);
    const { curated, rejected } = await flow.curate(
      [
        product({ id: "a", url: "https://loja.example/a", price: 30, commissionRate: 0.06 }),
        product({ id: "b", url: "https://loja.example/b", price: 200, commissionRate: 0.12 }),
        product({ id: "c", url: "https://loja.example/c", price: 80, commissionRate: 0.08 }),
      ],
      { ...config, maxProducts: 2 },
      "out26",
    );
    expect(curated.map((c) => c.product.id)).toEqual(["b", "c"]);
    expect(curated[0]?.score).toBeGreaterThan(curated[1]!.score);
    expect(curated[0]?.affiliateUrl).toContain("out26-b");
    expect(curated[0]?.linkPending).toBe(false);
    expect(rejected.find((r) => r.productId === "a")?.reason).toMatch(/top 2/);
  });
});

describe("Story — guardrails", () => {
  it("bloqueia promessa proibida e preço inventado", () => {
    const curated = {
      product: product(),
      score: 80,
      estimatedCommission: 4.99,
      reasons: [],
      affiliateUrl: "https://s.example/x",
      linkPending: false,
      signals: [],
    };
    expect(checkStoryText("Qualidade garantida!", curated)).toMatch(/proibida/);
    expect(checkStoryText("Corre que é só hoje", curated)).toMatch(/proibida/);
    expect(checkStoryText("Sai por R$ 39,90", curated)).toMatch(/diferente do real/);
    expect(checkStoryText("Sai por R$ 49,90 com nota 4.8", curated)).toBeNull();
  });
});

describe("Pipeline Flow -> Story -> aprovação", () => {
  it("gera um rascunho por produto e canal, sempre aguardando aprovação", async () => {
    const llm = new StubLLM(
      JSON.stringify({ text: "Gaveta bagunçada nunca mais! Por R$ 49,90.", hashtags: ["organização", "casa"] }),
    );
    const run = await runFlowStory({ products: [product()], config, llm, links: trackedLinks });

    expect(run.drafts).toHaveLength(4); // 1 produto × 2 canais × versões A e B
    for (const draft of run.drafts) {
      expect(draft.status).toBe("PENDING_APPROVAL");
      expect(draft.source).toBe("llm");
      expect(draft.text).toContain(AFFILIATE_DISCLOSURE);
      expect(draft.text).toContain(draft.affiliateUrl);
      expect(draft.text.length).toBeLessThanOrEqual(CHANNEL_MAX_CHARS[draft.channel]);
    }
    expect(run.drafts[0]?.hashtags).toContain("#organizacao");
    const system = llm.calls[0]?.[0]?.content ?? "";
    expect(system).toContain("Story");
    expect(system).toContain("casa e organização");
  });

  it("usa o template seguro quando o LLM viola regra ou falha", async () => {
    const bad = await runFlowStory({
      products: [product()],
      config: { ...config, channels: ["whatsapp"] },
      llm: new StubLLM(JSON.stringify({ text: "Melhor preço do Brasil, garantido!" })),
    });
    expect(bad.drafts[0]?.source).toBe("template");
    expect(bad.drafts[0]?.text).toContain("R$ 49,90");

    const down = await runFlowStory({
      products: [product()],
      config: { ...config, channels: ["tiktok"] },
      llm: new StubLLM(new Error("timeout")),
    });
    expect(down.drafts[0]?.source).toBe("template");
    expect(down.drafts[0]?.text).toContain("[Gancho]");
  });

  it("exige canal declarado", async () => {
    await expect(
      runFlowStory({ products: [product()], config: { ...config, channels: [] }, llm: new StubLLM("{}") }),
    ).rejects.toThrow(/canal/);
  });

  it("aprovação humana não deixa tirar o aviso de afiliado nem revisar duas vezes", async () => {
    const run = await runFlowStory({
      products: [product()],
      config: { ...config, channels: ["telegram"] },
      llm: new StubLLM("sem json"),
    });
    const draft = run.drafts[0]!;
    expect(() => reviewDraft(draft, "APPROVED", "Texto sem aviso")).toThrow(/aviso/);
    const approved = reviewDraft(draft, "APPROVED");
    expect(approved.status).toBe("APPROVED");
    expect(draft.status).toBe("PENDING_APPROVAL");
    expect(() => reviewDraft(approved, "REJECTED")).toThrow(/ja foi revisado/);
  });
});

describe("Táticas de vendedor", () => {
  it("Flow detecta produto em alta, desconto, campeão e loja top — e pontua mais alto", async () => {
    const hot = product({
      id: "hot",
      url: "https://loja.example/hot",
      soldCount: 6000,
      soldLast30Days: 2400,
      originalPrice: 79.9,
    });
    const flow = new FlowRobot(new ManualAffiliateLinkProvider());
    const { curated } = await flow.curate([product(), hot], config);
    expect(curated[0]?.product.id).toBe("hot");
    expect(curated[0]?.signals).toEqual(["em-alta", "desconto", "campeao", "loja-top"]);
    expect(curated[0]?.reasons.join(" ")).toMatch(/2400 vendidos nos ultimos 30 dias/);
    expect(curated[0]?.reasons.join(" ")).toMatch(/de desconto/);
    expect(scoreProduct(hot)).toBeGreaterThan(scoreProduct(product()));
  });

  it("Flow varia as categorias (no máximo 2 por categoria)", async () => {
    const flow = new FlowRobot(new ManualAffiliateLinkProvider());
    const casa = [1, 2, 3].map((n) => product({ id: `c${n}`, url: `https://loja.example/c${n}` }));
    const cozinha = product({ id: "k1", url: "https://loja.example/k1", category: "Cozinha", price: 30 });
    const { curated, rejected } = await flow.curate([...casa, cozinha], {
      ...config,
      categories: ["casa", "cozinha"],
    });
    expect(curated.map((c) => c.product.id).sort()).toEqual(["c1", "c2", "k1"]);
    expect(rejected.find((r) => r.productId === "c3")?.reason).toMatch(/categoria cheia/);
  });

  it("escolhe o ângulo pelo sinal: em alta → oferta; sem sinal → prova social → problema", () => {
    const base = {
      score: 80,
      estimatedCommission: 5,
      reasons: [],
      affiliateUrl: "https://x.example",
      linkPending: true,
    };
    expect(anglesFor({ ...base, product: product(), signals: ["em-alta", "desconto"] })).toEqual([
      "em-alta",
      "oferta",
    ]);
    expect(anglesFor({ ...base, product: product(), signals: [] })).toEqual([
      "prova-social",
      "dor-solucao",
    ]);
    expect(anglesFor({ ...base, product: product({ rating: 4.5 }), signals: [] })).toEqual([
      "dor-solucao",
      "curiosidade",
    ]);
  });

  it("teste A/B: versões com ângulo, horário e subId próprios", async () => {
    const llm = new StubLLM(JSON.stringify({ text: "Nota 4.8 e mais de 3200 vendidos!" }));
    const run = await runFlowStory({
      products: [product()],
      config: { ...config, channels: ["instagram"] },
      llm,
      links: trackedLinks,
      campaignId: "out26",
    });
    const [a, b] = run.drafts;
    expect([a?.variant, b?.variant]).toEqual(["A", "B"]);
    expect(a?.angle).toBe("prova-social");
    expect(b?.angle).toBe("dor-solucao");
    expect([a?.suggestedTime, b?.suggestedTime]).toEqual(DEFAULT_POST_TIMES.instagram);
    expect(a?.trackingSubId).toBe("out26-p1-instagram-A");
    expect(b?.affiliateUrl).toContain("out26-p1-instagram-B");
    expect(llm.calls[0]?.[1]?.content).toMatch(/Angulo: Prova social/);
    expect(llm.calls[1]?.[1]?.content).toMatch(/Angulo: Problema/);
  });

  it("com A/B desligado sai uma versão só", async () => {
    const run = await runFlowStory({
      products: [product()],
      config: { ...config, channels: ["whatsapp"] },
      llm: new StubLLM("{}"),
      abTest: false,
    });
    expect(run.drafts.map((d) => d.variant)).toEqual(["A"]);
  });

  it("texto de oferta pode citar o preço de antes, mas não um preço inventado", () => {
    const curated = {
      product: product({ originalPrice: 79.9 }),
      score: 80,
      estimatedCommission: 4.99,
      reasons: [],
      affiliateUrl: "https://s.example/x",
      linkPending: false,
      signals: ["desconto" as const],
    };
    expect(checkStoryText("De R$ 79,90 por R$ 49,90", curated)).toBeNull();
    expect(checkStoryText("De R$ 99,90 por R$ 49,90", curated)).toMatch(/diferente do real/);
  });
});

describe("Importação de CSV", () => {
  it("lê cabeçalhos em português, separador ; e números brasileiros", () => {
    const csv = [
      "id;Título;Link;Preço;Comissão;Nota;Vendidos;Categoria;Nota loja",
      'x1;"Garrafa térmica 1L; inox";https://loja.example/x1;R$ 1.299,90;12%;4,7;1.500;Casa;4,8',
    ].join("\n");
    const [p] = parseProductsCsv(csv);
    expect(p).toEqual({
      id: "x1",
      title: "Garrafa térmica 1L; inox",
      url: "https://loja.example/x1",
      price: 1299.9,
      commissionRate: 0.12,
      rating: 4.7,
      soldCount: 1500,
      category: "Casa",
      storeRating: 4.8,
    });
  });
});
