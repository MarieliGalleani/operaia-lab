import { describe, expect, it } from "vitest";
import {
  decideGithubRepoSnapshotChanged,
  decideGitHubEvaluation,
  DomainSignalService,
  GITHUB_SOURCE_TYPE,
  InMemoryDomainSignalStore,
  isTechnicalPath,
} from "@operaia/domain-signals";
import type { DomainSignalRecord } from "@operaia/domain-signals";
import { SignalDecisionEngine } from "./signal-decision-engine.js";
import type { MissionQueue } from "./mission-queue.js";
import { CEO_EMPLOYEE_ID } from "./mission-states.js";
import { buildSignalCoordinateObjective } from "./signal-mission-converter.js";

type Enqueued = {
  readonly workspaceId: string;
  readonly objective: string;
  readonly ownerEmployeeId?: string;
};

function createFakeQueue(): MissionQueue & { enqueued: Enqueued[] } {
  const enqueued: Enqueued[] = [];
  return {
    enqueued,
    async enqueue(input: {
      readonly workspaceId: string;
      readonly objective: string;
      readonly ownerEmployeeId?: string;
    }) {
      enqueued.push({
        workspaceId: input.workspaceId,
        objective: input.objective,
        ownerEmployeeId: input.ownerEmployeeId,
      });
      return {
        mission: {
          id: `mission-${enqueued.length}`,
          workspaceId: input.workspaceId,
        },
        created: true,
      };
    },
  } as unknown as MissionQueue & { enqueued: Enqueued[] };
}

async function ingestSnapshot(
  signals: DomainSignalService,
  input: {
    readonly workspaceId: string;
    readonly repository: string;
    readonly bindingId: string;
    readonly affectedFiles?: readonly string[];
    readonly changeFields?: readonly string[];
    readonly openPullRequestsCount?: number;
    readonly previousOpenPullRequestsCount?: number;
    readonly hasCriticalIssue?: boolean;
    readonly issueLabels?: readonly string[];
    readonly deliveryId: string;
  },
) {
  return signals.ingest({
    workspaceId: input.workspaceId,
    bindingId: input.bindingId,
    sourceType: GITHUB_SOURCE_TYPE,
    type: "github.repo.snapshot.changed",
    deliveryId: input.deliveryId,
    sourceId: "sha-test",
    externalRef: input.repository,
    payload: {
      repository: input.repository,
      defaultBranch: "main",
      lastCommitSha: "sha-test",
      primaryLanguage: "TypeScript",
      updatedAt: "2026-07-30T12:00:00.000Z",
      openIssuesCount: 0,
      openPullRequestsCount: input.openPullRequestsCount ?? 0,
      changeFields: input.changeFields ?? ["lastCommitSha"],
      affectedFiles: input.affectedFiles ?? [],
      hasCriticalIssue: input.hasCriticalIssue,
      issueLabels: input.issueLabels,
      previous: {
        lastCommitSha: "sha-old",
        openPullRequestsCount: input.previousOpenPullRequestsCount ?? 0,
        openIssuesCount: 0,
        updatedAt: null,
      },
    },
  });
}

describe("decideGithubRepoSnapshotChanged", () => {
  it("README only → IGNORE", () => {
    const decided = decideGithubRepoSnapshotChanged({
      changeFields: ["lastCommitSha"],
      affectedFiles: ["README.md"],
    });
    expect(decided.decision).toBe("IGNORE");
    expect(decided.reason).toBe("readme_only");
  });

  it("src/ → CONVERT", () => {
    expect(isTechnicalPath("src/modules/foo.ts")).toBe(true);
    const decided = decideGithubRepoSnapshotChanged({
      changeFields: ["lastCommitSha"],
      affectedFiles: ["src/modules/foo.ts"],
    });
    expect(decided.decision).toBe("CONVERT_CANDIDATE");
    expect(decided.reason).toBe("technical_file_change");
  });

  it("package.json / migrations → CONVERT", () => {
    expect(
      decideGithubRepoSnapshotChanged({
        affectedFiles: ["package.json"],
        changeFields: ["lastCommitSha"],
      }).decision,
    ).toBe("CONVERT_CANDIDATE");
    expect(
      decideGithubRepoSnapshotChanged({
        affectedFiles: ["packages/database/prisma/migrations/001_init/migration.sql"],
        changeFields: ["lastCommitSha"],
      }).decision,
    ).toBe("CONVERT_CANDIDATE");
  });

  it("PR aberto → CONVERT", () => {
    const decided = decideGithubRepoSnapshotChanged({
      changeFields: ["openPullRequestsCount"],
      openPullRequestsCount: 2,
      previous: { openPullRequestsCount: 0 },
    });
    expect(decided.decision).toBe("CONVERT_CANDIDATE");
    expect(decided.reason).toBe("pr_open_delta");
  });

  it("issue critica → CONVERT", () => {
    const decided = decideGithubRepoSnapshotChanged({
      changeFields: ["openIssuesCount"],
      hasCriticalIssue: true,
      issueLabels: ["critical"],
    });
    expect(decided.decision).toBe("CONVERT_CANDIDATE");
    expect(decided.reason).toBe("critical_issue");
  });
});

