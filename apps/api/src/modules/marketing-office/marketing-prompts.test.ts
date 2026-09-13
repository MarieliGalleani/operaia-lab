import { describe, expect, it } from "vitest";
import { buildStageMessages } from "./marketing-prompts.js";
import type { MarketingCampaign } from "./marketing-office.types.js";

function baseCampaign(overrides: Partial<MarketingCampaign> = {}): MarketingCampaign {
  return {
    id: "camp-1",
    niche: "dermatologia",
    briefing: "foco em agenda cheia via IA",
    status: "RUNNING",
    currentStage: "MAPA_NICHO",
    nicheMap: null,
    creatives: null,
    landingPageHtml: null,
    pitchDeck: null,
    gtmPlan: null,
    salesPlaybook: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as MarketingCampaign;
}

describe("buildStageMessages", () => {
  it("inclui o briefing e o nicho na primeira etapa", () => {
    const messages = buildStageMessages("MAPA_NICHO", baseCampaign());
    expect(messages[0]!.role).toBe("system");
    expect(messages[1]!.content).toContain("dermatologia");
    expect(messages[1]!.content).toContain("foco em agenda cheia via IA");
    expect(messages[1]!.content).toContain("Mapa de Nicho");
  });

  it("pede HTML puro (sem markdown) na etapa de landing page", () => {
    const messages = buildStageMessages(
      "LANDING_PAGE",
      baseCampaign({ nicheMap: "## Publico-alvo\nAdultos 25-45" }),
    );
    expect(messages[1]!.content).toContain("HTML puro");
    expect(messages[1]!.content).toContain("Publico-alvo");
  });

  it("carrega o contexto das etapas anteriores nas etapas seguintes", () => {
    const messages = buildStageMessages(
      "PITCH_DECK",
      baseCampaign({
        nicheMap: "## Publico-alvo\nAdultos 25-45",
        creatives: "## Headline\nAgenda cheia pela pele tratada",
      }),
    );
    expect(messages[1]!.content).toContain("Mapa de Nicho (ja definido)");
    expect(messages[1]!.content).toContain("Agenda cheia pela pele tratada");
  });

  it("nao inclui secao de contexto quando nao ha etapas anteriores", () => {
    const messages = buildStageMessages("MAPA_NICHO", baseCampaign());
    expect(messages[1]!.content).not.toContain("Contexto ja produzido");
  });
});

describe("buildStageMessages — etapas novas (Fase 6)", () => {
  it("pede JSON de roteiro de video com gancho e cenas", () => {
    const messages = buildStageMessages(
      "VIDEO_ROTEIRO",
      baseCampaign({ creatives: "## Headline\nAgenda cheia pela pele tratada" }),
    );
    expect(messages[1]!.content).toContain("gancho");
    expect(messages[1]!.content).toContain("cenas");
  });

  it("pede plano de trafego com distribuicao percentual, nunca valor absoluto", () => {
    const messages = buildStageMessages("PLANO_TRAFEGO", baseCampaign());
    expect(messages[1]!.content).toContain("percentual");
    expect(messages[1]!.content).toContain("nunca invente valor absoluto");
  });

  it("framework de performance nunca pede numero real de campanha", () => {
    const messages = buildStageMessages("FRAMEWORK_PERFORMANCE", baseCampaign());
    expect(messages[1]!.content).toContain("nunca invente numero de uma campanha");
  });
});

describe("buildStageMessages — anexo do briefing", () => {
  it("anexa imagem como LLMImageAttachment quando o mimetype e image/*", () => {
    const messages = buildStageMessages(
      "MAPA_NICHO",
      baseCampaign({ attachmentName: "logo.png", attachmentMimeType: "image/png", attachmentBase64: "ZmFrZQ==" }),
    );
    expect(messages[1]!.images).toEqual([{ mimeType: "image/png", base64: "ZmFrZQ==" }]);
  });

  it("decodifica anexo de texto puro direto no prompt", () => {
    const texto = Buffer.from("Publico ja pesquisado: mulheres 30-45").toString("base64");
    const messages = buildStageMessages(
      "MAPA_NICHO",
      baseCampaign({ attachmentName: "notas.txt", attachmentMimeType: "text/plain", attachmentBase64: texto }),
    );
    expect(messages[1]!.content).toContain("Publico ja pesquisado: mulheres 30-45");
    expect(messages[1]!.images).toBeUndefined();
  });

  it("sem anexo, nao ha campo images nem nota de anexo", () => {
    const messages = buildStageMessages("MAPA_NICHO", baseCampaign());
    expect(messages[1]!.images).toBeUndefined();
    expect(messages[1]!.content).not.toContain("anexou");
  });
});
