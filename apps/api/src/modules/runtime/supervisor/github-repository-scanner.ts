/**
 * GitHubRepositoryScanner — visao operacional de repos GitHub nos Workspaces.
 *
 * Usa WorkspaceSourceBinding (github) existentes.
 * Persiste snapshot; emite DomainSignal so em mudanca relevante.
 * Nao cria workspace. Nao toca MissionQueue / WorkerManager.
 */
import {
  GITHUB_SOURCE_TYPE,
  type DomainSignalService,
  type WorkspaceSourceBindingRecord,
} from "@operaia/domain-signals";
import type { ClockPort } from "./ports.js";
import type { GithubRepoClient } from "./github-repo-client.js";
import type {
  GithubSnapshotStore,
  WorkspaceGithubSnapshotRecord,
} from "./github-snapshot-store.js";

export const GITHUB_REPO_SNAPSHOT_CHANGED_TYPE =
  "github.repo.snapshot.changed" as const;

export type GithubSnapshotChangeField =
  | "lastCommitSha"
  | "defaultBranch"
  | "primaryLanguage"
  | "openIssuesCount"
  | "openPullRequestsCount"
  | "updatedAt";

export interface GithubRepositoryScanItem {
  readonly workspaceId: string;
  readonly bindingId: string;
  readonly repository: string;
  readonly snapshot: WorkspaceGithubSnapshotRecord;
  readonly previous: WorkspaceGithubSnapshotRecord | null;
  readonly changed: boolean;
  readonly changeFields: readonly GithubSnapshotChangeField[];
  readonly signalId: string | null;
  readonly skipped: false;
  readonly error: string | null;
}

export interface GithubRepositoryScanSkipped {
  readonly workspaceId: string;
  readonly bindingId: string | null;
  readonly repository: string | null;
  readonly skipped: true;
  readonly reason: "inactive_workspace" | "no_binding" | "fetch_failed";
  readonly error: string | null;
}

export type GithubRepositoryScanResult =
  | GithubRepositoryScanItem
  | GithubRepositoryScanSkipped;

export interface GithubRepositoryScanReport {
  readonly scannedAt: string;
  readonly scanned: number;
  readonly updated: number;
  readonly signalsEmitted: number;
  readonly skipped: number;
  readonly errors: number;
  readonly items: readonly GithubRepositoryScanResult[];
}

export interface GitHubRepositoryScannerDeps {
  readonly signals: DomainSignalService;
  readonly client: GithubRepoClient;
  readonly snapshots: GithubSnapshotStore;
  readonly clock: ClockPort;
}

export interface GitHubRepositoryScanInput {
  /** WorkspaceIds ACTIVE do ciclo do Supervisor. */
  readonly activeWorkspaceIds: readonly string[];
}

/**
 * Diff operacional relevante entre snapshots.
 */
export function detectRelevantGithubChanges(
  previous: WorkspaceGithubSnapshotRecord | null,
  next: {
    readonly defaultBranch: string;
    readonly lastCommitSha: string | null;
    readonly primaryLanguage: string | null;
    readonly openIssuesCount: number;
    readonly openPullRequestsCount: number;
    readonly remoteUpdatedAt: Date | null;
  },
): readonly GithubSnapshotChangeField[] {
  if (!previous) {
    return [];
  }
  const fields: GithubSnapshotChangeField[] = [];
  if (previous.lastCommitSha !== next.lastCommitSha) {
    fields.push("lastCommitSha");
  }
  if (previous.defaultBranch !== next.defaultBranch) {
    fields.push("defaultBranch");
  }
  if (previous.primaryLanguage !== next.primaryLanguage) {
    fields.push("primaryLanguage");
  }
  if (previous.openIssuesCount !== next.openIssuesCount) {
    fields.push("openIssuesCount");
  }
  if (previous.openPullRequestsCount !== next.openPullRequestsCount) {
    fields.push("openPullRequestsCount");
  }
  const prevUpdated = previous.remoteUpdatedAt?.toISOString() ?? null;
  const nextUpdated = next.remoteUpdatedAt?.toISOString() ?? null;
  if (prevUpdated !== nextUpdated) {
    fields.push("updatedAt");
  }
  return fields;
}

export class GitHubRepositoryScanner {
  constructor(private readonly deps: GitHubRepositoryScannerDeps) {}

