import { describe, expect, it } from "vitest";
import {
  DomainSignalService,
  GITHUB_SOURCE_TYPE,
  InMemoryDomainSignalStore,
} from "@operaia/domain-signals";
import type { GithubRepoClient, GithubRepositoryInfo } from "./github-repo-client.js";
import { parseLastPage } from "./github-repo-client.js";
import {
  GITHUB_REPO_SNAPSHOT_CHANGED_TYPE,
  GitHubRepositoryScanner,
  detectRelevantGithubChanges,
} from "./github-repository-scanner.js";
import { InMemoryGithubSnapshotStore } from "./infrastructure/in-memory-github-snapshot-store.js";
import type { ClockPort } from "./ports.js";
import type { WorkspaceGithubSnapshotRecord } from "./github-snapshot-store.js";

const fixedNow = new Date("2026-07-30T15:00:00.000Z");
const clock: ClockPort = { now: () => fixedNow };

function info(
  partial: Partial<GithubRepositoryInfo> & Pick<GithubRepositoryInfo, "repository">,
): GithubRepositoryInfo {
  return {
    defaultBranch: "main",
    lastCommitSha: "sha-aaa",
    primaryLanguage: "TypeScript",
    updatedAt: "2026-07-30T12:00:00.000Z",
    openIssuesCount: 1,
    openPullRequestsCount: 0,
    ...partial,
  };
}

function createMockClient(
  byRepo: Record<string, GithubRepositoryInfo>,
): GithubRepoClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async fetchRepository(repository: string) {
      const key = repository.trim().toLowerCase();
      calls.push(key);
      const row = byRepo[key];
      if (!row) {
        throw new Error(`repo nao mockado: ${key}`);
      }
      return row;
    },
  };
}

async function seedBinding(
  signals: DomainSignalService,
  workspaceId: string,
  repository: string,
) {
  return signals.upsertBinding({
    workspaceId,
    sourceType: GITHUB_SOURCE_TYPE,
    externalRef: repository.toLowerCase(),
    enabled: true,
  });
}

describe("detectRelevantGithubChanges", () => {
  it("primeiro snapshot nao gera mudanca", () => {
    expect(
      detectRelevantGithubChanges(null, {
        defaultBranch: "main",
        lastCommitSha: "a",
        primaryLanguage: "TS",
        openIssuesCount: 0,
        openPullRequestsCount: 0,
        remoteUpdatedAt: fixedNow,
      }),
    ).toEqual([]);
  });

  it("detecta mudanca de commit e PRs", () => {
    const previous = {
      id: "1",
      workspaceId: "nexo",
      bindingId: "b",
      repository: "owner/nexo",
      defaultBranch: "main",
      lastCommitSha: "old",
      primaryLanguage: "TypeScript",
      openIssuesCount: 1,
      openPullRequestsCount: 0,
      remoteUpdatedAt: fixedNow,
      scannedAt: fixedNow,
      createdAt: fixedNow,
      updatedAt: fixedNow,
    } satisfies WorkspaceGithubSnapshotRecord;

    expect(
      detectRelevantGithubChanges(previous, {
        defaultBranch: "main",
        lastCommitSha: "new",
        primaryLanguage: "TypeScript",
        openIssuesCount: 1,
        openPullRequestsCount: 2,
        remoteUpdatedAt: fixedNow,
      }),
    ).toEqual(["lastCommitSha", "openPullRequestsCount"]);
  });
});

describe("parseLastPage", () => {
  it("le rel=last do Link header", () => {
    const link =
      '<https://api.github.com/repos/o/r/pulls?page=2>; rel="next", ' +
      '<https://api.github.com/repos/o/r/pulls?page=7>; rel="last"';
    expect(parseLastPage(link)).toBe(7);
  });
});

