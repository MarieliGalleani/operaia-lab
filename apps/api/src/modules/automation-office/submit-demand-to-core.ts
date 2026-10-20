import { HUMAN_DEMAND_MARKER } from "@operaia/agents";
import type { AssistedMissionQueuePort } from "../operations/operational-mission-service.js";
import { CEO_EMPLOYEE_ID } from "../runtime/mission-states.js";
import type {
  AlreadyDoneGate,
  WorkContextHints,
} from "../runtime/work-governance/index.js";

export interface SubmitDemandToCoreInput {
  readonly workspaceId: string;
  readonly objective: string;
  /** Idempotência no AlreadyDoneGate — tipicamente `demand.id`. */
  readonly correlationId: string;
  /** Hints estruturados preservados integralmente no admit. */
  readonly contextHints?: WorkContextHints;
}

export interface SubmitDemandToCoreResult {
  readonly missionId: string;
  readonly accepted: boolean;
  readonly gateDecision?: string;
}

/**
 * Submissão assíncrona ao Core (P0.3C-5 Opção A).
 *
 * Espelha admit+enqueue do caminho Assisted — mesmo padrão de
 * `enqueueSignalCoordinateMission` — sem aguardar terminal.
 *
 * Intencional: NÃO chama OperationalMissionService.run() / runViaQueue()
 * (bloqueio síncrono incompatível com fire-and-forget do Office).
 *
 * Usa EXATAMENTE a MissionQueue e o AlreadyDoneGate injetados (produto:
 * continuous.queue + workGovernanceGate). Não cria fila/executor/runtime.
 *
 * SKIP/REUSE:
 * - com resultingMissionId → reutiliza missão (sem enqueue).
 * - sem resultingMissionId → enqueue + bindExecute (alinhado a Signal/OMS).
 */
export async function submitDemandToCore(
  queue: AssistedMissionQueuePort,
  gate: AlreadyDoneGate | undefined,
  input: SubmitDemandToCoreInput,
): Promise<SubmitDemandToCoreResult> {
  // Marca de demanda humana: a CEO delega ao especialista mesmo sem
  // pendencias no quadro (antes respondia sozinha e ninguem trabalhava).
  const objective = input.objective.includes(HUMAN_DEMAND_MARKER)
    ? input.objective
    : `${HUMAN_DEMAND_MARKER} ${input.objective}`;

  const contextHints = mergeContextHints(
    input.contextHints,
    input.correlationId,
  );

  const governanceRequest = {
    workspaceId: input.workspaceId,
    objective,
    source: "assisted" as const,
    missionKind: "COORDINATE",
    contextHints,
    correlationId: input.correlationId,
    forceExecute: false,
  };

  if (gate) {
    const admit = await gate.admit(governanceRequest);

    if (
      (admit.decision === "SKIP" || admit.decision === "REUSE") &&
      admit.resultingMissionId
    ) {
      return {
        missionId: admit.resultingMissionId,
        accepted: true,
        gateDecision: admit.decision,
      };
    }

    // SKIP/REUSE sem missionId, REOPEN, EXECUTE → admitir na mesma fila.
    const { mission } = await queue.enqueue({
      workspaceId: input.workspaceId,
      objective,
      ownerEmployeeId: CEO_EMPLOYEE_ID,
      dedupe: false,
      origin: "HUMAN_DEMAND",
    });

    await gate.bindExecute({
      admit,
      request: governanceRequest,
      missionId: mission.id,
    });

    return {
      missionId: mission.id,
      accepted: true,
      gateDecision: admit.decision,
    };
  }

  const { mission } = await queue.enqueue({
    workspaceId: input.workspaceId,
    objective,
    ownerEmployeeId: CEO_EMPLOYEE_ID,
    dedupe: false,
    origin: "HUMAN_DEMAND",
  });

  return {
    missionId: mission.id,
    accepted: true,
  };
}

/**
 * Preserva hints fornecidos; garante correlationId no fingerprint quando ausente.
 */
function mergeContextHints(
  hints: WorkContextHints | undefined,
  correlationId: string,
): WorkContextHints {
  return {
    ...hints,
    correlationId: hints?.correlationId ?? correlationId,
  };
}
