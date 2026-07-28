import { CEO_EMPLOYEE_ID } from "../mission-states.js";
import type { MissionQueuePort, SupervisorLoggerPort } from "./ports.js";
import type {
  CoordinationReason,
  CoordinationRequest,
  DispatchResult,
  MissionScanReport,
  QueueScanReport,
  RecoveryReport,
  WorkspaceScanReport,
} from "./types.js";
import { SupervisorEvent } from "./types.js";

/**
 * CoordinationDispatcher — cria missoes COORDINATE para a Opera.
 *
 * Nao interpreta objetivos, nao escolhe especialistas, nao cria planos,
 * nao escolhe projeto/ancora, nao copia prioridade.
 * Sem sinais operacionais: encerra o ciclo sem criar missao.
 */
export class CoordinationDispatcher {
  constructor(
    private readonly queue: MissionQueuePort,
    private readonly logger: SupervisorLoggerPort,
  ) {}

  async dispatch(input: {
    readonly workspaces: WorkspaceScanReport;
    readonly missions: MissionScanReport;
    readonly queue: QueueScanReport;
    readonly recovery: RecoveryReport;
    readonly healthOk: boolean;
  }): Promise<DispatchResult> {
    if (!input.healthOk) {
      return {
        dispatched: 0,
        skipped: 1,
        recovered: input.recovery.infraRecovered,
        details: ["health fail — sem coordination"],
        coordinations: [],
      };
    }

    const requests = collectCoordinationRequests({
      workspaces: input.workspaces,
      missions: input.missions,
      queue: input.queue,
    });
    if (requests.length === 0) {
      return {
        dispatched: 0,
        skipped: 1,
        recovered: input.recovery.infraRecovered,
        details: ["sem sinal operacional — ciclo encerrado"],
        coordinations: [],
      };
    }

    const details: string[] = [];
    let dispatched = 0;
    const created: CoordinationRequest[] = [];

    for (const req of requests) {
      const objective = buildCoordinationObjective(req);
      const result = await this.queue.enqueue({
        workspaceId: req.workspaceId,
        projectId: req.projectId,
        objective,
        ownerEmployeeId: CEO_EMPLOYEE_ID,
        dedupe: true,
      });
      if (result.created) {
        dispatched += 1;
        created.push(req);
        this.logger.emit(SupervisorEvent.COORDINATION_CREATED, {
          workspaceId: req.workspaceId,
          reason: req.reason,
          missionId: result.id,
        });
        details.push(`${req.reason}:${req.workspaceId}`);
      }
    }

    return {
      dispatched,
      skipped: dispatched === 0 ? 1 : 0,
      recovered: input.recovery.infraRecovered,
      details,
      coordinations: created,
    };
  }
}

function collectCoordinationRequests(input: {
  readonly workspaces: WorkspaceScanReport;
  readonly missions: MissionScanReport;
  readonly queue: QueueScanReport;
}): CoordinationRequest[] {
  const requests: CoordinationRequest[] = [];
  const seen = new Set<string>();

  const push = (req: CoordinationRequest) => {
    const key = `${req.workspaceId}:${req.reason}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    requests.push(req);
  };

  for (const ws of input.workspaces.workspaces) {
    if (!ws.needsAttention) {
      continue;
    }
    for (const reason of ws.attentionReasons) {
      push({
        workspaceId: ws.workspaceId,
        projectId: ws.projectId,
        reason,
        detail: `workspace ${ws.name}: ${reason}`,
      });
    }
  }

  for (const m of input.missions.items) {
    if (!m.needsCoordination) {
      continue;
    }
    const reason: CoordinationReason =
      m.category === "RETRY"
        ? "retry"
        : m.category === "BLOCKED"
          ? "missao_bloqueada"
          : m.category === "STALE" || m.category === "TIMEOUT"
            ? "missao_parada"
            : m.category === "WAITING"
              ? "missao_aguardando"
              : "recuperacao";
    push({
      workspaceId: m.workspaceId,
      reason,
      detail: m.reason,
    });
  }

  // Congestao: sinal operacional atribuido a workspaces ja sob atencao
  // (nao escolhe ancora / prioridade de portfolio).
  if (input.queue.congested) {
    for (const ws of input.workspaces.workspaces) {
      if (!ws.needsAttention && ws.openMissions === 0) {
        continue;
      }
      push({
        workspaceId: ws.workspaceId,
        projectId: ws.projectId,
        reason: "congestionamento_fila",
        detail: `depth=${input.queue.depth}`,
      });
    }
  }

  // Recovery coberta por missoes com needsCoordination.
  // Sem workspace/missao atribuivel: nao inventa ancora.

  return requests;
}

function buildCoordinationObjective(req: CoordinationRequest): string {
  // Texto operacional neutro — Opera interpreta e decide.
  return `[COORDINATE/${req.reason}] Atencao operacional no workspace ${req.workspaceId}. ${req.detail}`;
}

/** Alias legado. */
export { CoordinationDispatcher as SupervisorDispatcher };
