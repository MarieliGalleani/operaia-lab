docker exec -w /app/apps/api operaia-lab-api sh -c 'cat > ./gcheck.mts <<"X"
import { GeminiProvider, AnthropicProvider } from "@operaia/ai-core";
const k = (s?: string) => String(s ?? "").replace(/AIza[\w-]{10,}|sk-ant-[\w-]{10,}/g, "[chave]");
for (const [name, p] of [["gemini", new GeminiProvider({ apiKey: process.env.GEMINI_API_KEY! })], ["anthropic", new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY!, model: process.env.LLM_MODEL })]] as const) {
  try { const r = await p.complete([{ role: "user", content: "Responda apenas: ok" }], { maxTokens: 20 }); console.log(name, "OK", r.model); }
  catch (e: any) { console.log(name, "ERRO", k(e?.status ?? ""), k(String(e?.message)).slice(0, 260)); }
}
X
npx tsx ./gcheck.mts 2>&1 | tail -4; rm -f ./gcheck.mts'
