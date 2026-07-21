/**
 * Especialidades de negocio. Sao rotulos de dominio: funcionarios nunca
 * escolhem outro funcionario, apenas informam a especialidade necessaria.
 * A resolucao para um funcionario concreto acontece FORA do dominio.
 */
export const Specialization = {
  MANAGEMENT: "MANAGEMENT",
  SOFTWARE_ENGINEERING: "SOFTWARE_ENGINEERING",
  UX_DESIGN: "UX_DESIGN",
  MARKETING: "MARKETING",
  FINANCE: "FINANCE",
  LEGAL: "LEGAL",
  AUTOMATION: "AUTOMATION",
  PRODUCT: "PRODUCT",
} as const;
export type Specialization =
  (typeof Specialization)[keyof typeof Specialization];
