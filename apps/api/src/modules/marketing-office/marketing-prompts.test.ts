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
