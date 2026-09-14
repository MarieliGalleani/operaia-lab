import { createLLMStack, type LLMProvider, type LLMStackConfig } from "@operaia/ai-core";
import { prisma } from "@operaia/database";
import { env } from "../../config/env.js";
import { resolveClientId, resolveNicheId } from "../crm/niche-client.service.js";
import { recallNicheMemory, recordNicheMemory } from "../crm/niche-memory-store.js";
import { buildStageMessages } from "./automation-prompts.js";
import {
  AUTOMATION_STAGE_FIELD,
  AUTOMATION_STAGE_ORDER,
  type AutomationEngagement,
} from "./automation-engagement.types.js";

const OFFICE = "AUTOMATION";

let cachedLlm: LLMProvider | null = null;

/** Stack de LLM dedicado ao Atlas — mesma config do stack principal (lab-runtime),
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

type EngagementWithClient = AutomationEngagement & { client: { name: string } | null };

function asNumberRecord(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, number>;
}

/** Mapeia o registro do Prisma para o formato exposto na API (mesmo padrao do Mercurio). */
export function toApiEngagement(
  engagement: EngagementWithClient,
): Omit<AutomationEngagement, "fallbackStagesJson" | "stageDurationsMsJson" | "nicheMemoryHitsJson"> & {
  fallbackStages: string[];
  clientName: string | null;
  totalDurationMs: number | null;
  reuseRatio: number | null;
} {
  const { fallbackStagesJson, stageDurationsMsJson, nicheMemoryHitsJson, client, ...rest } = engagement;

  const durations = asNumberRecord(stageDurationsMsJson);
  const totalDurationMs = durations ? Object.values(durations).reduce((sum, ms) => sum + ms, 0) : null;

  const hits = asNumberRecord(nicheMemoryHitsJson);
  const hitValues = hits ? Object.values(hits) : [];
  const reuseRatio = hitValues.length > 0 ? hitValues.filter((h) => h > 0).length / hitValues.length : null;

  return {
    ...rest,
    fallbackStages: Array.isArray(fallbackStagesJson) ? (fallbackStagesJson as string[]) : [],
    clientName: client?.name ?? null,
    totalDurationMs,
    reuseRatio,
  };
}

export function stripCodeFence(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```[a-zA-Z]*\n([\s\S]*)\n```$/);
  return fenced ? fenced[1]!.trim() : trimmed;
}

const ENGAGEMENT_WITH_CLIENT_INCLUDE = { client: { select: { name: true } } } as const;

export async function createEngagement(input: {
  niche: string;
  briefing: string;
  clientName?: string;
  attachmentName?: string;
  attachmentMimeType?: string;
  attachmentBase64?: string;
}): Promise<EngagementWithClient> {
  const nicheId = await resolveNicheId(input.niche);
  const clientId = input.clientName?.trim()
    ? await resolveClientId(nicheId, input.clientName)
    : undefined;
  const engagement = await prisma.automationEngagement.create({
    data: {
      niche: input.niche,
      nicheId,
      clientId,
      briefing: input.briefing,
      attachmentName: input.attachmentName,
      attachmentMimeType: input.attachmentMimeType,
      attachmentBase64: input.attachmentBase64,
    },
    include: ENGAGEMENT_WITH_CLIENT_INCLUDE,
  });
  void runPipeline(engagement.id).catch((error) => {
    console.error("[automation-engagements] pipeline falhou de forma inesperada", error);
  });
  return engagement;
}

export async function listEngagements(): Promise<readonly EngagementWithClient[]> {
  return prisma.automationEngagement.findMany({
    orderBy: { createdAt: "desc" },
    include: ENGAGEMENT_WITH_CLIENT_INCLUDE,
  });
}

export async function getEngagementById(id: string): Promise<EngagementWithClient | null> {
  return prisma.automationEngagement.findUnique({
    where: { id },
    include: ENGAGEMENT_WITH_CLIENT_INCLUDE,
  });
}

export interface AutomationAttachment {
  readonly name: string;
  readonly mimeType: string;
  readonly base64: string;
}

