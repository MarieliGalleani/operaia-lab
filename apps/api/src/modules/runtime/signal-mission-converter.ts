/**
 * Converte DomainSignal CONVERT_CANDIDATE → Mission COORDINATE (Opera).
 * Fora de modules/signals para respeitar invariante architecture (sem MissionQueue la).
 *
 * FASE Work Governance: Policy decide "vale olhar?"; Gate decide "já fizemos?".
 */
import type { DomainSignalRecord } from "@operaia/domain-signals";
import type { MissionQueue } from "./mission-queue.js";
import { CEO_EMPLOYEE_ID, MissionKind } from "./mission-states.js";
import {
  type AlreadyDoneGate,
  type WorkContextHints,
} from "./work-governance/index.js";

/**
 * Objective com contexto operacional para a Opera (workspace, repo, mudanca, arquivos, motivo).
 */
export function buildSignalCoordinateObjective(
  signal: DomainSignalRecord,
): string {
  const payload = signal.payloadJson;
  const repository =
    (typeof payload.repository === "string" && payload.repository) ||
    (typeof payload.externalRef === "string" && payload.externalRef) ||
    signal.sourceId ||
    "n/a";
  const changeFields = Array.isArray(payload.changeFields)
    ? payload.changeFields.filter((item): item is string => typeof item === "string")
    : [];
  const affectedFiles = Array.isArray(payload.affectedFiles)
    ? payload.affectedFiles.filter((item): item is string => typeof item === "string")
    : [];
  const changeSummary =
    changeFields.length > 0
      ? changeFields.join(",")
      : signal.type;
  const filesSummary =
    affectedFiles.length > 0
      ? affectedFiles.slice(0, 12).join(", ")
      : "n/a";
  const reason =
    signal.evaluationReason?.trim() ||
    "avaliar sinal GitHub e decidir proximas acoes";
  const sha =
    typeof payload.lastCommitSha === "string" ? payload.lastCommitSha : null;

  return (
    `[COORDINATE/SIGNAL] ${signal.type} · ` +
    `workspace=${signal.workspaceId} · ` +
    `repository=${repository} · ` +
    `mudanca=${changeSummary} · ` +
    `arquivos=${filesSummary} · ` +
    `motivo=${reason} · ` +
    `source=${signal.sourceId ?? "n/a"} · ` +
    (sha ? `sha=${sha} · ` : "") +
    `correlation=${signal.correlationId} · ` +
    `delivery=${signal.deliveryId}`
  );
}

export function contextHintsFromSignal(
  signal: DomainSignalRecord,
): WorkContextHints {
  const payload = signal.payloadJson;
  const repository =
    (typeof payload.repository === "string" && payload.repository) ||
    (typeof payload.externalRef === "string" && payload.externalRef) ||
    null;
  const affectedFiles = Array.isArray(payload.affectedFiles)
    ? payload.affectedFiles.filter((item): item is string => typeof item === "string")
    : [];
  const lastCommitSha =
    typeof payload.lastCommitSha === "string" ? payload.lastCommitSha : null;
  const pr =
    typeof payload.pullRequestNumber === "number"
      ? String(payload.pullRequestNumber)
      : typeof payload.pr === "string"
        ? payload.pr
        : null;
  const issue =
    typeof payload.issueNumber === "number"
      ? String(payload.issueNumber)
      : typeof payload.issue === "string"
        ? payload.issue
        : null;

  return {
    commitSha: lastCommitSha,
    files: affectedFiles,
    pullRequest: pr,
    issue,
    signalId: signal.id,
    repository,
    correlationId: signal.correlationId,
  };
}

export async function enqueueSignalCoordinateMission(input: {
  readonly queue: MissionQueue;
  readonly signal: DomainSignalRecord;
  /** Obrigatório — evita Prisma implícito em testes. */
  readonly gate: AlreadyDoneGate;
}): Promise<string> {
  const gate = input.gate;
  const objective = buildSignalCoordinateObjective(input.signal);
  const request = {
    workspaceId: input.signal.workspaceId,
    objective,
    source: "signal" as const,
    missionKind: MissionKind.COORDINATE,
    contextHints: contextHintsFromSignal(input.signal),
    correlationId: input.signal.id,
  };

  const admit = await gate.admit(request);

  if (
    (admit.decision === "SKIP" || admit.decision === "REUSE") &&
    admit.resultingMissionId
  ) {
    console.log(
      JSON.stringify({
        level: "info",
        component: "work-governance-gate",
        event: "signal_admit_skip",
        signalId: input.signal.id,
        decision: admit.decision,
        reason: admit.reason,
        resultingMissionId: admit.resultingMissionId,
        workIdentity: admit.workIdentity,
      }),
    );
    return admit.resultingMissionId;
  }

  const { mission } = await input.queue.enqueue({
    workspaceId: input.signal.workspaceId,
    objective,
    missionKind: MissionKind.COORDINATE,
    ownerEmployeeId: CEO_EMPLOYEE_ID,
    dedupe: true,
  });

  await gate.bindExecute({
    admit,
    request,
    missionId: mission.id,
  });

  return mission.id;
}
