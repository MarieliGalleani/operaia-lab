import type { WorkspaceSource } from "../../employees/workspace-source.js";
import type { ClockPort, MissionQueuePort, MissionView } from "./ports.js";
import type {
  CoordinationReason,
  WorkspaceScanItem,
  WorkspaceScanReport,
} from "./types.js";

/**
 * WorkspaceScanner — observa workspaces.
 * Nao executa missao. Apenas detecta necessidade de atencao operacional.
 */
export class WorkspaceScanner {
  constructor(
    private readonly workspaces: WorkspaceSource,
    private readonly queue: MissionQueuePort,
    private readonly clock: ClockPort,
  ) {}

  async scan(): Promise<WorkspaceScanReport> {
    const list = await this.workspaces.listWorkspaces();
    const allMissions = await this.queue.list({ take: 200 });

    const items: WorkspaceScanItem[] = [];
    for (const ws of list) {
      const wsMissions = allMissions.filter(
        (m) =>
          m.workspaceId === ws.id ||
          m.workspaceId === ws.projectId,
      );
      const pendingTasks = ws.tasks.filter((t) => t.status !== "DONE").length;
      const flags = classifyMissions(wsMissions);
      const issues: string[] = [];
      if (ws.status !== "ACTIVE" && ws.status !== "PLANNED") {
        issues.push(`status=${ws.status}`);
      }

      const attentionReasons: CoordinationReason[] = [];
      if (flags.hasBlockedMission) {
        attentionReasons.push("missao_bloqueada");
      }
      if (flags.hasWaitingMission) {
        attentionReasons.push("missao_aguardando");
      }
      if (flags.hasStaleOrFailed) {
        attentionReasons.push("missao_parada");
      }
      if (pendingTasks > 0 && !flags.hasActiveMission && !flags.hasReadyMission) {
        attentionReasons.push("backlog");
      }
      if (ws.status === "ACTIVE" && flags.openCount === 0 && pendingTasks > 0) {
        attentionReasons.push("mudanca_importante");
      }
      // Workspace ACTIVE sem missao recente de coordenacao: sinal operacional.
      if (ws.status === "ACTIVE" && flags.openCount === 0 && pendingTasks === 0) {
        // sem backlog — nao forca atencao
      }

      const needsAttention =
        ws.status === "ACTIVE" && attentionReasons.length > 0;

      items.push({
        workspaceId: ws.id,
        name: ws.name,
        status: ws.status,
        projectId: ws.projectId,
        pendingTasks,
        teamSize: ws.teamIds.length,
        hasActiveMission: flags.hasActiveMission,
        hasBlockedMission: flags.hasBlockedMission,
        hasWaitingMission: flags.hasWaitingMission,
        hasReadyMission: flags.hasReadyMission,
        hasBacklog: pendingTasks > 0,
        hasChanges: pendingTasks > 0 || flags.hasStaleOrFailed,
        needsAttention,
        attentionReasons,
        openMissions: flags.openCount,
        ready: ws.status === "ACTIVE" && issues.length === 0,
        issues,
      });
    }

    const active = items.filter((i) => i.status === "ACTIVE");
    return {
      scannedAt: this.clock.now().toISOString(),
      workspaces: items,
      activeCount: active.length,
      readyCount: items.filter((i) => i.ready).length,
      attentionCount: items.filter((i) => i.needsAttention).length,
    };
  }
}

function classifyMissions(missions: readonly MissionView[]) {
  let hasActiveMission = false;
  let hasBlockedMission = false;
  let hasWaitingMission = false;
  let hasReadyMission = false;
  let hasStaleOrFailed = false;
  let openCount = 0;

  for (const m of missions) {
    // COORDINATE/CONSOLIDATE sao a propria resposta operacional — nao
    // devem apagar backlog/mudanca_importante (evita re-borda artificial).
    const isCoordinationLayer =
      m.missionKind === "COORDINATE" || m.missionKind === "CONSOLIDATE";

    if (
      m.status === "QUEUED" ||
      m.status === "RUNNING" ||
      m.status === "CREATED" ||
      m.status === "WAITING"
    ) {
      if (!isCoordinationLayer) {
        openCount += 1;
        hasActiveMission = true;
      }
    }
    if (m.readiness === "BLOCKED") {
      hasBlockedMission = true;
    }
    if (m.status === "WAITING" && !isCoordinationLayer) {
      hasWaitingMission = true;
    }
    // WAITING de COORDINATE (pai aguardando filhos) ainda e sinal operacional.
    if (m.status === "WAITING" && m.missionKind === "COORDINATE") {
      hasWaitingMission = true;
    }
    if (
      !isCoordinationLayer &&
      (m.status === "QUEUED" || m.status === "CREATED")
    ) {
      hasReadyMission = true;
    }
    if (m.status === "FAILED") {
      hasStaleOrFailed = true;
    }
  }

  return {
    hasActiveMission,
    hasBlockedMission,
    hasWaitingMission,
    hasReadyMission,
    hasStaleOrFailed,
    openCount,
  };
}