export async function getEngagementAttachment(id: string): Promise<AutomationAttachment | null> {
  const engagement = await prisma.automationEngagement.findUnique({
    where: { id },
    select: { attachmentName: true, attachmentMimeType: true, attachmentBase64: true },
  });
  if (!engagement?.attachmentBase64 || !engagement.attachmentMimeType) return null;
  return {
    name: engagement.attachmentName ?? "anexo",
    mimeType: engagement.attachmentMimeType,
    base64: engagement.attachmentBase64,
  };
}

/** Referencia definida pelo Atlas no engajamento mais recente e concluido deste cliente —
 * o "plano" ao lado do qual os lancamentos reais de automacao sao comparados. */
export async function getClientLatestAutomationPlans(clientId: string): Promise<{
  frameworkMonitoramento: string | null;
}> {
  const engagement = await prisma.automationEngagement.findFirst({
    where: { clientId, status: "DONE" },
    orderBy: { createdAt: "desc" },
    select: { frameworkMonitoramento: true },
  });
  return { frameworkMonitoramento: engagement?.frameworkMonitoramento ?? null };
}

/**
 * Roda as etapas do Atlas em sequencia, persistindo o resultado de cada
 * uma assim que fica pronta — mesma logica do Mercurio.
 */
async function runPipeline(engagementId: string): Promise<void> {
  const llm = getLlm();
  await prisma.automationEngagement.update({
    where: { id: engagementId },
    data: { status: "RUNNING" },
  });

  try {
    for (const stage of AUTOMATION_STAGE_ORDER) {
      await prisma.automationEngagement.update({
        where: { id: engagementId },
        data: { currentStage: stage },
      });

      const engagement = await prisma.automationEngagement.findUniqueOrThrow({
        where: { id: engagementId },
      });

      let nicheMemory: Awaited<ReturnType<typeof recallNicheMemory>> = [];
      try {
        nicheMemory = await recallNicheMemory({
          nicheId: engagement.nicheId,
          office: OFFICE,
          stage,
          queryText: `${engagement.niche} ${engagement.briefing}`,
          excludeSourceId: engagementId,
          embeddingsApiKey: env.GEMINI_API_KEY,
        });
      } catch (error) {
        console.error("[automation-engagements] falha ao recuperar memoria do nicho (segue sem contexto)", error);
      }

      const messages = buildStageMessages(stage, engagement, nicheMemory);
      const startedAt = Date.now();
      const completion = await llm.complete(messages, { temperature: 0.7 });
      const durationMs = Date.now() - startedAt;
      const field = AUTOMATION_STAGE_FIELD[stage];
      const strippedContent = stripCodeFence(completion.content);

      const priorDurations = asNumberRecord(engagement.stageDurationsMsJson) ?? {};
      const priorHits = asNumberRecord(engagement.nicheMemoryHitsJson) ?? {};

      const data: Record<string, unknown> = {
        [field]: strippedContent,
        stageDurationsMsJson: { ...priorDurations, [stage]: durationMs },
        nicheMemoryHitsJson: { ...priorHits, [stage]: nicheMemory.length },
      };
      if (completion.model === "deterministic") {
        const priorFallbacks = Array.isArray(engagement.fallbackStagesJson)
          ? (engagement.fallbackStagesJson as string[])
          : [];
        data.fallbackStagesJson = [...priorFallbacks, stage];
      } else {
        try {
          await recordNicheMemory({
            nicheId: engagement.nicheId,
            office: OFFICE,
            sourceId: engagementId,
            stage,
            content: strippedContent,
            embeddingsApiKey: env.GEMINI_API_KEY,
          });
        } catch (error) {
          console.error("[automation-engagements] falha ao gravar memoria do nicho (nao afeta o engajamento)", error);
        }
      }

      await prisma.automationEngagement.update({
        where: { id: engagementId },
        data,
      });
    }

    await prisma.automationEngagement.update({
      where: { id: engagementId },
      data: { status: "DONE", currentStage: null },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida no pipeline.";
    await prisma.automationEngagement.update({
      where: { id: engagementId },
      data: { status: "ERROR", errorMessage: message },
    });
  }
}
