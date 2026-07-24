/**
 * Gate de delegacao da CEO: decide se a missao exige especialista
 * ou se a Opera responde sozinha (caminho rapido).
 *
 * Heuristica deterministica — sem LLM. Novos especialistas continuam
 * sendo ativados apenas via Registry + Specialization no Matcher.
 */

const ADVISORY_PATTERN =
  /\b(como\s+est[aã]o|como\s+esta|status|resumo|situa[cç][aã]o|overview|o\s+que\s+falta|prioridades\s+de\s+hoje|quem\s+precisa|aten[cç][aã]o\s+hoje|qual(?:is)?\s+o\s+papel|pap[eé]is\s+de\s+voc)\b/i;

const TECHNICAL_EXECUTION_PATTERN =
  /\b(implement|autentic|auth|login|senha|oauth|jwt|desenvolv|codifica|refator|migrac|api\b|banco\b|deploy|bug|corrigir|endpoint|frontend|backend|teste\s+automat)\w*/i;

/** Pedidos explicitos de execucao / progresso operacional. */
const EXECUTION_PROGRESS_PATTERN =
  /\b(finalizar|completar|entregar|avan[cç]ar|avance|desbloquear|executar|resolver|construir|adicionar|fechar|trabalh[ae]|trabalhar|atacar|cuidar|mexer|quero\s+|fa[cz]a?\b|faz\b|pr[oó]xim[ao]s?\s+a[cç][oõ]es?)\b/i;

/** Referencia as pendencias/tarefas ja conhecidas no workspace. */
const PENDING_WORK_REFERENCE_PATTERN =
  /\b(pend[eê]ncia|pendencias|tarefa|tarefas|essas\s+duas|esses\s+itens|em\s+cima\s+d|pr[oó]xim[ao]s?\s+a[cç][oõ]es?)\w*/i;

export interface DelegationGateInput {
  readonly objective: string;
  readonly pendingTitles: readonly string[];
  readonly planRequestsDelegate: boolean;
}

/**
 * Retorna true quando a CEO deve pedir especialidade via Matcher.
 * False = resposta imediata da Opera (sem Mag / sem consolidacao).
 */
export function needsSpecialistDelegation(input: DelegationGateInput): boolean {
  if (input.pendingTitles.length === 0) {
    return false;
  }
  if (!input.planRequestsDelegate) {
    return false;
  }

  const objective = input.objective.trim();
  if (objective.length === 0) {
    return false;
  }

  if (isAdvisoryOnly(objective)) {
    return false;
  }

  if (TECHNICAL_EXECUTION_PATTERN.test(objective)) {
    return true;
  }

  if (objectiveMatchesPendingWork(objective, input.pendingTitles)) {
    return true;
  }

  // "trabalha em cima dessas duas pendencias" — ordem de execucao sem
  // repetir o titulo tecnico, mas com pendencias reais no quadro.
  if (PENDING_WORK_REFERENCE_PATTERN.test(objective)) {
    return true;
  }

  return EXECUTION_PROGRESS_PATTERN.test(objective);
}

function isAdvisoryOnly(objective: string): boolean {
  if (!ADVISORY_PATTERN.test(objective)) {
    return false;
  }
  // "Como esta a autenticacao que preciso implementar?" ainda e tecnico.
  if (TECHNICAL_EXECUTION_PATTERN.test(objective)) {
    return false;
  }
  // Pedido consultivo misturado com ordem de trabalho ainda delega.
  if (
    EXECUTION_PROGRESS_PATTERN.test(objective) ||
    PENDING_WORK_REFERENCE_PATTERN.test(objective)
  ) {
    return false;
  }
  return true;
}

function objectiveMatchesPendingWork(
  objective: string,
  pendingTitles: readonly string[],
): boolean {
  const tokens = tokenize(objective);
  if (tokens.length === 0) {
    return false;
  }
  return pendingTitles.some((title) => {
    const titleTokens = tokenize(title);
    return tokens.some((token) => titleTokens.includes(token));
  });
}

function tokenize(text: string): readonly string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 4);
}