describe("GitHubRepositoryScanner", () => {
  it("isola multiplos repositorios por workspace", async () => {
    const store = new InMemoryDomainSignalStore();
    const signals = new DomainSignalService(store);
    const snapshots = new InMemoryGithubSnapshotStore();

    await seedBinding(signals, "nexo", "MarieliGalleani/operaia-core-nexo");
    await seedBinding(signals, "infra", "MarieliGalleani/operaia-infra");
    await seedBinding(signals, "flowgrid", "MarieliGalleani/flowgrid");

    const client = createMockClient({
      "marieligalleani/operaia-core-nexo": info({
        repository: "marieligalleani/operaia-core-nexo",
        lastCommitSha: "nexo-1",
      }),
      "marieligalleani/operaia-infra": info({
        repository: "marieligalleani/operaia-infra",
        lastCommitSha: "infra-1",
        primaryLanguage: "HCL",
      }),
      "marieligalleani/flowgrid": info({
        repository: "marieligalleani/flowgrid",
        lastCommitSha: "flow-1",
        primaryLanguage: "Python",
      }),
    });

    const scanner = new GitHubRepositoryScanner({
      signals,
      client,
      snapshots,
      clock,
    });

    const report = await scanner.scan({
      activeWorkspaceIds: ["nexo", "infra", "flowgrid"],
    });

    expect(report.updated).toBe(3);
    expect(report.signalsEmitted).toBe(0);

    const nexo = await snapshots.findByWorkspaceRepository(
      "nexo",
      "marieligalleani/operaia-core-nexo",
    );
    const infra = await snapshots.findByWorkspaceRepository(
      "infra",
      "marieligalleani/operaia-infra",
    );
    const flow = await snapshots.findByWorkspaceRepository(
      "flowgrid",
      "marieligalleani/flowgrid",
    );

    expect(nexo?.lastCommitSha).toBe("nexo-1");
    expect(infra?.lastCommitSha).toBe("infra-1");
    expect(flow?.lastCommitSha).toBe("flow-1");
    expect(infra?.workspaceId).toBe("infra");
    expect(nexo?.workspaceId).toBe("nexo");
    expect(client.calls).toEqual([
      "marieligalleani/operaia-core-nexo",
      "marieligalleani/operaia-infra",
      "marieligalleani/flowgrid",
    ]);
  });

  it("mudanca relevante gera DomainSignal correto", async () => {
    const store = new InMemoryDomainSignalStore();
    const signals = new DomainSignalService(store);
    const snapshots = new InMemoryGithubSnapshotStore();
    const binding = await seedBinding(
      signals,
      "nexo",
      "MarieliGalleani/operaia-core-nexo",
    );

    const repoKey = "marieligalleani/operaia-core-nexo";
    const client = createMockClient({
      [repoKey]: info({
        repository: repoKey,
        lastCommitSha: "sha-1",
        openPullRequestsCount: 0,
      }),
    });

    const scanner = new GitHubRepositoryScanner({
      signals,
      client,
      snapshots,
      clock,
    });

    const first = await scanner.scan({ activeWorkspaceIds: ["nexo"] });
    expect(first.signalsEmitted).toBe(0);

    client.calls.length = 0;
    const client2 = createMockClient({
      [repoKey]: info({
        repository: repoKey,
        lastCommitSha: "sha-2",
        openPullRequestsCount: 3,
        updatedAt: "2026-07-30T14:00:00.000Z",
      }),
    });

    const scanner2 = new GitHubRepositoryScanner({
      signals,
      client: client2,
      snapshots,
      clock,
    });

    const second = await scanner2.scan({ activeWorkspaceIds: ["nexo"] });
    expect(second.signalsEmitted).toBe(1);

    const changed = second.items.find(
      (item) => !item.skipped && item.workspaceId === "nexo",
    );
    expect(changed && !changed.skipped && changed.changed).toBe(true);
    expect(changed && !changed.skipped && changed.changeFields).toEqual(
      expect.arrayContaining([
        "lastCommitSha",
        "openPullRequestsCount",
        "updatedAt",
      ]),
    );
    expect(changed && !changed.skipped && changed.signalId).toBeTruthy();
    const signalId =
      changed && !changed.skipped ? changed.signalId : null;
    expect(signalId).toBeTruthy();

    const signal = await store.findById(signalId!);
    expect(signal?.type).toBe(GITHUB_REPO_SNAPSHOT_CHANGED_TYPE);
    expect(signal?.sourceType).toBe(GITHUB_SOURCE_TYPE);
    expect(signal?.bindingId).toBe(binding.id);
    expect(signal?.workspaceId).toBe("nexo");
    expect(signal?.payloadJson).toMatchObject({
      repository: repoKey,
      lastCommitSha: "sha-2",
      openPullRequestsCount: 3,
    });
  });

  it("workspace ACTIVE sem binding github e ignorado", async () => {
    const store = new InMemoryDomainSignalStore();
    const signals = new DomainSignalService(store);
    const snapshots = new InMemoryGithubSnapshotStore();
    await seedBinding(signals, "nexo", "MarieliGalleani/operaia-core-nexo");

    const client = createMockClient({
      "marieligalleani/operaia-core-nexo": info({
        repository: "marieligalleani/operaia-core-nexo",
      }),
    });

    const scanner = new GitHubRepositoryScanner({
      signals,
      client,
      snapshots,
      clock,
    });

    const report = await scanner.scan({
      activeWorkspaceIds: ["nexo", "orphan-ws"],
    });

    const orphan = report.items.find(
      (item) => item.workspaceId === "orphan-ws",
    );
    expect(orphan).toMatchObject({
      skipped: true,
      reason: "no_binding",
    });
    expect(client.calls).toEqual(["marieligalleani/operaia-core-nexo"]);
    expect(
      await snapshots.findByWorkspaceRepository("orphan-ws", "any"),
    ).toBeNull();
  });

  it("binding de workspace inativo nao e escaneado", async () => {
    const store = new InMemoryDomainSignalStore();
    const signals = new DomainSignalService(store);
    const snapshots = new InMemoryGithubSnapshotStore();
    await seedBinding(signals, "nexo", "MarieliGalleani/operaia-core-nexo");
    await seedBinding(signals, "paused", "MarieliGalleani/paused-repo");

    const client = createMockClient({
      "marieligalleani/operaia-core-nexo": info({
        repository: "marieligalleani/operaia-core-nexo",
      }),
      "marieligalleani/paused-repo": info({
        repository: "marieligalleani/paused-repo",
      }),
    });

    const scanner = new GitHubRepositoryScanner({
      signals,
      client,
      snapshots,
      clock,
    });

    const report = await scanner.scan({ activeWorkspaceIds: ["nexo"] });
    expect(client.calls).toEqual(["marieligalleani/operaia-core-nexo"]);
    const paused = report.items.find((item) => item.workspaceId === "paused");
    expect(paused).toMatchObject({
      skipped: true,
      reason: "inactive_workspace",
    });
  });
});