describe("SignalDecisionEngine", () => {
  it("README nao gera missao", async () => {
    const store = new InMemoryDomainSignalStore();
    const signals = new DomainSignalService(store);
    const queue = createFakeQueue();
    const binding = await signals.upsertBinding({
      workspaceId: "nexo",
      sourceType: GITHUB_SOURCE_TYPE,
      externalRef: "acme/nexo",
      enabled: true,
    });

    const ingested = await ingestSnapshot(signals, {
      workspaceId: "nexo",
      repository: "acme/nexo",
      bindingId: binding.id,
      affectedFiles: ["README.md", "docs/guide.md"],
      deliveryId: "d-readme",
    });

    const engine = new SignalDecisionEngine({ signals, queue });
    const result = await engine.processSignal(ingested.signal);

    expect(result.outcome).toBe("ignored");
    expect(result.reason).toMatch(/readme_only|no_technical_impact/);
    expect(result.missionId).toBeNull();
    expect(queue.enqueued).toHaveLength(0);
  });

  it("codigo gera missao COORDINATE com operaia-ceo", async () => {
    const store = new InMemoryDomainSignalStore();
    const signals = new DomainSignalService(store);
    const queue = createFakeQueue();
    const binding = await signals.upsertBinding({
      workspaceId: "nexo",
      sourceType: GITHUB_SOURCE_TYPE,
      externalRef: "acme/nexo",
      enabled: true,
    });

    const ingested = await ingestSnapshot(signals, {
      workspaceId: "nexo",
      repository: "acme/nexo",
      bindingId: binding.id,
      affectedFiles: ["src/runtime/foo.ts", "package.json"],
      deliveryId: "d-code",
    });

    const engine = new SignalDecisionEngine({ signals, queue });
    const result = await engine.processSignal(ingested.signal);

    expect(result.outcome).toBe("converted");
    expect(result.missionId).toBeTruthy();
    expect(queue.enqueued).toHaveLength(1);
    expect(queue.enqueued[0]?.workspaceId).toBe("nexo");
    expect(queue.enqueued[0]?.ownerEmployeeId ?? CEO_EMPLOYEE_ID).toBe(
      CEO_EMPLOYEE_ID,
    );

    const objective = queue.enqueued[0]?.objective ?? "";
    expect(objective).toContain("workspace=nexo");
    expect(objective).toContain("repository=acme/nexo");
    expect(objective).toContain("src/runtime/foo.ts");
    expect(objective).toContain("motivo=technical_file_change");

    const converted = await signals.findById(ingested.signal.id);
    expect(converted?.status).toBe("CONVERTED");
    expect(converted?.missionId).toBe(result.missionId);
  });

  it("multiplos workspaces isolados — FlowGrid nao cria missao no NEXO", async () => {
    const store = new InMemoryDomainSignalStore();
    const signals = new DomainSignalService(store);
    const queue = createFakeQueue();

    const nexoBinding = await signals.upsertBinding({
      workspaceId: "nexo",
      sourceType: GITHUB_SOURCE_TYPE,
      externalRef: "marieligalleani/operaia-core-nexo",
      enabled: true,
    });
    const flowBinding = await signals.upsertBinding({
      workspaceId: "flowgrid",
      sourceType: GITHUB_SOURCE_TYPE,
      externalRef: "marieligalleani/flowgrid",
      enabled: true,
    });

    const nexoSignal = await ingestSnapshot(signals, {
      workspaceId: "nexo",
      repository: "marieligalleani/operaia-core-nexo",
      bindingId: nexoBinding.id,
      affectedFiles: ["README.md"],
      deliveryId: "d-nexo-readme",
    });
    const flowSignal = await ingestSnapshot(signals, {
      workspaceId: "flowgrid",
      repository: "marieligalleani/flowgrid",
      bindingId: flowBinding.id,
      affectedFiles: ["src/app.py"],
      deliveryId: "d-flow-code",
    });

    const engine = new SignalDecisionEngine({ signals, queue });
    const nexoResult = await engine.processSignal(nexoSignal.signal);
    const flowResult = await engine.processSignal(flowSignal.signal);

    expect(nexoResult.outcome).toBe("ignored");
    expect(flowResult.outcome).toBe("converted");
    expect(flowResult.workspaceId).toBe("flowgrid");

    expect(queue.enqueued).toHaveLength(1);
    expect(queue.enqueued[0]?.workspaceId).toBe("flowgrid");
    expect(queue.enqueued.some((row) => row.workspaceId === "nexo")).toBe(
      false,
    );
  });

  it("policy github.repo.snapshot.changed integrada em decideGitHubEvaluation", () => {
    const now = new Date();
    const signal = {
      id: "s1",
      workspaceId: "nexo",
      bindingId: "b1",
      sourceType: "github",
      sourceId: "sha",
      type: "github.repo.snapshot.changed",
      deliveryId: "d1",
      signalHash: "h",
      correlationId: "c",
      status: "DETECTED",
      payloadJson: {
        affectedFiles: ["src/x.ts"],
        changeFields: ["lastCommitSha"],
      },
      metadataJson: null,
      evaluationDecision: null,
      evaluationPolicy: null,
      evaluationReason: null,
      evaluationJson: null,
      evaluatedAt: null,
      missionId: null,
      payloadVersion: 1,
      occurredAt: now,
      receivedAt: now,
      convertedAt: null,
      resolvedAt: null,
      expiresAt: null,
      createdAt: now,
      updatedAt: now,
    } satisfies DomainSignalRecord;

    const decided = decideGitHubEvaluation({
      signal,
      binding: {
        id: "b1",
        workspaceId: "nexo",
        sourceType: "github",
        externalRef: "acme/nexo",
        enabled: true,
        configJson: null,
        secretRef: null,
        createdAt: now,
        updatedAt: now,
      },
      similarCount: 0,
    });
    expect(decided.decision).toBe("CONVERT_CANDIDATE");
  });
});

