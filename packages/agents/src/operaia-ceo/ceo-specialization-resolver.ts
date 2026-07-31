import { Specialization } from "@operaia/employee-framework";

/**
 * Resolve especialidades a partir do objetivo.
 * Sem nomes de Employees — apenas Specialization (Matcher resolve quem executa).
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
    pattern: /\b(automat|integra|workflow|pipeline|zapier|n8n|docker|compose|caddy|systemd|servidor|infra|vps|container)\w*/i,
    specialization: Specialization.AUTOMATION,
  },
  {
    pattern: /\b(opera[cç][aã]o|ops\b|sla|processo operacional|hand.?off|journal|logs?\b)\w*/i,
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

/** Dominios tipicos de lancamento / go-live (sem hardcode de projeto). */
const LAUNCH_SPECIALIZATIONS: readonly Specialization[] = [
  Specialization.SOFTWARE_ENGINEERING,
  Specialization.PRODUCT_DESIGN,
  Specialization.PRODUCT_MANAGEMENT,
  Specialization.LEGAL,
  Specialization.MARKETING,
  Specialization.FINANCE,
  Specialization.OPERATIONS,
];

const LAUNCH_PATTERN =
  /\b(lan[cç]ar|lan[cç]amento|go[\s-]?live|release|publicar|colocar no ar)\b/i;

export interface ResolveSpecializationInput {
  readonly objective: string;
  readonly pendingTitles?: readonly string[];
}

/**
 * Escolhe UMA especialidade (compatibilidade).
 * Default tecnico quando a missao e de execucao generica.
 */
export function resolveRequiredSpecialization(
  objectiveOrInput: string | ResolveSpecializationInput,
): Specialization {
  const all = resolveAllRequiredSpecializations(objectiveOrInput);
  return all[0] ?? Specialization.SOFTWARE_ENGINEERING;
}

/**
 * Identifica TODAS as especializacoes envolvidas no objetivo + pendencias.
 */
export function resolveAllRequiredSpecializations(
  objectiveOrInput: string | ResolveSpecializationInput,
): readonly Specialization[] {
  const input =
    typeof objectiveOrInput === "string"
      ? { objective: objectiveOrInput, pendingTitles: [] as const }
      : objectiveOrInput;

  if (isBroadLaunchObjective(input.objective)) {
    return [...LAUNCH_SPECIALIZATIONS];
  }

  const found = new Set<Specialization>();
  for (const spec of matchAllSpecializations(input.objective)) {
    found.add(spec);
  }
  const pendingText = (input.pendingTitles ?? []).join(" ");
  for (const spec of matchAllSpecializations(pendingText)) {
    found.add(spec);
  }

  if (found.size === 0) {
    return [Specialization.SOFTWARE_ENGINEERING];
  }

  return orderSpecializations([...found]);
}

export function isBroadLaunchObjective(objective: string): boolean {
  return LAUNCH_PATTERN.test(objective.trim());
}

function matchAllSpecializations(text: string): Specialization[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  const matched: Specialization[] = [];
  for (const rule of SPECIALTY_RULES) {
    if (rule.pattern.test(trimmed)) {
      matched.push(rule.specialization);
    }
  }
  return matched;
}

function matchSpecialization(text: string): Specialization | null {
  const all = matchAllSpecializations(text);
  return all[0] ?? null;
}

/** Ordem estavel para plano estrategico (engenharia antes de marketing, etc.). */
function orderSpecializations(
  specs: readonly Specialization[],
): Specialization[] {
  const order = LAUNCH_SPECIALIZATIONS;
  return [...specs].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

export { matchSpecialization, LAUNCH_SPECIALIZATIONS };
