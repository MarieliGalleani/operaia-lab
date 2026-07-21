import type { Employee, Specialization } from "@/types/office";

/**
 * Apresentação por especialidade: avatar e rótulo amigável.
 * É concern da UI (o Employee Registry não guarda emoji), então vive aqui e é
 * aplicado pelos mappers ao enriquecer um perfil vindo do backend.
 */
export const EMPLOYEE_PRESENTATION: Record<
  Specialization,
  { readonly emoji: string; readonly specialtyLabel: string }
> = {
  MANAGEMENT: { emoji: "👩🏻‍💼", specialtyLabel: "Gestão & Coordenação" },
  SOFTWARE_ENGINEERING: { emoji: "👩🏻‍💻", specialtyLabel: "Engenharia de Software" },
  UX_DESIGN: { emoji: "🎨", specialtyLabel: "Design de Produto & UX" },
  PRODUCT: { emoji: "📋", specialtyLabel: "Gestão de Produto" },
  AUTOMATION: { emoji: "⚙️", specialtyLabel: "Automação & Integrações" },
  MARKETING: { emoji: "📈", specialtyLabel: "Marketing & Crescimento" },
  FINANCE: { emoji: "💰", specialtyLabel: "Finanças & Planejamento" },
  LEGAL: { emoji: "⚖️", specialtyLabel: "Jurídico & Compliance" },
  COMMERCIAL: { emoji: "🤝", specialtyLabel: "Comercial & Relacionamento" },
};

/**
 * Vagas preparadas (roadmap de contratações). Não estão no Employee Registry
 * real — são um conceito do escritório até serem efetivamente contratadas.
 */
export const plannedHires: readonly Employee[] = [
  hire("ux-luna", "Luna", "UX/Product Designer", "UX_DESIGN", "Tornar cada produto claro, desejável e fácil de usar."),
  hire("pm-atlas", "Atlas", "Product Manager", "PRODUCT", "Traduzir objetivos de negócio em produto e roadmap."),
  hire("auto-nexus", "Nexus", "Automação", "AUTOMATION", "Conectar sistemas e automatizar fluxos operacionais."),
  hire("mkt-aurora", "Aurora", "Marketing", "MARKETING", "Levar cada produto ao público certo com a mensagem certa."),
  hire("fin-orion", "Orion", "Financeiro", "FINANCE", "Cuidar da saúde financeira e da sustentabilidade dos projetos."),
  hire("legal-themis", "Themis", "Jurídico", "LEGAL", "Proteger o escritório e garantir conformidade legal."),
  hire("sales-mercurio", "Mercúrio", "Comercial", "COMMERCIAL", "Gerar oportunidades e cultivar relações com clientes."),
];

function hire(
  id: string,
  name: string,
  role: string,
  specialization: Specialization,
  mission: string,
): Employee {
  const presentation = EMPLOYEE_PRESENTATION[specialization];
  return {
    id,
    name,
    role,
    emoji: presentation.emoji,
    specialization,
    specialtyLabel: presentation.specialtyLabel,
    mission,
    status: "HIRING",
    statusLabel: "Chegando em breve",
    lastActivity: "Vaga preparada",
    active: false,
  };
}
