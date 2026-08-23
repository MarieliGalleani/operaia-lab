/**
 * Bootstrap do catalogo operacional oficial.
 * Upsert Project ACTIVE + WorkspaceSourceBinding (github) — idempotente.
 * Nao cria webhook nem altera Bridge.
 */
import { Priority, ProjectStatus } from "@operaia/shared";
import type { UpsertBindingInput } from "@operaia/domain-signals";
import { GITHUB_SOURCE_TYPE } from "@operaia/domain-signals";
import { publicWorkspaceId } from "../employees/workspace-mappers.js";
import type { Project } from "./domain/project.entity.js";
import type { ProjectRepository } from "./domain/project.repository.js";
import { ensureOperationalWorkspaces } from "./ensure-operational-workspaces.js";
import {
  OFFICIAL_OPERATIONAL_WORKSPACES,
  canonicalGithubExternalRef,
} from "./official-operational-catalog.js";

export interface EnsureOfficialOperationalCatalogResult {
  readonly workspaceIds: readonly string[];
  readonly projectsEnsured: number;
  readonly bindingsUpserted: number;
  readonly createdProjectIds: readonly string[];
}

export async function ensureOfficialOperationalCatalog(input: {
  readonly projects: ProjectRepository;
  readonly upsertBinding: (
    binding: UpsertBindingInput,
  ) => Promise<unknown>;
}): Promise<EnsureOfficialOperationalCatalogResult> {
  // 1) Projects ACTIVE (upsert via ensure genérico + nomes canônicos).
  for (const entry of OFFICIAL_OPERATIONAL_WORKSPACES) {
    await ensureNamedProject(input.projects, entry.name, entry.description);
  }

  const projectsResult = await ensureOperationalWorkspaces({
    projects: input.projects,
    bindingWorkspaceIds: OFFICIAL_OPERATIONAL_WORKSPACES.map(
      (entry) => entry.workspaceId,
    ),
  });

  // 2) Bindings GitHub (upsert) — prepara catalogo; webhook na proxima fase.
  let bindingsUpserted = 0;
  for (const entry of OFFICIAL_OPERATIONAL_WORKSPACES) {
    await input.upsertBinding({
      workspaceId: entry.workspaceId,
      sourceType: GITHUB_SOURCE_TYPE,
      externalRef: canonicalGithubExternalRef(entry.repository),
      enabled: true,
      configJson: {
        pushBranches: ["main", "master"],
        ignoreDraftPr: true,
        ignoreUnmergedClose: true,
        ignoreIssueClosed: true,
        repository: canonicalGithubExternalRef(entry.repository),
        ...(entry.operationalRef
          ? { operationalRef: entry.operationalRef }
          : {}),
      },
      secretRef: "env:GITHUB_WEBHOOK_SECRET",
    });
    bindingsUpserted += 1;
  }

  return {
    workspaceIds: projectsResult.workspaceIds,
    projectsEnsured: projectsResult.ensured.length,
    bindingsUpserted,
    createdProjectIds: projectsResult.createdIds,
  };
}

async function ensureNamedProject(
  projects: ProjectRepository,
  name: string,
  description: string,
): Promise<Project> {
  const existing = await projects.findByName(name);
  if (existing) {
    if (existing.status === ProjectStatus.ACTIVE) {
      return existing;
    }
    return projects.update(existing.id, { status: ProjectStatus.ACTIVE });
  }
  return projects.create({
    name,
    description,
    status: ProjectStatus.ACTIVE,
    priority: Priority.HIGH,
  });
}

/** Helper de teste / audit: ids publicos esperados. */
export function officialPublicWorkspaceIds(): readonly string[] {
  return OFFICIAL_OPERATIONAL_WORKSPACES.map((entry) => entry.workspaceId);
}

export function assertOfficialSlugConsistency(): void {
  for (const entry of OFFICIAL_OPERATIONAL_WORKSPACES) {
    const fake = {
      id: "x",
      name: entry.name,
      description: null,
      status: ProjectStatus.ACTIVE,
      priority: Priority.MEDIUM,
      goalId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as const;
    const slug = publicWorkspaceId(fake);
    if (slug !== entry.workspaceId) {
      throw new Error(
        `Slug inconsistente: ${entry.name} → ${slug} (esperado ${entry.workspaceId})`,
      );
    }
  }
}
