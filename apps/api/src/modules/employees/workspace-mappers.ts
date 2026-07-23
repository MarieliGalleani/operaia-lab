import type { EmployeeTask } from "@operaia/employee-framework";
import type { Priority, ProjectStatus, TaskStatus } from "@operaia/shared";
import type { Project } from "../projects/domain/project.entity.js";
import type { Task } from "../tasks/domain/task.entity.js";
import type { OfficeWorkspaceRecord } from "./workspace-source.js";

/** Slugs estaveis usados pelo escritorio virtual (mesmo Project, id publico). */
export const PROJECT_NAME_SLUGS: Readonly<Record<string, string>> = {
  NEXO: "nexo",
  MenuFlow: "menuflow",
  Plataforma: "plataforma",
};

const SLUG_TO_NAME: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(PROJECT_NAME_SLUGS).map(([name, slug]) => [slug, name]),
);

export function publicWorkspaceId(project: Project): string {
  return PROJECT_NAME_SLUGS[project.name] ?? project.id;
}

export function resolveProjectNameFromSlug(workspaceId: string): string | undefined {
  return SLUG_TO_NAME[workspaceId.toLowerCase()];
}

const PRIORITY_SCORE: Record<Priority, number> = {
  URGENT: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
};

/** Task de dominio → EmployeeTask (briefing). */
export function toEmployeeTask(task: Task): EmployeeTask {
  const score = PRIORITY_SCORE[task.priority] ?? 3;
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    impact: score,
    urgency: score,
  };
}

export function mapProjectStatus(
  status: ProjectStatus,
): OfficeWorkspaceRecord["status"] {
  if (status === "ARCHIVED") {
    return "COMPLETED";
  }
  return status;
}

export function computeProgress(tasks: readonly Task[]): number {
  if (tasks.length === 0) {
    return 0;
  }
  const done = tasks.filter((task) => task.status === "DONE").length;
  return Math.round((done / tasks.length) * 100);
}

export function buildOfficeWorkspace(
  project: Project,
  tasks: readonly Task[],
  teamIds: readonly string[],
): OfficeWorkspaceRecord {
  const employeeTasks = tasks.map(toEmployeeTask);
  return {
    id: publicWorkspaceId(project),
    projectId: project.id,
    name: project.name,
    objective: project.description?.trim() || `Conduzir o projeto ${project.name}`,
    status: mapProjectStatus(project.status),
    progress: computeProgress(tasks),
    teamIds,
    tasks: employeeTasks,
  };
}

export function toWorkspaceSnapshotFromRecord(
  workspace: OfficeWorkspaceRecord,
): import("@operaia/employee-framework").WorkspaceSnapshot {
  return {
    workspaceId: workspace.id,
    name: workspace.name,
    objective: workspace.objective,
    executiveSummary: `${workspace.name} — ${workspace.status} (${workspace.progress}%).`,
    tasks: workspace.tasks,
  };
}

export function mapTaskStatusForUi(
  status: TaskStatus,
): "BACKLOG" | "IN_PROGRESS" | "DONE" {
  if (status === "DONE") {
    return "DONE";
  }
  if (status === "IN_PROGRESS") {
    return "IN_PROGRESS";
  }
  return "BACKLOG";
}

export function mapPriorityForUi(priority: Priority): Priority {
  return priority;
}
