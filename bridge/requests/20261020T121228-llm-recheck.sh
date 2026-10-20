cat > /tmp/llmcheck.mts <<"X"
import { createLLMStack, parseLLMProviderList } from "@operaia/ai-core";
const llm = createLLMStack({ provider: process.env.LLM_PROVIDER as any, model: process.env.LLM_MODEL, anthropicApiKey: process.env.ANTHROPIC_API_KEY, geminiApiKey: process.env.GEMINI_API_KEY, fallbackProviders: parseLLMProviderList(process.env.LLM_FALLBACK_PROVIDERS), enableConsoleObservability: false });
for (const i of [1, 2]) {
  const t = Date.now();
  const r = await llm.complete([{ role: "user", content: "Responda apenas: ok" }], { maxTokens: 20 });
  console.log("tentativa" + i + " respondeu_modelo=" + r.model + " | " + (Date.now() - t) + "ms");
}
X
docker cp /tmp/llmcheck.mts operaia-lab-api:/app/apps/api/.llmcheck.mts
docker exec -w /app/apps/api operaia-lab-api npx tsx ./.llmcheck.mts 2>&1 | grep -iv key | grep tentativa
