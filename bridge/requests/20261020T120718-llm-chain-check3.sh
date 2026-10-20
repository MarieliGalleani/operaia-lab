docker exec -w /app/apps/api operaia-lab-api sh -c 'cat > /tmp/llmcheck.mts <<"X"
import { createLLMStack, parseLLMProviderList } from "@operaia/ai-core";
const llm = createLLMStack({ provider: process.env.LLM_PROVIDER as any, model: process.env.LLM_MODEL, anthropicApiKey: process.env.ANTHROPIC_API_KEY, geminiApiKey: process.env.GEMINI_API_KEY, fallbackProviders: parseLLMProviderList(process.env.LLM_FALLBACK_PROVIDERS), enableConsoleObservability: false });
const r = await llm.complete([{ role: "user", content: "Responda apenas: ok" }], { maxTokens: 20 });
console.log("respondeu_modelo=" + r.model + " | texto=" + String(r.content).slice(0, 20));
X
cp /tmp/llmcheck.mts ./llmcheck.mts && npx tsx ./llmcheck.mts 2>&1 | grep -iv "key" | tail -3; rm -f ./llmcheck.mts /tmp/llmcheck.mts'
