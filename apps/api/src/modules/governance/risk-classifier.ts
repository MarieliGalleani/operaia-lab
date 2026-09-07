/**
 * Classificacao de risco por palavra-chave — extraida de
 * automation-office/demand-interpreter.ts para poder ser reaproveitada
 * pelo pipeline real de missoes (runtime/) sem criar dependencia
 * circular (automation-office ja depende de runtime).
 *
 * Mesma logica, mesmo resultado para o fluxo de demanda manual — so
 * mudou de endereco.
 */
export type ActionRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const CRITICAL_KEYWORDS = [
  "produção",
  "producao",
  "deploy",
  "delete",
  "remover",
  "drop",
  "credencial",
  "secret",
  "password",
  "token",
];

const HIGH_KEYWORDS = [
  "migrar",
  "migration",
  "database",
  "banco",
  "infra",
  "payment",
  "pagamento",
];

export function detectActionRisk(text: string): ActionRiskLevel {
  const lower = text.toLowerCase();
  if (CRITICAL_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return "CRITICAL";
  }
  if (HIGH_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return "HIGH";
  }
  if (lower.length > 400) {
    return "MEDIUM";
  }
  return "LOW";
}
