import { randomUUID } from "node:crypto";
import type {
  AutonomyLevel,
  DemandBriefDto,
  RiskLevel,
  WorkPlanDto,
  WorkPlanStepDto,
} from "./automation-office.types.js";
import { resolveWorkspaceName } from "./workspace-catalog.js";

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

interface InterpretInput {
  readonly text: string;
  readonly workspaceId: string;
  readonly demandId: string;
}

interface InterpretResult {
  readonly brief: DemandBriefDto;
  readonly plan: WorkPlanDto;
  readonly targetStatus:
    | "PLANNED"
    | "AWAITING_APPROVAL"
    | "READY";
  readonly approvalNeeded: boolean;
}

function detectRisk(text: string): RiskLevel {
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

function resolveAutonomy(risk: RiskLevel): AutonomyLevel {
  if (risk === "CRITICAL") {
    return "HUMAN_APPROVAL";
  }
  if (risk === "HIGH") {
    return "CONTROLLED";
  }
  if (risk === "MEDIUM") {
    return "CONTROLLED";
  }
  return "READ_PLAN";
}

function resolveTargetStatus(
  autonomy: AutonomyLevel,
  risk: RiskLevel,
): InterpretResult["targetStatus"] {
  if (risk === "CRITICAL" || autonomy === "HUMAN_APPROVAL") {
    return "AWAITING_APPROVAL";
  }
  if (autonomy === "AUTONOMOUS") {
    return "READY";
  }
  if (autonomy === "READ_PLAN") {
    return "PLANNED";
  }
  return "PLANNED";
}

function buildSteps(objective: string, risk: RiskLevel): WorkPlanStepDto[] {
  const step1Id = randomUUID();
  const step2Id = randomUUID();
  const step3Id = randomUUID();
  const autonomy = resolveAutonomy(risk);
  return [
    {
      id: step1Id,
      title: "Analisar contexto e dependências",
      assigneeEmployeeId: "opera",
      assigneeLabel: "Opera",
      dependencies: [],
      risk: "LOW",
      autonomy: "READ_PLAN",
      expectedResult: "Brief operacional validado",
    },
    {
      id: step2Id,
      title: "Executar plano operacional",
      assigneeEmployeeId: "opera",
      assigneeLabel: "Opera",
      dependencies: [step1Id],
      risk,
      autonomy,
      expectedResult: objective.slice(0, 120),
    },
    {
      id: step3Id,
      title: "Validar entrega e registrar aprendizado",
      assigneeEmployeeId: "opera",
      assigneeLabel: "Opera",
      dependencies: [step2Id],
      risk: "LOW",
      autonomy: "CONTROLLED",
      expectedResult: "Resultado confirmado para a usuária",
    },
  ];
}

/**
 * Interpretacao deterministica provisoria (P0.3C).
 * Produz somente campos operacionais — sem reasoning interno.
 */
export function interpretDemandText(input: InterpretInput): InterpretResult {
  const objective = input.text.trim();
  const workspaceName = resolveWorkspaceName(input.workspaceId);
  const risk = detectRisk(objective);
  const autonomy = resolveAutonomy(risk);
  const targetStatus = resolveTargetStatus(autonomy, risk);
  const steps = buildSteps(objective, risk);

  const brief: DemandBriefDto = {
    demandId: input.demandId,
    workspaceId: input.workspaceId,
    workspaceName,
    objective,
    context: `Demanda registrada para ${workspaceName}.`,
    expectedOutcome: "Entrega operacional validada com resultado utilizável.",
    constraints: ["Respeitar governança Core", "Sem alterações estruturais automáticas"],
    priority: risk === "CRITICAL" ? "URGENT" : risk === "HIGH" ? "HIGH" : "MEDIUM",
    risk,
    autonomy,
    dependencies: [],
  };

  const plan: WorkPlanDto = {
    demandId: input.demandId,
    steps,
  };

  return {
    brief,
    plan,
    targetStatus,
    approvalNeeded: targetStatus === "AWAITING_APPROVAL",
  };
}
