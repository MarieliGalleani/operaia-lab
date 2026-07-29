/**
 * Workspace Portfolio Snapshot + Capacity Planning + Organizational Health.
 * Apenas observacao — nao decide. A Opera consome este retrato.
 */
import { prisma, MissionStatus } from "@operaia/database";
import { ProjectStatus, TaskStatus } from "@operaia/shared";
import type { ProjectRepository } from "../projects/domain/project.repository.js";
import type { TaskRepository } from "../tasks/domain/task.repository.js";
import type { MissionQueue } from "../runtime/mission-queue.js";

export interface CapacityPlanning {
  readonly workersAvailable: number;
  readonly workersBusy: number;
  readonly workersTotal: number;
  readonly missionsRunning: number;
  readonly missionsWaiting: number;
  readonly missionsQueued: number;
  readonly saturatedSpecializations: readonly string[];
  readonly remainingCapacity: number;
  readonly estimatedCompletionMs: number | null;
}

export interface ProjectPortfolioEntry {
  readonly projectId: string;
  readonly name: string;
  readonly status: string;
  readonly priority: string;
  readonly goalId: string | null;
  readonly goalTitle: string | null;
  readonly pendingTasks: number;
  readonly blockedTasks: number;
  readonly criticalTasks: readonly string[];
  readonly openMissions: number;
  readonly staleTaskDays: number | null;
}

export interface OrganizationalHealthReport {
  readonly delayedProjects: readonly string[];
  readonly stalledProjects: readonly string[];
  readonly highestRiskProjects: readonly string[];
  readonly idleWorkers: readonly string[];
  readonly overloadedWorkers: readonly string[];
  readonly bottleneckSpecializations: readonly string[];
  readonly blockingMissions: readonly string[];
  readonly recurrentFailures: readonly string[];
  readonly attentionRequired: readonly string[];
  readonly hints: readonly string[];
}

export interface WorkspacePortfolioSnapshot {
  readonly capturedAt: string;
  readonly activeProjects: readonly ProjectPortfolioEntry[];
  readonly pausedOrBlockedProjects: readonly ProjectPortfolioEntry[];
  readonly goals: readonly {
    readonly id: string;
    readonly title: string;
    readonly priority: string;
    readonly status: string;
  }[];
  readonly capacity: CapacityPlanning;
  readonly health: OrganizationalHealthReport;
  readonly memoryNotes: readonly string[];
}

const STALE_TASK_DAYS = 7;
const AVG_MISSION_MS = 8_000;

