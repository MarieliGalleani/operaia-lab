cat > /tmp/llmcheck.mts <<"X"
import { GeminiProvider, createLLMStack, parseLLMProviderList } from "@operaia/ai-core";
const red = (s: string) => s.replace(/AIza[\w-]{10,}/g, "[chave]");
const g = new GeminiProvider({ apiKey: process.env.GEMINI_API_KEY! });
for (const mt of [20, 600]) {
  try { const r = await g.complete([{ role: "user", content: "Responda apenas: ok" }], { maxTokens: mt }); console.log("gem maxTokens=" + mt + " OK"); }
  catch (e: any) { console.log("gem maxTokens=" + mt + " ERRO " + red(String(e?.message)).slice(0, 160)); }
}
const llm = createLLMStack({ provider: process.env.LLM_PROVIDER as any, model: process.env.LLM_MODEL, anthropicApiKey: process.env.ANTHROPIC_API_KEY, geminiApiKey: process.env.GEMINI_API_KEY, fallbackProviders: parseLLMProviderList(process.env.LLM_FALLBACK_PROVIDERS), enableConsoleObservability: false });
for (const i of [1, 2, 3]) { const t = Date.now(); const r = await llm.complete([{ role: "user", content: "Liste 3 benefícios de lembrete por WhatsApp para clínica." }], { temperature: 0.7 }); console.log("t" + i + " modelo=" + r.model + " " + (Date.now() - t) + "ms chars=" + r.content.length); }
X
docker cp /tmp/llmcheck.mts operaia-lab-api:/app/apps/api/.llmcheck.mts
docker exec -w /app/apps/api operaia-lab-api npx tsx ./.llmcheck.mts 2>&1 | grep -iv "api_key\|apikey"
