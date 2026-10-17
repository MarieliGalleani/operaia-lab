/**
 * Pipeline do andar Flow Story: Flow escolhe -> Story escreve -> humano aprova.
 *
 * Nada e publicado aqui. A saida e uma fila de rascunhos PENDING_APPROVAL.
 */

import type { LLMProvider } from "@operaia/ai-core";
import {
  ManualAffiliateLinkProvider,
  type AffiliateLinkProvider,
} from "./affiliate-link.js";
import { FlowRobot } from "./flow-robot.js";
import { StoryWriter } from "./story-writer.js";
import type {
  DraftStatus,
  FlowStoryConfig,
  FlowStoryRun,
  PostDraft,
  ProductCandidate,
} from "./types.js";

export interface FlowStoryRunInput {
  readonly products: readonly ProductCandidate[];
  readonly config: FlowStoryConfig;
  readonly llm: LLMProvider;
  readonly links?: AffiliateLinkProvider;
  readonly campaignId?: string;
}

export async function runFlowStory(input: FlowStoryRunInput): Promise<FlowStoryRun> {
  if (input.config.channels.length === 0) {
    throw new Error("Flow Story: informe ao menos um canal declarado no cadastro de afiliado.");
  }
  const flow = new FlowRobot(input.links ?? new ManualAffiliateLinkProvider());
  const story = new StoryWriter(input.llm);

  const { curated, rejected } = await flow.curate(
    input.products,
    input.config,
    input.campaignId,
  );

  const drafts: PostDraft[] = [];
  for (const product of curated) {
    for (const channel of input.config.channels) {
      drafts.push(await story.write(product, channel, input.config));
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
