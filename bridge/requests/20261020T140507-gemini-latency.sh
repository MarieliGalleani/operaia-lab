cat > /tmp/gl.mts <<"X"
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const sys = "Você é a Opera, CEO de um escritório virtual. Responda em português, até 150 palavras, SOMENTE JSON {\"resposta\":\"...\",\"demanda\":null}.\nRETRATO: 26 missões concluídas em 24h, 0 falhas, 0 aprovações pendentes. Entregas: Podiário guia de 5 passos para rodar localmente; OperaIA.lab análise do README com 3 melhorias; Mercúrio campanha Instagram para clínica de podologia (DONE).";
for (const level of [undefined, "LOW", "MINIMAL"] as const) {
  for (const i of [1, 2]) {
    const t = Date.now();
    try {
      const r = await ai.models.generateContent({ model: "gemini-3.6-flash", contents: [{ role: "user", parts: [{ text: "O que a equipe entregou nesta semana?" }] }], config: { systemInstruction: sys, maxOutputTokens: 1500, temperature: 0.4, ...(level ? { thinkingConfig: { thinkingLevel: level as any } } : {}) } });
      console.log(`${level ?? "padrao"} #${i} ${Date.now() - t}ms chars=${(r.text ?? "").length}`);
    } catch (e: any) { console.log(`${level ?? "padrao"} #${i} ERRO ${e?.status} ${String(e?.message).replace(/AIza[\w-]+/g, "[k]").slice(0, 100)}`); }
  }
}
X
docker cp /tmp/gl.mts operaia-lab-api:/app/apps/api/.gl.mts
docker exec -w /app/apps/api operaia-lab-api npx tsx ./.gl.mts 2>&1