export async function buildWorkspacePortfolioSnapshot(deps: {
  readonly projects: ProjectRepository;
  readonly tasks: TaskRepository;
  readonly queue: MissionQueue;
}): Promise<WorkspacePortfolioSnapshot> {
  const projects = await deps.projects.findAll();
  const goals = await prisma.organizationalGoal.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
  const goalById = new Map(goals.map((goal) => [goal.id, goal]));

  const depths = await deps.queue.depths();
  const heartbeats = await prisma.workerHeartbeat.findMany();
  const openMissions = await prisma.mission.findMany({
    where: {
      status: {
        in: [
          MissionStatus.QUEUED,
          MissionStatus.RUNNING,
          MissionStatus.WAITING,
        ],
      },
    },
  });

  const entries: ProjectPortfolioEntry[] = [];
  for (const project of projects) {
    const tasks = await deps.tasks.findAll({ projectId: project.id });
    const pending = tasks.filter(
      (task) =>
        task.status === TaskStatus.TODO ||
        task.status === TaskStatus.IN_PROGRESS ||
        task.status === TaskStatus.BLOCKED,
    );
    const blocked = tasks.filter((task) => task.status === TaskStatus.BLOCKED);
    const critical = pending
      .filter(
        (task) => task.priority === "URGENT" || task.priority === "HIGH",
      )
      .map((task) => task.title)
      .slice(0, 5);

    let staleTaskDays: number | null = null;
    for (const task of pending) {
      const ageDays =
        (Date.now() - new Date(task.updatedAt).getTime()) /
        (24 * 60 * 60 * 1000);
      if (ageDays >= STALE_TASK_DAYS) {
        staleTaskDays = Math.max(staleTaskDays ?? 0, Math.floor(ageDays));
      }
    }

    const goal = project.goalId ? goalById.get(project.goalId) : undefined;
    entries.push({
      projectId: project.id,
      name: project.name,
      status: project.status,
      priority: project.priority,
      goalId: project.goalId ?? null,
      goalTitle: goal?.title ?? null,
      pendingTasks: pending.length,
      blockedTasks: blocked.length,
      criticalTasks: critical,
      openMissions: openMissions.filter(
        (mission) => mission.projectId === project.id,
      ).length,
      staleTaskDays,
    });
  }

  const activeProjects = entries.filter(
    (entry) => entry.status === ProjectStatus.ACTIVE,
  );
  const pausedOrBlockedProjects = entries.filter(
    (entry) =>
      entry.status === ProjectStatus.PAUSED || entry.blockedTasks > 0,
  );

  const workersAvailable = heartbeats.filter(
    (row) => row.status === "idle" || row.status === "starting",
  ).length;
  const workersBusy = heartbeats.filter((row) => row.status === "busy").length;
  const workersTotal = heartbeats.length;

  const runningBySpec = new Map<string, number>();
  for (const mission of openMissions) {
    if (
      mission.status === MissionStatus.RUNNING &&
      mission.requiredSpecialization
    ) {
      const key = mission.requiredSpecialization;
      runningBySpec.set(key, (runningBySpec.get(key) ?? 0) + 1);
    }
  }

  const saturatedSpecializations: string[] = [];
  for (const [spec, count] of runningBySpec) {
    // Saturacao: mais de 1 missao RUNNING da mesma especializacao e nenhum idle generico
    if (count >= 1 && workersAvailable === 0) {
      saturatedSpecializations.push(spec);
    }
  }

  // Especializacao saturada tambem quando ha QUEUED EXECUTE da mesma spec e worker busy
  const queuedExecute = openMissions.filter(
    (mission) =>
      mission.status === MissionStatus.QUEUED &&
      mission.missionKind === "EXECUTE",
  );
  for (const mission of queuedExecute) {
    const spec = mission.requiredSpecialization;
    if (!spec) {
      continue;
    }
    const ownerBusy = heartbeats.some(
      (row) =>
        row.employeeId === mission.ownerEmployeeId && row.status === "busy",
    );
    if (ownerBusy && !saturatedSpecializations.includes(spec)) {
      saturatedSpecializations.push(spec);
    }
  }

  const remainingCapacity = Math.max(0, workersAvailable);
  const backlog = depths.queued + depths.waiting + depths.running;
  const estimatedCompletionMs =
    backlog > 0 ? backlog * AVG_MISSION_MS : null;

  const capacity: CapacityPlanning = {
    workersAvailable,
    workersBusy,
    workersTotal,
    missionsRunning: depths.running,
    missionsWaiting: depths.waiting,
    missionsQueued: depths.queued,
    saturatedSpecializations,
    remainingCapacity,
    estimatedCompletionMs,
  };

  const health = buildOrganizationalHealth({
    activeProjects,
    heartbeats,
    openMissions,
    saturatedSpecializations,
  });

  const memoryNotes = [
    `[CAPACITY]${JSON.stringify({
      saturatedSpecializations: capacity.saturatedSpecializations,
      availableWorkers: capacity.workersAvailable,
      busyWorkers: capacity.workersBusy,
    })}`,
    ...health.hints.map((hint) => `[ORG_HEALTH]${hint}`),
    ...activeProjects.slice(0, 8).map(
      (project) =>
        `[PORTFOLIO]${project.name}: prioridade=${project.priority}, ` +
        `pendentes=${project.pendingTasks}, bloqueadas=${project.blockedTasks}` +
        (project.goalTitle ? `, objetivo=${project.goalTitle}` : "") +
        (project.staleTaskDays
          ? `, tarefas-antigas=${project.staleTaskDays}d`
          : ""),
    ),
  ];

  return {
    capturedAt: new Date().toISOString(),
    activeProjects,
    pausedOrBlockedProjects,
    goals: goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      priority: goal.priority,
      status: goal.status,
    })),
    capacity,
    health,
    memoryNotes,
  };
}

