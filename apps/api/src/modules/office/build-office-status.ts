import {
  ApprovalStatus,
  DomainSignalEvaluationDecision,
  MissionStatus,
  prisma,
} from "@operaia/database";
import type { ContinuousRuntime } from "../runtime/continuous-runtime.js";
import {
  classifyOfficeStatus,
  type OfficeLevel,
} from "./classify-office-status.js";

const WINDOW_MS = 24 * 60 * 60 * 1000;
const COMPLETED_TAKE = 8;
const ATTENTION_TAKE = 12;
const HUMAN_PROPOSALS_TAKE = 10;

export interface OfficeStatusResponse {
  readonly generatedAt: string;
  readonly windowHours: number;
  readonly status: {
    readonly level: OfficeLevel;
    readonly label: string;
    readonly summary: string;
    readonly reasons: readonly string[];
    readonly healthOk: boolean;
    readonly readyOk: boolean;
    readonly supervisor: {
      readonly running: boolean;
      readonly cycle: number;
      readonly lastSnapshotAt: string | null;
      readonly uptimeMs: number;
    };
    readonly workers: {
      readonly alive: number;
      readonly expected: number;
      readonly busy: number;
      readonly available: number;
    };
    readonly queue: {
      readonly queued: number;
      readonly running: number;
      readonly waiting: number;
      readonly failedHistorical: number;
    };
    readonly uptimeMs: number | null;
  };
  readonly activity: {
    readonly idle: boolean;
    readonly message: string;
    readonly missionsRunning: number;
    readonly missionsQueued: number;
    readonly missionsWaiting: number;
    readonly workersBusy: number;
    readonly workersAvailable: number;
    readonly runningObjectives: readonly {
      readonly id: string;
      readonly objective: string;
    }[];
  };
  readonly attention: {
    readonly items: readonly {
      readonly severity: "blocker" | "critical" | "warning" | "info";
      readonly code: string;
      readonly title: string;
      readonly detail: string;
    }[];
    readonly failed: {
      readonly historicalTotal: number;
      readonly newInWindow: number;
      readonly note: string;
    };
  };
  readonly governance: {
    readonly gate: {
      readonly windowHours: number;
      readonly execute: number;
      readonly skip: number;
      readonly reuse: number;
      readonly reopen: number;
      readonly recent: readonly {
        readonly decision: string;
        readonly reason: string;
        readonly source: string;
        readonly createdAt: string;
      }[];
    };
    readonly policy: {
      readonly deferInWindow: number;
      readonly ignoreInWindow: number;
      readonly convertCandidateInWindow: number;
      readonly note: string;
    };
  };
  readonly completed: {
    readonly items: readonly {
      readonly id: string;
      readonly title: string;
      readonly finishedAt: string | null;
      readonly kind: string;
    }[];
    readonly emptyMessage: string;
  };
  readonly humanAction: {
    readonly needed: boolean;
    readonly message: string;
    readonly proposals: readonly {
      readonly id: string;
      readonly title: string;
      readonly status: string;
      readonly createdAt: string;
    }[];
  };
  readonly sources: {
    readonly health: "ok" | "error";
    readonly ready: "ok" | "error";
    readonly runtime: "ok" | "error";
    readonly gate: "ok" | "error";
    readonly signals: "ok" | "error";
    readonly missions: "ok" | "error";
    readonly governance: "ok" | "error";
  };
  readonly degradations: readonly string[];
}

function humanizeObjective(objective: string): string {
  const trimmed = objective.trim();
  if (trimmed.length <= 120) {
    return trimmed;
  }
  return `${trimmed.slice(0, 117)}…`;
}

function extractDeliveryTitle(
  objective: string,
  resultJson: unknown,
): string {
  if (resultJson && typeof resultJson === "object") {
    const record = resultJson as Record<string, unknown>;
    const usable = record.usableResult;
    if (usable && typeof usable === "object") {
      const u = usable as Record<string, unknown>;
      if (typeof u.summary === "string" && u.summary.trim()) {
        return humanizeObjective(u.summary);
      }
      if (typeof u.title === "string" && u.title.trim()) {
        return humanizeObjective(u.title);
      }
    }
    const delivery = record.delivery;
    if (delivery && typeof delivery === "object") {
      const d = delivery as Record<string, unknown>;
      if (typeof d.summary === "string" && d.summary.trim()) {
        return humanizeObjective(d.summary);
      }
    }
  }
  return humanizeObjective(objective);
}

