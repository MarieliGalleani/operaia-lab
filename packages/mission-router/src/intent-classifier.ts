/**
 * Classificador deterministico de intenção (sem LLM).
 */
import { IntentType } from "./intent-type.js";

export interface IntentClassification {
  readonly intentType: IntentType;
  readonly confidence: number;
}

/**
 * Classifica a mensagem do usuario com regras previsiveis.
 */
export function classifyIntent(message: string): IntentClassification {
  const text = normalize(message);
  if (!text) {
    return { intentType: IntentType.GENERAL_CONVERSATION, confidence: 0.4 };
  }

  const bug = matchBug(text);
  if (bug) {
    return bug;
  }

  const infra = matchInfra(text);
  if (infra) {
    return infra;
  }

  const tech = matchTech(text);
  if (tech) {
    return tech;
  }

  const planning = matchPlanning(text);
  if (planning) {
    return planning;
  }

  const decision = matchExecutive(text);
  if (decision) {
    return decision;
  }

  const review = matchOperationalReview(text);
  if (review) {
    return review;
  }

  const progress = matchExecutionProgress(text);
  if (progress) {
    return progress;
  }

  return { intentType: IntentType.GENERAL_CONVERSATION, confidence: 0.55 };
}

function normalize(message: string): string {
  return message.trim().replace(/\s+/g, " ");
}

function matchBug(text: string): IntentClassification | null {
  if (
    /\b(erro|error|bug|quebr|falhou|falha|crash|exception|stack\s*trace|nao\s+funciona|não\s+funciona|explodiu)\b/i.test(
      text,
    )
  ) {
    return { intentType: IntentType.BUG_INVESTIGATION, confidence: 0.92 };
  }
  if (/\b(por\s+que|porque).{0,40}\b(quebr|falh|erro)/i.test(text)) {
    return { intentType: IntentType.BUG_INVESTIGATION, confidence: 0.88 };
  }
  return null;
}

function matchInfra(text: string): IntentClassification | null {
  if (
    /\b(docker|compose|caddy|systemd|journalctl|container|servidor|infra|vps|nginx)\b/i.test(
      text,
    )
  ) {
    return {
      intentType: IntentType.INFRASTRUCTURE_OPERATION,
      confidence: 0.9,
    };
  }
  if (
    /\b(verifique|analise|analisar|checar|inspecionar).{0,40}\b(log|logs|docker|servidor)/i.test(
      text,
    )
  ) {
    return {
      intentType: IntentType.INFRASTRUCTURE_OPERATION,
      confidence: 0.86,
    };
  }
  if (/\b(servidor|infra).{0,30}\b(problema|fora|down|lento)/i.test(text)) {
    return {
      intentType: IntentType.INFRASTRUCTURE_OPERATION,
      confidence: 0.85,
    };
  }
  return null;
}

function matchTech(text: string): IntentClassification | null {
  if (
    /\b(implement|implementar|autentic|auth|login|oauth|jwt|criar\s+(uma\s+)?api|adicionar\s+(uma\s+)?funcional|feature|endpoint|refator|migrac|backend|frontend|codigo|código)\w*/i.test(
      text,
    )
  ) {
    return { intentType: IntentType.TECH_IMPLEMENTATION, confidence: 0.9 };
  }
  if (
    /\b(quero|preciso|vamos).{0,40}\b(implement|criar|adicionar|desenvolv|cod)/i.test(
      text,
    )
  ) {
    return { intentType: IntentType.TECH_IMPLEMENTATION, confidence: 0.84 };
  }
  return null;
}

function matchPlanning(text: string): IntentClassification | null {
  if (
    /\b(roadmap|planej|planeje|monte\s+um\s+plano|cronograma|entrega|milestone|backlog)\w*/i.test(
      text,
    )
  ) {
    return { intentType: IntentType.PROJECT_PLANNING, confidence: 0.88 };
  }
  return null;
}

function matchExecutive(text: string): IntentClassification | null {
  if (
    /\b(devemos|estratég|estrateg|qual\s+caminho|decidir|decis[aã]o|trade-?off|seguir\s+esse\s+caminho)\w*/i.test(
      text,
    )
  ) {
    return { intentType: IntentType.EXECUTIVE_DECISION, confidence: 0.86 };
  }
  return null;
}

function matchOperationalReview(text: string): IntentClassification | null {
  const patterns = [
    /(?:^|[^\p{L}])como\s+est(?:á|ã|a)o?(?:\s|$|[^\p{L}]|\?)/iu,
    /(?:^|[^\p{L}])o\s+que\s+merece(?:\s|$|[^\p{L}])/iu,
    /(?:^|[^\p{L}])aten[cç][aã]o\s+hoje(?:\s|$|[^\p{L}]|\?)/iu,
    /(?:^|[^\p{L}])sa[uú]de(?:\s|$|[^\p{L}])/iu,
    /(?:^|[^\p{L}])(?:status|resumo|overview)(?:\s|$|[^\p{L}]|\?)/iu,
    /(?:^|[^\p{L}])situa[cç][aã]o(?:\s|$|[^\p{L}]|\?)/iu,
    /(?:^|[^\p{L}])prioridades\s+de\s+hoje(?:\s|$|[^\p{L}]|\?)/iu,
    /(?:^|[^\p{L}])o\s+que\s+falta(?:\s|$|[^\p{L}]|\?)/iu,
  ];
  if (patterns.some((re) => re.test(text))) {
    return { intentType: IntentType.OPERATIONAL_REVIEW, confidence: 0.9 };
  }
  return null;
}

/**
 * Pedidos de avanço operacional (ex.: "Avance a NEXO") —
 * CEO coordena com o quadro; nao e conversa livre.
 */
function matchExecutionProgress(text: string): IntentClassification | null {
  if (
    /\b(avan[cç]e|avance|finalizar|completar|entregar|desbloquear|trabalh[ae]r?|atacar|resolver\s+as\s+pend)/i.test(
      text,
    )
  ) {
    return { intentType: IntentType.OPERATIONAL_REVIEW, confidence: 0.82 };
  }
  return null;
}
