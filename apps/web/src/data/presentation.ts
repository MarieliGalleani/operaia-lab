import type { Employee, Specialization } from "@/types/office";

/**
 * Apresentação por especialidade: avatar e rótulo amigável.
 * Concern da UI — o Employee Registry não guarda emoji.
 */
export const EMPLOYEE_PRESENTATION: Record<
  Specialization,
  { readonly emoji: string; readonly specialtyLabel: string }
> = {
  MANAGEMENT: { emoji: "👩🏻‍💼", specialtyLabel: "Gestão & Coordenação" },
  SOFTWARE_ENGINEERING: { emoji: "👩🏻‍💻", specialtyLabel: "Engenharia de Software" },
  PRODUCT_DESIGN: { emoji: "🎨", specialtyLabel: "Design de Produto & UX" },
  PRODUCT_MANAGEMENT: { emoji: "📋", specialtyLabel: "Gestão de Produto" },
  AUTOMATION: { emoji: "⚙️", specialtyLabel: "Automação & Integrações" },
  MARKETING: { emoji: "📈", specialtyLabel: "Marketing & Crescimento" },
  FINANCE: { emoji: "💰", specialtyLabel: "Finanças & Planejamento" },
  LEGAL: { emoji: "⚖️", specialtyLabel: "Jurídico & Compliance" },
  OPERATIONS: { emoji: "🛰️", specialtyLabel: "Operações" },
  /** @deprecated Preferir PRODUCT_DESIGN */
  UX_DESIGN: { emoji: "🎨", specialtyLabel: "Design de Produto & UX" },
  /** @deprecated Preferir PRODUCT_MANAGEMENT */
  PRODUCT: { emoji: "📋", specialtyLabel: "Gestão de Produto" },
  /** @deprecated Sem Employee ativo nesta especialidade */
  COMMERCIAL: { emoji: "🤝", specialtyLabel: "Comercial & Relacionamento" },
};

/** Fallback quando a especialidade ainda não tem apresentação. */
export const DEFAULT_EMPLOYEE_PRESENTATION = {
  emoji: "👤",
  specialtyLabel: "Especialista",
} as const;

export function presentationFor(
  specialization: Specialization,
): { readonly emoji: string; readonly specialtyLabel: string } {
  return EMPLOYEE_PRESENTATION[specialization] ?? DEFAULT_EMPLOYEE_PRESENTATION;
}

/** @deprecated Vagas planejadas removidas — use apenas o Registry. */
export const plannedHires: readonly Employee[] = [];
