/**
 * Roda uma rodada do andar Flow Story a partir de um CSV.
 *
 *   pnpm --filter @operaia/flow-story run:csv -- produtos.csv \
 *     --nicho "casa e organizacao" --canais instagram,whatsapp \
 *     [--categorias casa,cozinha] [--max 5] [--tom "leve"] [--saida rodada.json]
 *
 * LLM: usa LLM_PROVIDER/GEMINI_API_KEY do .env (padrao: deterministic, que
 * cai no template seguro). Nada e publicado: o JSON de saida e a fila de
 * rascunhos para aprovar.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createLLMProvider, type LLMProviderId } from "@operaia/ai-core";
import { parseProductsCsv } from "./product-import.js";
import { runFlowStory } from "./pipeline.js";
import { FLOW_STORY_CHANNELS, type FlowStoryChannel } from "./types.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function list(value: string | undefined): string[] {
  return (value ?? "").split(",").map((v) => v.trim()).filter(Boolean);
}

async function main(): Promise<void> {
  const csvPath = process.argv.slice(2).find((a) => !a.startsWith("--") && a.endsWith(".csv"));
  const niche = arg("nicho");
  const channels = list(arg("canais")) as FlowStoryChannel[];
  if (!csvPath || !niche || channels.length === 0) {
    console.error("Uso: run:csv -- produtos.csv --nicho \"...\" --canais instagram,whatsapp");
    process.exit(1);
  }
  const invalid = channels.filter((c) => !FLOW_STORY_CHANNELS.includes(c));
  if (invalid.length > 0) {
    console.error(`Canal desconhecido: ${invalid.join(", ")}. Use: ${FLOW_STORY_CHANNELS.join(", ")}`);
    process.exit(1);
  }

  const llm = createLLMProvider({
    provider: (process.env.LLM_PROVIDER ?? "deterministic") as LLMProviderId,
    model: process.env.LLM_MODEL,
    geminiApiKey: process.env.GEMINI_API_KEY,
  });

  const max = arg("max");
  const tone = arg("tom");
  const run = await runFlowStory({
    products: parseProductsCsv(readFileSync(csvPath, "utf8")),
    llm,
    config: {
      niche,
      channels,
      categories: list(arg("categorias")),
      ...(max ? { maxProducts: Number(max) } : {}),
      ...(tone ? { tone } : {}),
    },
  });

  const out = arg("saida") ?? "flow-story-rodada.json";
  writeFileSync(out, JSON.stringify(run, null, 2));
  console.log(
    `Flow escolheu ${run.curated.length} produto(s), recusou ${run.rejected.length}. ` +
      `Story escreveu ${run.drafts.length} rascunho(s) aguardando aprovacao -> ${out}`,
  );
}

void main();