describe("buildSignalCoordinateObjective (contexto Opera)", () => {
  it("inclui workspace, repository, mudanca, arquivos e motivo", () => {
    const now = new Date();
    const signal = {
      id: "s1",
      workspaceId: "flowgrid",
      bindingId: null,
      sourceType: "github",
      sourceId: "sha-9",
      type: "github.repo.snapshot.changed",
      deliveryId: "del-9",
      signalHash: "h",
      correlationId: "corr-9",
      status: "EVALUATED",
      payloadJson: {
        repository: "marieligalleani/flowgrid",
        changeFields: ["lastCommitSha"],
        affectedFiles: ["src/main.py", "package.json"],
      },
      metadataJson: null,
      evaluationDecision: "CONVERT_CANDIDATE",
      evaluationPolicy: "github-default@2",
      evaluationReason: "technical_file_change",
      evaluationJson: null,
      evaluatedAt: now,
      missionId: null,
      payloadVersion: 1,
      occurredAt: now,
      receivedAt: now,
      convertedAt: null,
      resolvedAt: null,
      expiresAt: null,
      createdAt: now,
      updatedAt: now,
    } satisfies DomainSignalRecord;

    const objective = buildSignalCoordinateObjective(signal);
    expect(objective).toContain("workspace=flowgrid");
    expect(objective).toContain("repository=marieligalleani/flowgrid");
    expect(objective).toContain("mudanca=lastCommitSha");
    expect(objective).toContain("src/main.py");
    expect(objective).toContain("motivo=technical_file_change");
  });
});