  async scan(
    input: GitHubRepositoryScanInput,
  ): Promise<GithubRepositoryScanReport> {
    const scannedAt = this.deps.clock.now();
    const active = new Set(
      input.activeWorkspaceIds.map((id) => id.trim()).filter(Boolean),
    );

    const bindings = await this.deps.signals.listBindings({
      enabledOnly: true,
    });
    const githubBindings = bindings.filter(
      (b) => b.sourceType === GITHUB_SOURCE_TYPE && b.enabled,
    );

    const items: GithubRepositoryScanResult[] = [];
    let updated = 0;
    let signalsEmitted = 0;
    let skipped = 0;
    let errors = 0;

    // Workspaces ACTIVE sem binding github: marcar como ignorados (cobertura de teste).
    for (const workspaceId of active) {
      const hasBinding = githubBindings.some(
        (b) => b.workspaceId === workspaceId,
      );
      if (!hasBinding) {
        skipped += 1;
        items.push({
          workspaceId,
          bindingId: null,
          repository: null,
          skipped: true,
          reason: "no_binding",
          error: null,
        });
      }
    }

    for (const binding of githubBindings) {
      if (!active.has(binding.workspaceId)) {
        skipped += 1;
        items.push({
          workspaceId: binding.workspaceId,
          bindingId: binding.id,
          repository: binding.externalRef,
          skipped: true,
          reason: "inactive_workspace",
          error: null,
        });
        continue;
      }

      try {
        const result = await this.scanBinding(binding, scannedAt);
        items.push(result);
        updated += 1;
        if (result.signalId) {
          signalsEmitted += 1;
        }
      } catch (err) {
        errors += 1;
        skipped += 1;
        items.push({
          workspaceId: binding.workspaceId,
          bindingId: binding.id,
          repository: binding.externalRef,
          skipped: true,
          reason: "fetch_failed",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      scannedAt: scannedAt.toISOString(),
      scanned: githubBindings.filter((b) => active.has(b.workspaceId)).length,
      updated,
      signalsEmitted,
      skipped,
      errors,
      items,
    };
  }

  private async scanBinding(
    binding: WorkspaceSourceBindingRecord,
    scannedAt: Date,
  ): Promise<GithubRepositoryScanItem> {
    const info = await this.deps.client.fetchRepository(binding.externalRef);
    const remoteUpdatedAt = parseDate(info.updatedAt);

    const previous = await this.deps.snapshots.findByWorkspaceRepository(
      binding.workspaceId,
      info.repository,
    );

    const changeFields = detectRelevantGithubChanges(previous, {
      defaultBranch: info.defaultBranch,
      lastCommitSha: info.lastCommitSha,
      primaryLanguage: info.primaryLanguage,
      openIssuesCount: info.openIssuesCount,
      openPullRequestsCount: info.openPullRequestsCount,
      remoteUpdatedAt,
    });

    const snapshot = await this.deps.snapshots.upsert({
      workspaceId: binding.workspaceId,
      bindingId: binding.id,
      repository: info.repository,
      defaultBranch: info.defaultBranch,
      lastCommitSha: info.lastCommitSha,
      primaryLanguage: info.primaryLanguage,
      openIssuesCount: info.openIssuesCount,
      openPullRequestsCount: info.openPullRequestsCount,
      remoteUpdatedAt,
      scannedAt,
    });

    let signalId: string | null = null;
    if (changeFields.length > 0) {
      const affectedFiles = await this.resolveAffectedFiles(
        info.repository,
        info.lastCommitSha,
        changeFields,
      );
      const deliveryId = buildChangeDeliveryId({
        workspaceId: binding.workspaceId,
        repository: info.repository,
        changeFields,
        snapshot,
      });
      const ingested = await this.deps.signals.ingest({
        workspaceId: binding.workspaceId,
        bindingId: binding.id,
        sourceType: GITHUB_SOURCE_TYPE,
        type: GITHUB_REPO_SNAPSHOT_CHANGED_TYPE,
        deliveryId,
        sourceId: info.lastCommitSha,
        externalRef: info.repository,
        occurredAt: remoteUpdatedAt ?? scannedAt,
        payload: {
          repository: info.repository,
          defaultBranch: info.defaultBranch,
          lastCommitSha: info.lastCommitSha,
          primaryLanguage: info.primaryLanguage,
          updatedAt: info.updatedAt,
          openIssuesCount: info.openIssuesCount,
          openPullRequestsCount: info.openPullRequestsCount,
          changeFields: [...changeFields],
          affectedFiles: [...affectedFiles],
          previous: previous
            ? {
                lastCommitSha: previous.lastCommitSha,
                defaultBranch: previous.defaultBranch,
                primaryLanguage: previous.primaryLanguage,
                openIssuesCount: previous.openIssuesCount,
                openPullRequestsCount: previous.openPullRequestsCount,
                updatedAt: previous.remoteUpdatedAt?.toISOString() ?? null,
              }
            : null,
        },
        metadata: {
          scanner: "GitHubRepositoryScanner",
          bindingId: binding.id,
        },
      });
      signalId = ingested.signal.id;
    }

    return {
      workspaceId: binding.workspaceId,
      bindingId: binding.id,
      repository: info.repository,
      snapshot,
      previous,
      changed: changeFields.length > 0,
      changeFields,
      signalId,
      skipped: false,
      error: null,
    };
  }

  private async resolveAffectedFiles(
    repository: string,
    sha: string | null,
    changeFields: readonly GithubSnapshotChangeField[],
  ): Promise<readonly string[]> {
    if (!sha || !changeFields.includes("lastCommitSha")) {
      return [];
    }
    if (typeof this.deps.client.fetchCommitFiles !== "function") {
      return [];
    }
    try {
      return await this.deps.client.fetchCommitFiles(repository, sha);
    } catch {
      return [];
    }
  }
}

function parseDate(value: string): Date | null {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    return null;
  }
  return new Date(ms);
}

function buildChangeDeliveryId(input: {
  readonly workspaceId: string;
  readonly repository: string;
  readonly changeFields: readonly GithubSnapshotChangeField[];
  readonly snapshot: WorkspaceGithubSnapshotRecord;
}): string {
  const fingerprint = [
    input.snapshot.lastCommitSha ?? "",
    input.snapshot.defaultBranch,
    input.snapshot.primaryLanguage ?? "",
    String(input.snapshot.openIssuesCount),
    String(input.snapshot.openPullRequestsCount),
    input.snapshot.remoteUpdatedAt?.toISOString() ?? "",
    input.changeFields.join(","),
  ].join("|");
  return `github-scan:${input.workspaceId}:${input.repository}:${fingerprint}`;
}
