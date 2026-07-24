/**
 * Especialidades de negocio. Sao rotulos de dominio: funcionarios nunca
 * escolhem outro funcionario, apenas informam a especialidade necessaria.
 * A resolucao para um funcionario concreto acontece FORA do dominio.
 */
export const Specialization = {
  MANAGEMENT: "MANAGEMENT",
  SOFTWARE_ENGINEERING: "SOFTWARE_ENGINEERING",
  PRODUCT_DESIGN: "PRODUCT_DESIGN",
  PRODUCT_MANAGEMENT: "PRODUCT_MANAGEMENT",
  AUTOMATION: "AUTOMATION",
  FINANCE: "FINANCE",
  LEGAL: "LEGAL",
  MARKETING: "MARKETING",
  OPERATIONS: "OPERATIONS",
  /** @deprecated Preferir PRODUCT_DESIGN */
  UX_DESIGN: "UX_DESIGN",
  /** @deprecated Preferir PRODUCT_MANAGEMENT */
  PRODUCT: "PRODUCT",
} as const;
export type Specialization =
  (typeof Specialization)[keyof typeof Specialization];
