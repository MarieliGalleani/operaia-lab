/**
 * Converte DomainSignal CONVERT_CANDIDATE → Mission COORDINATE (Opera).
 * Fora de modules/signals para respeitar invariante architecture (sem MissionQueue la).
 */
import type { DomainSignalRecord } from "@operaia/domain-signals";
import type { MissionQueue } from "./mission-queue.js";
import { CEO_EMPLOYEE_ID, MissionKind } from "./mission-states.js";

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

  return (
    `[COORDINATE/SIGNAL] ${signal.type} · ` +
    `workspace=${signal.workspaceId} · ` +
    `repository=${repository} · ` +
    `mudanca=${changeSummary} · ` +
    `arquivos=${filesSummary} · ` +
    `motivo=${reason} · ` +
    `source=${signal.sourceId ?? "n/a"} · ` +
    `correlation=${signal.correlationId} · ` +
    `delivery=${signal.deliveryId}`
  );
}

export async function enqueueSignalCoordinateMission(input: {
  readonly queue: MissionQueue;
  readonly signal: DomainSignalRecord;
}): Promise<string> {
  const { mission } = await input.queue.enqueue({
    workspaceId: input.signal.workspaceId,
    objective: buildSignalCoordinateObjective(input.signal),
    missionKind: MissionKind.COORDINATE,
    ownerEmployeeId: CEO_EMPLOYEE_ID,
    dedupe: true,
  });
  return mission.id;
}
