import { createLLMStack, type LLMProvider, type LLMStackConfig } from "@operaia/ai-core";
import { prisma } from "@operaia/database";
import { env } from "../../config/env.js";
import { buildStageMessages } from "./marketing-prompts.js";
import { recallNicheMemory, recordNicheMemory } from "./niche-memory-store.js";
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

type CampaignWithClient = MarketingCampaign & { client: { name: string } | null };

/** Mapeia o registro do Prisma para o formato exposto na API (fallbackStagesJson -> fallbackStages,
 * client -> clientName). */
export function toApiCampaign(campaign: CampaignWithClient): Omit<MarketingCampaign, "fallbackStagesJson"> & {
  fallbackStages: string[];
  clientName: string | null;
} {
  const { fallbackStagesJson, client, ...rest } = campaign;
  return {
    ...rest,
    fallbackStages: Array.isArray(fallbackStagesJson) ? (fallbackStagesJson as string[]) : [],
    clientName: client?.name ?? null,
  };
}

export function stripCodeFence(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```[a-zA-Z]*\n([\s\S]*)\n```$/);
  return fenced ? fenced[1]!.trim() : trimmed;
}

/** Normaliza um texto (nicho ou cliente) para deduplicar grafias levemente diferentes. */
function normalizeSlug(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Encontra ou cria o Nicho correspondente ao texto digitado, agrupando campanhas do mesmo setor. */
async function resolveNicheId(nicheText: string): Promise<string> {
  const slug = normalizeSlug(nicheText);
  const niche = await prisma.niche.upsert({
    where: { slug },
    update: {},
    create: { name: nicheText.trim(), slug },
  });
  return niche.id;
}

/** Encontra ou cria o Cliente (dentro do nicho) correspondente ao nome digitado. */
async function resolveClientId(nicheId: string, clientName: string): Promise<string> {
  const slug = normalizeSlug(clientName);
  const client = await prisma.client.upsert({
    where: { nicheId_slug: { nicheId, slug } },
    update: {},
    create: { name: clientName.trim(), slug, nicheId },
  });
  return client.id;
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

export interface ClientSummary {
  readonly id: string;
  readonly name: string;
  readonly nicheName: string;
  readonly campaignCount: number;
  readonly setupPaid: boolean;
  readonly recurringActive: boolean;
}

export async function listClients(): Promise<readonly ClientSummary[]> {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: { niche: { select: { name: true } }, _count: { select: { campaigns: true } } },
  });
  return clients.map((client) => ({
    id: client.id,
    name: client.name,
    nicheName: client.niche.name,
    campaignCount: client._count.campaigns,
    setupPaid: client.setupPaid,
    recurringActive: client.recurringActive,
  }));
}

const CAMPAIGN_WITH_CLIENT_INCLUDE = { client: { select: { name: true } } } as const;

export async function createCampaign(input: {
  niche: string;
  briefing: string;
  clientName?: string;
  attachmentName?: string;
  attachmentMimeType?: string;
  attachmentBase64?: string;
}): Promise<CampaignWithClient> {
  const nicheId = await resolveNicheId(input.niche);
  const clientId = input.clientName?.trim()
    ? await resolveClientId(nicheId, input.clientName)
    : undefined;
  const campaign = await prisma.marketingCampaign.create({
    data: {
      niche: input.niche,
      nicheId,
      clientId,
      briefing: input.briefing,
      attachmentName: input.attachmentName,
      attachmentMimeType: input.attachmentMimeType,
      attachmentBase64: input.attachmentBase64,
    },
    include: CAMPAIGN_WITH_CLIENT_INCLUDE,
  });
  void runPipeline(campaign.id).catch((error) => {
    console.error("[marketing-office] pipeline falhou de forma inesperada", error);
  });
  return campaign;
}

export async function listCampaigns(): Promise<readonly CampaignWithClient[]> {
  return prisma.marketingCampaign.findMany({
    orderBy: { createdAt: "desc" },
    include: CAMPAIGN_WITH_CLIENT_INCLUDE,
  });
}

export async function getCampaignById(id: string): Promise<CampaignWithClient | null> {
  return prisma.marketingCampaign.findUnique({
    where: { id },
    include: CAMPAIGN_WITH_CLIENT_INCLUDE,
  });
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

      let nicheMemory: Awaited<ReturnType<typeof recallNicheMemory>> = [];
      try {
        nicheMemory = await recallNicheMemory({
          nicheId: campaign.nicheId,
          stage,
          queryText: `${campaign.niche} ${campaign.briefing}`,
          excludeCampaignId: campaignId,
          embeddingsApiKey: env.GEMINI_API_KEY,
        });
      } catch (error) {
        console.error("[marketing-office] falha ao recuperar memoria do nicho (segue sem contexto)", error);
      }

      const messages = buildStageMessages(stage, campaign, nicheMemory);
      const completion = await llm.complete(messages, { temperature: 0.7 });
      const field = MARKETING_STAGE_FIELD[stage];
      const strippedContent = stripCodeFence(completion.content);

      const data: Record<string, unknown> = { [field]: strippedContent };
      if (completion.model === "deterministic") {
        const priorFallbacks = Array.isArray(campaign.fallbackStagesJson)
          ? (campaign.fallbackStagesJson as string[])
          : [];
        data.fallbackStagesJson = [...priorFallbacks, stage];
      } else {
        try {
          await recordNicheMemory({
            nicheId: campaign.nicheId,
            campaignId,
            stage,
            content: strippedContent,
            embeddingsApiKey: env.GEMINI_API_KEY,
          });
        } catch (error) {
          console.error("[marketing-office] falha ao gravar memoria do nicho (nao afeta a campanha)", error);
        }
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
