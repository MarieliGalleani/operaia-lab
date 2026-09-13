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

/** Mapeia o registro do Prisma para o formato exposto na API (fallbackStagesJson -> fallbackStages). */
export function toApiCampaign(campaign: MarketingCampaign): Omit<MarketingCampaign, "fallbackStagesJson"> & {
  fallbackStages: string[];
} {
  const { fallbackStagesJson, ...rest } = campaign;
  return {
    ...rest,
    fallbackStages: Array.isArray(fallbackStagesJson) ? (fallbackStagesJson as string[]) : [],
  };
}

export function stripCodeFence(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```[a-zA-Z]*\n([\s\S]*)\n```$/);
  return fenced ? fenced[1]!.trim() : trimmed;
}

/** Normaliza o texto do nicho para deduplicar grafias levemente diferentes do mesmo setor. */
function slugifyNiche(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Encontra ou cria o Nicho correspondente ao texto digitado, agrupando campanhas do mesmo setor. */
async function resolveNicheId(nicheText: string): Promise<string> {
  const slug = slugifyNiche(nicheText);
  const niche = await prisma.niche.upsert({
    where: { slug },
    update: {},
    create: { name: nicheText.trim(), slug },
  });
  return niche.id;
}

export interface NicheSummary {
  readonly id: string;
  readonly name: string;
  readonly campaignCount: number;
}

export async function listNiches(): Promise<readonly NicheSummary[]> {
  const niches = await prisma.niche.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { campaigns: true } } },
  });
  return niches.map((niche) => ({
    id: niche.id,
    name: niche.name,
    campaignCount: niche._count.campaigns,
  }));
}

export async function createCampaign(input: {
  niche: string;
  briefing: string;
  attachmentName?: string;
  attachmentMimeType?: string;
  attachmentBase64?: string;
}): Promise<MarketingCampaign> {
  const nicheId = await resolveNicheId(input.niche);
  const campaign = await prisma.marketingCampaign.create({
    data: {
      niche: input.niche,
      nicheId,
      briefing: input.briefing,
      attachmentName: input.attachmentName,
      attachmentMimeType: input.attachmentMimeType,
      attachmentBase64: input.attachmentBase64,
    },
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

export interface MarketingAttachment {
  readonly name: string;
  readonly mimeType: string;
  readonly base64: string;
}

export async function getCampaignAttachment(id: string): Promise<MarketingAttachment | null> {
  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id },
    select: { attachmentName: true, attachmentMimeType: true, attachmentBase64: true },
  });
  if (!campaign?.attachmentBase64 || !campaign.attachmentMimeType) return null;
  return {
    name: campaign.attachmentName ?? "anexo",
    mimeType: campaign.attachmentMimeType,
    base64: campaign.attachmentBase64,
  };
}

/**
 * Roda as etapas do Mercurio em sequencia, persistindo o resultado de
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

      const data: Record<string, unknown> = { [field]: stripCodeFence(completion.content) };
      if (completion.model === "deterministic") {
        const priorFallbacks = Array.isArray(campaign.fallbackStagesJson)
          ? (campaign.fallbackStagesJson as string[])
          : [];
        data.fallbackStagesJson = [...priorFallbacks, stage];
      }

      await prisma.marketingCampaign.update({
        where: { id: campaignId },
        data,
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
