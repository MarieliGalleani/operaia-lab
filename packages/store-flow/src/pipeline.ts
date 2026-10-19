/**
 * Pipeline do andar Store Flow: Flow escolhe -> Driele escreve -> humano aprova.
 *
 * Nada e publicado aqui. A saida e uma fila de rascunhos PENDING_APPROVAL.
 */

import type { LLMProvider } from "@operaia/ai-core";
import {
  ManualAffiliateLinkProvider,
  type AffiliateLinkProvider,
} from "./affiliate-link.js";
import { FlowRobot } from "./flow-robot.js";
import type { LearningReport } from "./learning.js";
import { anglesFor, type DraftVariant } from "./sales-playbook.js";
import { DrieleWriter } from "./driele-writer.js";
import type {
  DraftStatus,
  StoreFlowConfig,
  StoreFlowRun,
  PostDraft,
  ProductCandidate,
} from "./types.js";

export interface StoreFlowRunInput {
  readonly products: readonly ProductCandidate[];
  readonly config: StoreFlowConfig;
  readonly llm: LLMProvider;
  readonly links?: AffiliateLinkProvider;
  readonly campaignId?: string;
  /** Duas versoes por post para testar o que vende mais (padrao: true). */
  readonly abTest?: boolean;
  /** Resultado do aprendizado da rodada anterior (angulo e horarios vencedores). */
  readonly learning?: Pick<LearningReport, "bestAngle" | "bestTimes">;
}

export async function runStoreFlow(input: StoreFlowRunInput): Promise<StoreFlowRun> {
  if (input.config.channels.length === 0) {
    throw new Error("Store Flow: informe ao menos um canal declarado no cadastro de afiliado.");
  }
  const links = input.links ?? new ManualAffiliateLinkProvider();
  const flow = new FlowRobot(links);
  const campaignId = input.campaignId ?? "storeflow";
  const driele = new DrieleWriter(input.llm);

  const { curated, rejected } = await flow.curate(
    input.products,
    input.config,
    campaignId,
  );

  const drafts: PostDraft[] = [];
  const variants: readonly DraftVariant[] = input.abTest === false ? ["A"] : ["A", "B"];
  for (const product of curated) {
    const angles = anglesFor(product, input.learning?.bestAngle);
    for (const channel of input.config.channels) {
      for (const [i, variant] of variants.entries()) {
        const trackingSubId = `${campaignId}-${product.product.id}-${channel}-${variant}`;
        const link = await links.createLink({ productUrl: product.product.url, subId: trackingSubId });
        drafts.push(
          await driele.write(product, channel, input.config, {
            variant,
            angle: angles[i]!,
            trackingSubId,
            // Sem API: mantem o link da Flow (pendente) para a Marieli colar o do portal.
            affiliateUrl: link.pending ? product.affiliateUrl : link.url,
            ...(input.learning?.bestTimes[channel]
              ? { postTimes: input.learning.bestTimes[channel] }
              : {}),
          }),
        );
      }
    }
  }

  return { curated, rejected, drafts };
}

/** Decisao humana sobre um rascunho (imutavel: devolve uma copia). */
export function reviewDraft(
  draft: PostDraft,
  decision: Exclude<DraftStatus, "PENDING_APPROVAL">,
  editedText?: string,
): PostDraft {
  if (draft.status !== "PENDING_APPROVAL") {
    throw new Error(`Rascunho ${draft.id} ja foi revisado (${draft.status}).`);
  }
  const text = editedText?.trim() ? editedText.trim() : draft.text;
  if (decision === "APPROVED" && !text.includes(draft.disclosure)) {
    throw new Error("Nao da para aprovar sem o aviso de link de afiliado.");
  }
  return { ...draft, text, status: decision };
}