function buildOrganizationalHealth(input: {
  readonly activeProjects: readonly ProjectPortfolioEntry[];
  readonly heartbeats: readonly {
    readonly employeeId: string;
    readonly status: string;
    readonly metricsJson: unknown;
  }[];
  readonly openMissions: readonly {
    readonly id: string;
    readonly status: string;
    readonly requiredSpecialization: string | null;
    readonly lastError: string | null;
  }[];
  readonly saturatedSpecializations: readonly string[];
}): OrganizationalHealthReport {
  const delayedProjects = input.activeProjects
    .filter((project) => (project.staleTaskDays ?? 0) >= STALE_TASK_DAYS)
    .map((project) => project.name);

  const stalledProjects = input.activeProjects
    .filter(
      (project) =>
        project.pendingTasks > 0 &&
        project.openMissions === 0 &&
        project.blockedTasks > 0,
    )
    .map((project) => project.name);

  const highestRiskProjects = input.activeProjects
    .filter(
      (project) =>
        project.blockedTasks > 0 ||
        project.priority === "URGENT" ||
        (project.staleTaskDays ?? 0) >= STALE_TASK_DAYS,
    )
    .map((project) => project.name);

  const idleWorkers = input.heartbeats
    .filter((row) => row.status === "idle")
    .map((row) => row.employeeId);

  const overloadedWorkers = input.heartbeats
    .filter((row) => {
      const metrics = row.metricsJson as {
        missionsFailed?: number;
        avgDurationMs?: number;
      } | null;
      return (
        row.status === "busy" ||
        (metrics?.missionsFailed ?? 0) > 3 ||
        (metrics?.avgDurationMs ?? 0) > 60_000
      );
    })
    .map((row) => row.employeeId);

  const blockingMissions = input.openMissions
    .filter((mission) => mission.status === "WAITING")
    .map((mission) => mission.id)
    .slice(0, 10);

  const recurrentFailures = input.openMissions
    .filter((mission) => Boolean(mission.lastError))
    .map((mission) => mission.lastError!)
    .slice(0, 5);

  const attentionRequired = [
    ...new Set([
      ...highestRiskProjects.slice(0, 3),
      ...stalledProjects.slice(0, 3),
    ]),
  ];

  const hints: string[] = [];
  if (delayedProjects.length > 0) {
    hints.push(`Projetos atrasados: ${delayedProjects.join(", ")}`);
  }
  if (stalledProjects.length > 0) {
    hints.push(`Projetos parados/bloqueados: ${stalledProjects.join(", ")}`);
  }
  if (idleWorkers.length > 0) {
    hints.push(`Workers ociosos: ${idleWorkers.length}`);
  }
  if (input.saturatedSpecializations.length > 0) {
    hints.push(
      `Especializacoes saturadas: ${input.saturatedSpecializations.join(", ")}`,
    );
  }
  if (attentionRequired.length > 0) {
    hints.push(`Atencao imediata: ${attentionRequired.join(", ")}`);
  }
  if (hints.length === 0) {
    hints.push("Saude organizacional estavel no ciclo atual.");
  }

  return {
    delayedProjects,
    stalledProjects,
    highestRiskProjects,
    idleWorkers,
    overloadedWorkers,
    bottleneckSpecializations: input.saturatedSpecializations,
    blockingMissions,
    recurrentFailures,
    attentionRequired,
    hints,
  };
}

/**
 * Escolhe o projeto-ancora do COORDINATE de portfolio (sem hardcode de nome).
 * Criterio: objetivo organizacional > prioridade > pendencias.
 */
export function pickPortfolioAnchorProject(
  snapshot: WorkspacePortfolioSnapshot,
): ProjectPortfolioEntry | null {
  const active = [...snapshot.activeProjects];
  if (active.length === 0) {
    return null;
  }

  const priorityRank: Record<string, number> = {
    URGENT: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };

  active.sort((a, b) => {
    const attentionA = snapshot.health.attentionRequired.includes(a.name)
      ? 0
      : 1;
    const attentionB = snapshot.health.attentionRequired.includes(b.name)
      ? 0
      : 1;
    if (attentionA !== attentionB) {
      return attentionA - attentionB;
    }
    const goalA = a.goalId ? 0 : 1;
    const goalB = b.goalId ? 0 : 1;
    if (goalA !== goalB) {
      return goalA - goalB;
    }
    const pa = priorityRank[a.priority] ?? 9;
    const pb = priorityRank[b.priority] ?? 9;
    if (pa !== pb) {
      return pa - pb;
    }
    return b.pendingTasks - a.pendingTasks;
  });

  return active[0] ?? null;
}
