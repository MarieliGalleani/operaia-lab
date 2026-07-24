import { Specialization } from "@operaia/employee-framework";

/**
 * Resolve a especialidade necessaria a partir do objetivo.
 * Sem nomes de Employees — apenas Specialization (Matcher resolve quem executa).
 *
 * Ordem: dominios distintos primeiro; engenharia antes de produto generico
 * para evitar falso positivo em "priorizar autenticacao".
 *
 * Quando o objetivo so referencia pendencias genericas, usa os titulos
 * das tarefas pendentes (ainda sem nomes de Employee).
 */
const SPECIALTY_RULES: readonly {
  readonly pattern: RegExp;
  readonly specialization: Specialization;
}[] = [
  {
    pattern: /\b(jurid|legal|contrat|lgpd|compliance|privacidade)\w*/i,
    specialization: Specialization.LEGAL,
  },
  {
    pattern: /\b(financ|or[cç]ament|custo|receita|runway|pricing)\w*/i,
    specialization: Specialization.FINANCE,
  },
  {
    pattern: /\b(marketing|campanha|marca|growth|aquisic|posicionamento)\w*/i,
    specialization: Specialization.MARKETING,
  },
  {
    pattern: /\b(automat|integra|workflow|pipeline|zapier|n8n)\w*/i,
    specialization: Specialization.AUTOMATION,
  },
  {
    pattern: /\b(opera[cç][aã]o|ops\b|sla|processo operacional|hand.?off)\w*/i,
    specialization: Specialization.OPERATIONS,
  },
  {
    pattern:
      /\b(implement|autentic|auth|login|cod|api|arquitet|software|engenh|refator|deploy|bug|desenvolv|sincron|offline)\w*/i,
    specialization: Specialization.SOFTWARE_ENGINEERING,
  },
  {
    pattern: /\b(design|ux|ui|interface|usabilidade|prototip|figma)\w*/i,
    specialization: Specialization.PRODUCT_DESIGN,
  },
  {
    pattern:
      /\b(roadmap|backlog|discovery|gest[aã]o de produto|product manager|\bpm\b)\w*/i,
    specialization: Specialization.PRODUCT_MANAGEMENT,
  },
];

export interface ResolveSpecializationInput {
  readonly objective: string;
  readonly pendingTitles?: readonly string[];
}

/**
 * Escolhe a especialidade pedida pela CEO.
 * Default tecnico (SOFTWARE_ENGINEERING) quando a missao e de execucao generica.
 */
export function resolveRequiredSpecialization(
  objectiveOrInput: string | ResolveSpecializationInput,
): Specialization {
  const input =
    typeof objectiveOrInput === "string"
      ? { objective: objectiveOrInput, pendingTitles: [] as const }
      : objectiveOrInput;

  const fromObjective = matchSpecialization(input.objective);
  if (fromObjective) {
    return fromObjective;
  }

  const pendingText = (input.pendingTitles ?? []).join(" ");
  const fromPending = matchSpecialization(pendingText);
  if (fromPending) {
    return fromPending;
  }

  return Specialization.SOFTWARE_ENGINEERING;
}

function matchSpecialization(text: string): Specialization | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  for (const rule of SPECIALTY_RULES) {
    if (rule.pattern.test(trimmed)) {
      return rule.specialization;
    }
  }
  return null;
}
