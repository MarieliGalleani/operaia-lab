import type { DelegationRequest } from "@operaia/employee-framework";
import { Specialization } from "@operaia/employee-framework";
import {
  isBroadLaunchObjective,
  resolveAllRequiredSpecializations,
} from "./ceo-specialization-resolver.js";

export interface DelegationEdge {
  readonly fromSpecialization: string;
  readonly toSpecialization: string;
}

export interface CapacityHint {
  readonly saturatedSpecializations?: readonly string[];
  readonly availableWorkers?: number;
  readonly busyWorkers?: number;
}

export interface StrategicPlanInput {
  readonly objective: string;
  readonly pendingTitles?: readonly string[];
  readonly capacity?: CapacityHint;
  readonly maxDelegations?: number;
}

export interface StrategicPlan {
  readonly specializations: readonly Specialization[];
  readonly delegations: readonly DelegationRequest[];
  readonly edges: readonly DelegationEdge[];
  readonly rationale: string;
}

const DEFAULT_TASKS: Readonly<Record<string, string>> = {
  [Specialization.SOFTWARE_ENGINEERING]:
    "Finalizar infraestrutura e entregas tecnicas criticas.",
  [Specialization.PRODUCT_DESIGN]:
    "Validar experiencia e fluxos criticos do usuario.",
  [Specialization.PRODUCT_MANAGEMENT]:
    "Revisar backlog, criterios de aceite e prioridades.",
  [Specialization.LEGAL]:
    "Avaliar conformidade juridica e exposicao regulatoria.",
  [Specialization.MARKETING]:
    "Preparar comunicacao e estrategia de lancamento.",
  [Specialization.FINANCE]:
    "Estimar custos operacionais e projecoes.",
  [Specialization.OPERATIONS]:
    "Planejar implantacao, monitoramento e handoffs.",
  [Specialization.AUTOMATION]:
    "Desenhar automacoes e integracoes necessarias.",
};

/**
 * Plano estrategico deterministico da Opera.
 * Reutilizado pelo CeoBrain e pelo QueuedMissionExecutor (edges/DAG).
 */
export function buildStrategicPlan(input: StrategicPlanInput): StrategicPlan {
  const max = input.maxDelegations ?? 8;
  let specializations = [
    ...resolveAllRequiredSpecializations({
      objective: input.objective,
      pendingTitles: input.pendingTitles,
    }),
  ];

  const saturated = new Set(
    (input.capacity?.saturatedSpecializations ?? []).map((s) => s.toUpperCase()),
  );
  if (saturated.size > 0) {
    const filtered = specializations.filter(
      (spec) => !saturated.has(spec.toUpperCase()),
    );
    if (filtered.length > 0) {
      specializations = filtered;
    }
  }

  specializations = specializations.slice(0, max);

  const pending = input.pendingTitles ?? [];
  const delegations: DelegationRequest[] = specializations.map(
    (specialization, index) => ({
      specialization,
      reason: isBroadLaunchObjective(input.objective)
        ? "Dominio necessario para o plano de lancamento."
        : "Dominio identificado no objetivo / pendencias.",
      task:
        pending[index] ??
        DEFAULT_TASKS[specialization] ??
        `Executar trabalho de ${specialization}.`,
    }),
  );

  const edges = inferDefaultEdges(specializations);

  return {
    specializations,
    delegations,
    edges,
    rationale: isBroadLaunchObjective(input.objective)
      ? "Objetivo amplo de lancamento: plano multi-dominio com dependencias tipicas."
      : "Dominios detectados no objetivo e pendencias; dependencias inferidas para sequenciamento.",
  };
}

/**
 * Dependencias tipicas (DAG): engenharia antes de design/marketing;
 * produto em paralelo a engenharia; legal/finance em paralelo; ops apos engenharia.
 */
export function inferDefaultEdges(
  specializations: readonly Specialization[],
): readonly DelegationEdge[] {
  const set = new Set(specializations);
  const edges: DelegationEdge[] = [];
  const has = (spec: Specialization) => set.has(spec);

  const link = (from: Specialization, to: Specialization) => {
    if (has(from) && has(to)) {
      edges.push({ fromSpecialization: from, toSpecialization: to });
    }
  };

  link(Specialization.SOFTWARE_ENGINEERING, Specialization.PRODUCT_DESIGN);
  link(Specialization.SOFTWARE_ENGINEERING, Specialization.AUTOMATION);
  link(Specialization.SOFTWARE_ENGINEERING, Specialization.OPERATIONS);
  link(Specialization.PRODUCT_DESIGN, Specialization.MARKETING);
  link(Specialization.PRODUCT_MANAGEMENT, Specialization.MARKETING);
  link(Specialization.LEGAL, Specialization.MARKETING);

  return edges;
}