async function probeHealth(): Promise<boolean> {
  return true;
}

async function probeReady(): Promise<boolean> {
  await prisma.$queryRaw`SELECT 1`;
  return true;
}

/**
 * Agrega estado operacional existente — READ-ONLY.
 * Não decide, não cria missão, não altera Gate/Supervisor/Queue.
 */
export async function buildOfficeStatus(
  runtime: ContinuousRuntime,
): Promise<OfficeStatusResponse> {
  const generatedAt = new Date().toISOString();
  const since = new Date(Date.now() - WINDOW_MS);
  const degradations: string[] = [];
  const sources = {
    health: "ok" as "ok" | "error",
    ready: "ok" as "ok" | "error",
    runtime: "ok" as "ok" | "error",
    gate: "ok" as "ok" | "error",
    signals: "ok" as "ok" | "error",
    missions: "ok" as "ok" | "error",
    governance: "ok" as "ok" | "error",
  };

  let healthOk = false;
  let readyOk = false;
  try {
    healthOk = await probeHealth();
  } catch {
    sources.health = "error";
    degradations.push("Health temporariamente indisponível.");
  }
  try {
    readyOk = await probeReady();
  } catch {
    sources.ready = "error";
    readyOk = false;
    degradations.push("Ready/database temporariamente indisponível.");
  }

  let snap: Awaited<ReturnType<ContinuousRuntime["snapshot"]>> | null = null;
  try {
    snap = await runtime.snapshot();
  } catch {
    sources.runtime = "error";
    degradations.push("Runtime snapshot temporariamente indisponível.");
  }

  const supervisor = snap?.supervisor ?? {
    running: false,
    cycle: 0,
    uptimeMs: 0,
    lastSnapshotAt: null as string | null,
  };
  const workersList = snap?.workers ?? [];
  const workersAlive = snap?.workersAlive ?? 0;
  const workersExpected = workersList.length;
  const busy = workersList.filter(
    (w) => w.currentMissionId !== null && w.status !== "stopped",
  ).length;
  const available = Math.max(0, workersAlive - busy);
  const queue = snap?.queue ?? {
    queued: 0,
    running: 0,
    waiting: 0,
    failed: 0,
  };

  const ops = snap?.operationalSnapshot ?? null;
  const supervisorHealthOverall =
    ops?.health?.overall === "ok" ||
    ops?.health?.overall === "degraded" ||
    ops?.health?.overall === "fail"
      ? ops.health.overall
      : null;
  const recoveryRecent = (ops?.recovery?.infraRecovered ?? 0) > 0;
  const queueCongested = ops?.queue?.congested === true;

  let gateCounts = {
    execute: 0,
    skip: 0,
    reuse: 0,
    reopen: 0,
  };
  let gateRecent: OfficeStatusResponse["governance"]["gate"]["recent"] = [];
  try {
    const rows = await prisma.workGovernanceDecision.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        decision: true,
        reason: true,
        source: true,
        createdAt: true,
      },
    });
    for (const row of rows) {
      const d = row.decision.toUpperCase();
      if (d === "EXECUTE") gateCounts.execute += 1;
      else if (d === "SKIP") gateCounts.skip += 1;
      else if (d === "REUSE") gateCounts.reuse += 1;
      else if (d === "REOPEN") gateCounts.reopen += 1;
    }
    gateRecent = rows.slice(0, 8).map((row) => ({
      decision: row.decision,
      reason: row.reason,
      source: row.source,
      createdAt: row.createdAt.toISOString(),
    }));
  } catch {
    sources.gate = "error";
    degradations.push(
      "Status geral disponível. Dados de Gate temporariamente indisponíveis.",
    );
  }

  let policy = {
    deferInWindow: 0,
    ignoreInWindow: 0,
    convertCandidateInWindow: 0,
  };
  try {
    const [deferInWindow, ignoreInWindow, convertCandidateInWindow] =
      await Promise.all([
        prisma.domainSignal.count({
          where: {
            evaluatedAt: { gte: since },
            evaluationDecision: DomainSignalEvaluationDecision.DEFER,
          },
        }),
        prisma.domainSignal.count({
          where: {
            evaluatedAt: { gte: since },
            evaluationDecision: DomainSignalEvaluationDecision.IGNORE,
          },
        }),
        prisma.domainSignal.count({
          where: {
            evaluatedAt: { gte: since },
            evaluationDecision:
              DomainSignalEvaluationDecision.CONVERT_CANDIDATE,
          },
        }),
      ]);
    policy = { deferInWindow, ignoreInWindow, convertCandidateInWindow };
  } catch {
    sources.signals = "error";
    degradations.push("Dados de Policy/sinais temporariamente indisponíveis.");
  }

  let failedHistorical = queue.failed;
  let failedNew24h = 0;
  let runningObjectives: { id: string; objective: string }[] = [];
  let completedItems: OfficeStatusResponse["completed"]["items"] = [];
  try {
    const [hist, neu, running, completed] = await Promise.all([
      prisma.mission.count({ where: { status: MissionStatus.FAILED } }),
      prisma.mission.count({
        where: {
          status: MissionStatus.FAILED,
          finishedAt: { gte: since },
        },
      }),
      prisma.mission.findMany({
        where: { status: MissionStatus.RUNNING },
        orderBy: { startedAt: "desc" },
        take: 6,
        select: { id: true, objective: true },
      }),
      prisma.mission.findMany({
        where: {
          status: MissionStatus.COMPLETED,
          finishedAt: { gte: since },
          parentMissionId: null,
        },
        orderBy: { finishedAt: "desc" },
        take: COMPLETED_TAKE,
        select: {
          id: true,
          objective: true,
          finishedAt: true,
          missionKind: true,
          resultJson: true,
        },
      }),
    ]);
    failedHistorical = hist;
    failedNew24h = neu;
    runningObjectives = running.map((m) => ({
      id: m.id,
      objective: humanizeObjective(m.objective),
    }));
    completedItems = completed.map((m) => ({
      id: m.id,
      title: extractDeliveryTitle(m.objective, m.resultJson),
      finishedAt: m.finishedAt?.toISOString() ?? null,
      kind: m.missionKind,
    }));
  } catch {
    sources.missions = "error";
    degradations.push("Dados de missões temporariamente indisponíveis.");
  }

  let proposals: OfficeStatusResponse["humanAction"]["proposals"] = [];
  let pendingHumanApprovals = 0;
  try {
    const waiting = await prisma.changeProposal.findMany({
      where: {
        approvalStatus: {
          in: [
            ApprovalStatus.WAITING_APPROVAL,
            ApprovalStatus.PROPOSED,
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: HUMAN_PROPOSALS_TAKE,
      select: {
        id: true,
        title: true,
        approvalStatus: true,
        createdAt: true,
      },
    });
    proposals = waiting.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.approvalStatus,
      createdAt: p.createdAt.toISOString(),
    }));
    pendingHumanApprovals = waiting.length;
  } catch {
    sources.governance = "error";
    degradations.push(
      "Propostas de mudança temporariamente indisponíveis.",
    );
  }

  const classification = classifyOfficeStatus({
    healthOk,
    readyOk,
    runtimeStarted: snap?.started ?? false,
    supervisorRunning: supervisor.running,
    workersAlive,
    workersExpected,
    supervisorHealthOverall,
    failedNew24h,
    pendingHumanApprovals,
    recoveryRecent,
    queueCongested,
    signalDefer24h: policy.deferInWindow,
  });

  const attentionItems: Array<{
    severity: "blocker" | "critical" | "warning" | "info";
    code: string;
    title: string;
    detail: string;
  }> = [];

  if (!healthOk || sources.health === "error") {
    attentionItems.push({
      severity: "blocker",
      code: "health",
      title: "Health indisponível",
      detail: "O endpoint de saúde não confirmou OK.",
    });
  }
  if (!readyOk) {
    attentionItems.push({
      severity: "blocker",
      code: "ready",
      title: "Banco não respondeu",
      detail: "Ready check falhou — o escritório pode não persistir trabalho.",
    });
  }
  if ((snap?.started ?? false) && workersAlive === 0) {
    attentionItems.push({
      severity: "critical",
      code: "workers_down",
      title: "Nenhum worker ativo",
      detail: "A equipe digital não está disponível para executar missões.",
    });
  }
  if ((snap?.started ?? false) && !supervisor.running) {
    attentionItems.push({
      severity: "critical",
      code: "supervisor_stopped",
      title: "Supervisor parado",
      detail: "O loop operacional não está rodando.",
    });
  }
  if (supervisorHealthOverall === "fail") {
    attentionItems.push({
      severity: "critical",
      code: "supervisor_health_fail",
      title: "Saúde operacional em falha",
      detail: "O último ciclo do Supervisor reportou falha.",
    });
  } else if (supervisorHealthOverall === "degraded") {
    attentionItems.push({
      severity: "warning",
      code: "supervisor_health_degraded",
      title: "Saúde operacional degradada",
      detail: "O Supervisor reportou degradação no último ciclo.",
    });
  }
  if (recoveryRecent) {
    attentionItems.push({
      severity: "warning",
      code: "recovery_recent",
      title: "Recovery recente",
      detail: `O último ciclo recuperou ${ops?.recovery?.infraRecovered ?? 0} item(ns) de infraestrutura.`,
    });
  }
  if (queueCongested) {
    attentionItems.push({
      severity: "warning",
      code: "queue_congested",
      title: "Fila congestionada",
      detail: "O scan da fila marcou congestão (métrica existente do Supervisor).",
    });
  }
  if (failedNew24h > 0) {
    attentionItems.push({
      severity: "warning",
      code: "failed_new",
      title: "Falhas novas nas últimas 24h",
      detail: `${failedNew24h} missão(ões) FAILED com finishedAt recente. Histórico acumulado: ${failedHistorical}.`,
    });
  }
  if (policy.deferInWindow > 0) {
    attentionItems.push({
      severity: "info",
      code: "signal_defer",
      title: "Sinais adiados (DEFER)",
      detail: `${policy.deferInWindow} sinal(is) com decisão DEFER nas últimas 24h.`,
    });
  }
  if (
    workersExpected > 0 &&
    workersAlive > 0 &&
    workersAlive < workersExpected
  ) {
    attentionItems.push({
      severity: "warning",
      code: "workers_partial",
      title: "Workers parciais",
      detail: `${workersAlive} de ${workersExpected} workers vivos.`,
    });
  }
  if (pendingHumanApprovals > 0) {
    attentionItems.push({
      severity: "warning",
      code: "needs_owner",
      title: "Aprovação humana pendente",
      detail: `${pendingHumanApprovals} ChangeProposal aguardando você.`,
    });
  }

  const idle =
    queue.queued === 0 &&
    queue.running === 0 &&
    queue.waiting === 0 &&
    busy === 0;

  const humanNeeded = pendingHumanApprovals > 0;

  return {
    generatedAt,
    windowHours: 24,
    status: {
      level: classification.level,
      label: classification.label,
      summary: classification.summary,
      reasons: classification.reasons,
      healthOk,
      readyOk,
      supervisor: {
        running: supervisor.running,
        cycle: supervisor.cycle,
        lastSnapshotAt: supervisor.lastSnapshotAt,
        uptimeMs: supervisor.uptimeMs,
      },
      workers: {
        alive: workersAlive,
        expected: workersExpected,
        busy,
        available,
      },
      queue: {
        queued: queue.queued,
        running: queue.running,
        waiting: queue.waiting,
        failedHistorical,
      },
      uptimeMs: snap?.uptimeMs ?? null,
    },
    activity: {
      idle,
      message: idle
        ? "Sem trabalho pendente."
        : "Há trabalho em andamento no escritório.",
      missionsRunning: queue.running,
      missionsQueued: queue.queued,
      missionsWaiting: queue.waiting,
      workersBusy: busy,
      workersAvailable: available,
      runningObjectives,
    },
    attention: {
      items: attentionItems.slice(0, ATTENTION_TAKE),
      failed: {
        historicalTotal: failedHistorical,
        newInWindow: failedNew24h,
        note: "FAILED histórico não é tratado como problema atual. Apenas FAILED com finishedAt nas últimas 24h entram em atenção.",
      },
    },
    governance: {
      gate: {
        windowHours: 24,
        execute: gateCounts.execute,
        skip: gateCounts.skip,
        reuse: gateCounts.reuse,
        reopen: gateCounts.reopen,
        recent: gateRecent,
      },
      policy: {
        ...policy,
        note: "DEFER/IGNORE/CONVERT vêm de DomainSignal.evaluationDecision (Policy). ASK_HUMAN não existe no Gate — ação humana vem de ChangeProposal.",
      },
    },
    completed: {
      items: completedItems,
      emptyMessage:
        completedItems.length === 0
          ? "Nenhuma entrega concluída nas últimas 24h."
          : "",
    },
    humanAction: {
      needed: humanNeeded,
      message: humanNeeded
        ? "O escritório precisa de você."
        : "Você não precisa fazer nada agora.",
      proposals,
    },
    sources,
    degradations,
  };
}
