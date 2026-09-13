import { createLLMStack, type LLMProvider, type LLMStackConfig } from "@operaia/ai-core";
import { prisma } from "@operaia/database";
import { env } from "../../config/env.js";
import { buildStageMessages } from "./marketing-prompts.js";
import {
  MARKETING_STAGE_FIELD,
  MARKETING_STAGE_ORDER,
  type MarketingCampaign,
} from "./marketing-office.types.js";

let cachedLlm: LLMProvider | null = null;

/** Stack de LLM dedicado ao Mercurio — mesma config do stack principal (lab-runtime),
 * instanciado a parte para nao acoplar este modulo ao boot inteiro da equipe digital. */
function getLlm(): LLMProvider {
  if (cachedLlm) return cachedLlm;
  const config: LLMStackConfig = {
    provider: env.LLM_PROVIDER,
    model: env.LLM_MODEL,
    geminiApiKey: env.GEMINI_API_KEY,
    openaiApiKey: env.OPENAI_API_KEY,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    openRouterApiKey: env.OPENROUTER_API_KEY,
    maxTokensClamp: env.LLM_MAX_TOKENS_CLAMP,
    enableConsoleObservability: env.LLM_OBSERVABILITY,
  };
  cachedLlm = createLLMStack(config);
  return cachedLlm;
}

export function stripCodeFence(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```[a-zA-Z]*\n([\s\S]*)\n```$/);
  return fenced ? fenced[1]!.trim() : trimmed;
}

export async function createCampaign(input: {
  niche: string;
  briefing: string;
}): Promise<MarketingCampaign> {
  const campaign = await prisma.marketingCampaign.create({
    data: { niche: input.niche, briefing: input.briefing },
  });
  void runPipeline(campaign.id).catch((error) => {
    console.error("[marketing-office] pipeline falhou de forma inesperada", error);
  });
  return campaign;
}

export async function listCampaigns(): Promise<readonly MarketingCampaign[]> {
  return prisma.marketingCampaign.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getCampaignById(id: string): Promise<MarketingCampaign | null> {
  return prisma.marketingCampaign.findUnique({ where: { id } });
}

/**
 * Roda as 6 etapas do Mercurio em sequencia, persistindo o resultado de
 * cada uma assim que fica pronta — a tela pode ir mostrando ao vivo por
 * polling, sem esperar a campanha inteira terminar.
 */
async function runPipeline(campaignId: string): Promise<void> {
  const llm = getLlm();
  await prisma.marketingCampaign.update({
    where: { id: campaignId },
    data: { status: "RUNNING" },
  });

  try {
    for (const stage of MARKETING_STAGE_ORDER) {
      await prisma.marketingCampaign.update({
        where: { id: campaignId },
        data: { currentStage: stage },
      });

      const campaign = await prisma.marketingCampaign.findUniqueOrThrow({
        where: { id: campaignId },
      });
      const messages = buildStageMessages(stage, campaign);
      const completion = await llm.complete(messages, { temperature: 0.7 });
      const field = MARKETING_STAGE_FIELD[stage];

      await prisma.marketingCampaign.update({
        where: { id: campaignId },
        data: { [field]: stripCodeFence(completion.content) },
      });
    }

    await prisma.marketingCampaign.update({
      where: { id: campaignId },
      data: { status: "DONE", currentStage: null },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida no pipeline.";
    await prisma.marketingCampaign.update({
      where: { id: campaignId },
      data: { status: "ERROR", errorMessage: message },
    });
  }
}
