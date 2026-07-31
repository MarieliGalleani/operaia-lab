/**
 * Bootstrap multi-workspace: garante Project ACTIVE para cada workspaceId
 * derivado de WorkspaceSourceBinding enabled (sem privilegiar NEXO).
 */
import { Priority, ProjectStatus } from "@operaia/shared";
import {
  publicWorkspaceId,
  resolveProjectNameFromSlug,
  toWorkspaceSlug,
} from "../employees/workspace-mappers.js";
import type { Project } from "./domain/project.entity.js";
import type { ProjectRepository } from "./domain/project.repository.js";

export interface EnsureOperationalWorkspacesResult {
  readonly ensured: readonly Project[];
  readonly workspaceIds: readonly string[];
  readonly createdIds: readonly string[];
  readonly activatedIds: readonly string[];
}

/**
 * Para cada workspaceId de binding ativo: resolve ou cria Project ACTIVE.
 * Idempotente. Nao remove Projects existentes sem binding.
 */
export async function ensureOperationalWorkspaces(input: {
  readonly projects: ProjectRepository;
  readonly bindingWorkspaceIds: readonly string[];
}): Promise<EnsureOperationalWorkspacesResult> {
  const ensured: Project[] = [];
  const createdIds: string[] = [];
  const activatedIds: string[] = [];
  const workspaceIds: string[] = [];
  const seen = new Set<string>();

  for (const rawId of input.bindingWorkspaceIds) {
    const workspaceId = rawId?.trim();
    if (!workspaceId || seen.has(workspaceId.toLowerCase())) {
      continue;
    }
    seen.add(workspaceId.toLowerCase());

    const project = await resolveOrCreateProject(input.projects, workspaceId);
    const activated = await ensureActive(input.projects, project);
    if (activated.created) {
      createdIds.push(activated.project.id);
    }
    if (activated.reactivated) {
      activatedIds.push(activated.project.id);
    }
    ensured.push(activated.project);
    workspaceIds.push(publicWorkspaceId(activated.project));
  }

  return { ensured, workspaceIds, createdIds, activatedIds };
}

async function resolveOrCreateProject(
  projects: ProjectRepository,
  workspaceId: string,
): Promise<Project & { created?: boolean }> {
  const byId = await projects.findById(workspaceId);
  if (byId) {
    return byId;
  }

  const canonicalName =
    resolveProjectNameFromSlug(workspaceId) ?? workspaceId;
  const byName = await projects.findByName(canonicalName);
  if (byName) {
    return byName;
  }

  if (canonicalName !== workspaceId) {
    const byRawName = await projects.findByName(workspaceId);
    if (byRawName) {
      return byRawName;
    }
  }

  const all = await projects.findAll();
  const bySlug = all.find(
    (project) => publicWorkspaceId(project) === workspaceId.toLowerCase(),
  );
  if (bySlug) {
    return bySlug;
  }

  const name =
    resolveProjectNameFromSlug(workspaceId) ??
    humanizeWorkspaceId(workspaceId);

  const created = await projects.create({
    name,
    description: `Workspace operacional ${name}`,
    status: ProjectStatus.ACTIVE,
    priority: Priority.MEDIUM,
  });
  return Object.assign(created, { created: true as const });
}

async function ensureActive(
  projects: ProjectRepository,
  project: Project & { created?: boolean },
): Promise<{
  readonly project: Project;
  readonly created: boolean;
  readonly reactivated: boolean;
}> {
  if (project.status === ProjectStatus.ACTIVE) {
    return {
      project,
      created: Boolean(project.created),
      reactivated: false,
    };
  }
  const updated = await projects.update(project.id, {
    status: ProjectStatus.ACTIVE,
  });
  return {
    project: updated,
    created: Boolean(project.created),
    reactivated: true,
  };
}

function humanizeWorkspaceId(workspaceId: string): string {
  if (workspaceId.includes(" ")) {
    return workspaceId.trim();
  }
  const slug = toWorkspaceSlug(workspaceId);
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
