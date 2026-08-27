/**
 * P0.3E — harness de evidência do Autonomy Loop (Office-only).
 *
 * Avalia as 7 etapas sem alterar Core. NÃO mascara ausência de evidência
 * como PASS. Não executa mutações PROD — apenas lê + reconcile lazy.
 */
import {
  buildAutonomyLoopEvidence,
  type AutonomyLoopEvidence,
  type AutonomyLoopStageId,
} from "./autonomy-loop-evidence.js";

export interface AutonomyLoopHarnessResult {
  readonly ok: boolean;
  readonly demandId: string;
  readonly correlationId: string;
  readonly missingStages: readonly AutonomyLoopStageId[];
  readonly evidence: AutonomyLoopEvidence;
  readonly message: string;
}

/**
 * Avalia evidência E2E do loop para uma Demand já existente.
 * Passa somente se as 7 etapas tiverem evidência presente
 * (delegation ausente documentada conta como presente).
 */
export async function assessAutonomyLoop(
  demandId: string,
  workspaceId?: string,
): Promise<AutonomyLoopHarnessResult> {
  const evidence = await buildAutonomyLoopEvidence(demandId, workspaceId);
  const missingStages = evidence.stages
    .filter((stage) => !stage.present)
    .map((stage) => stage.stage);

  const ok = missingStages.length === 0 && evidence.loopEvidenceComplete;

  return {
    ok,
    demandId: evidence.demandId,
    correlationId: evidence.correlationId,
    missingStages,
    evidence,
    message: ok
      ? "Autonomy Loop evidence complete (7/7 stages present)."
      : `Autonomy Loop incomplete — missing: ${missingStages.join(", ") || "unknown"}`,
  };
}

/** Helper puro para testes: não mascara stage ausente. */
export function summarizeHarness(
  evidence: AutonomyLoopEvidence,
): { readonly ok: boolean; readonly missingStages: readonly AutonomyLoopStageId[] } {
  const missingStages = evidence.stages
    .filter((stage) => !stage.present)
    .map((stage) => stage.stage);
  return {
    ok: missingStages.length === 0 && evidence.loopEvidenceComplete,
    missingStages,
  };
}
