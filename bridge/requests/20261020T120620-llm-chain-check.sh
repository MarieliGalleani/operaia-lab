docker exec -w /app/apps/api operaia-lab-api node --input-type=module -e '
const m = await import("@operaia/ai-core");
const p = (s)=>m.parseLLMProviderList(s);
const llm = m.createLLMStack({ provider: process.env.LLM_PROVIDER, model: process.env.LLM_MODEL, anthropicApiKey: process.env.ANTHROPIC_API_KEY, geminiApiKey: process.env.GEMINI_API_KEY, fallbackProviders: p(process.env.LLM_FALLBACK_PROVIDERS), enableConsoleObservability: false });
const r = await llm.complete([{role:"user",content:"Responda apenas: ok"}], {maxTokens: 20});
console.log("stack=", llm.name, "| respondeu_modelo=", r.model, "| texto=", String(r.content).slice(0,20));
' 2>&1 | grep -v -i "key" | tail -4 || echo "path?"; docker exec operaia-lab-api sh -c 'ls /app 2>/dev/null | head -5; pwd'
