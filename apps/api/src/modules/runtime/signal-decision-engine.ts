/**
 * Signal Decision Engine — orquestra DomainSignal github.* → decide → Mission.
 *
 * Reusa Signal Policy (domain-signals) + MissionQueue existente.
 * Nao altera WorkerManager / MissionQueue / Employees.
 */
import {
  applyGitHubEvaluationPolicy,
  GITHUB_SOURCE_TYPE,
  type DomainSignalRecord,
  type DomainSignalService,
  type WorkspaceSourceBindingRecord,
} from "@operaia/domain-signals";
import type { MissionQueue } from "./mission-queue.js";
import { enqueueSignalCoordinateMission } from "./signal-mission-converter.js";
import type { GithubRepositoryScanReport } from "./supervisor/github-repository-scanner.js";

export interface SignalDecisionResult {
  readonly signalId: string;
  readonly workspaceId: string;
  readonly type: string;
  readonly decision: string | null;
  readonly reason: string | null;
  readonly missionId: string | null;
  readonly outcome:
    | "converted"
    | "ignored"
    | "deferred"
    | "skipped"
    | "accepted";
}

export interface SignalDecisionEngineDeps {
  readonly signals: DomainSignalService;
  readonly queue: MissionQueue;
}

export class SignalDecisionEngine {
  constructor(private readonly deps: SignalDecisionEngineDeps) {}

  /**
   * Avalia um DomainSignal DETECTED github.* e, se CONVERT, enfileira COORDINATE.
   */
  async processSignal(
    signal: DomainSignalRecord,
  ): Promise<SignalDecisionResult> {
    if (signal.sourceType !== GITHUB_SOURCE_TYPE) {
      return {
        signalId: signal.id,
        workspaceId: signal.workspaceId,
        type: signal.type,
        decision: null,
        reason: "non_github_source",
        missionId: null,
        outcome: "skipped",
      };
    }

    if (signal.status !== "DETECTED") {
      return {
        signalId: signal.id,
        workspaceId: signal.workspaceId,
        type: signal.type,
        decision: signal.evaluationDecision,
        reason: signal.evaluationReason,
        missionId: signal.missionId,
        outcome: "skipped",
      };
    }

    const binding = await this.resolveBinding(signal);
    if (!binding) {
      const ignored = await this.deps.signals.evaluate({
        signalId: signal.id,
        decision: "IGNORE",
        policy: "signal-decision-engine@1",
        reason: "binding_missing",
      });
      return {
        signalId: ignored.id,
        workspaceId: ignored.workspaceId,
        type: ignored.type,
        decision: ignored.evaluationDecision,
        reason: ignored.evaluationReason,
        missionId: null,
        outcome: "ignored",
      };
    }

    const evaluated = await applyGitHubEvaluationPolicy({
      signals: this.deps.signals,
      signal,
      binding,
    });

    const decision = evaluated.evaluationDecision;
    const reason = evaluated.evaluationReason;

    if (decision === "IGNORE") {
      return {
        signalId: evaluated.id,
        workspaceId: evaluated.workspaceId,
        type: evaluated.type,
        decision,
        reason,
        missionId: null,
        outcome: "ignored",
      };
    }

    if (decision === "DEFER") {
      return {
        signalId: evaluated.id,
        workspaceId: evaluated.workspaceId,
        type: evaluated.type,
        decision,
        reason,
        missionId: null,
        outcome: "deferred",
      };
    }

    if (decision !== "CONVERT_CANDIDATE") {
      return {
        signalId: evaluated.id,
        workspaceId: evaluated.workspaceId,
        type: evaluated.type,
        decision,
        reason,
        missionId: null,
        outcome: "accepted",
      };
    }

    const missionId = await enqueueSignalCoordinateMission({
      queue: this.deps.queue,
      signal: evaluated,
    });
    const converted = await this.deps.signals.markConverted({
      signalId: evaluated.id,
      missionId,
    });

    return {
      signalId: converted.id,
      workspaceId: converted.workspaceId,
      type: converted.type,
      decision: converted.evaluationDecision,
      reason: converted.evaluationReason,
      missionId,
      outcome: "converted",
    };
  }

  /**
   * Processa sinais emitidos pelo GitHubRepositoryScanner no ciclo do Supervisor.
   */
  async processGithubScan(
    report: GithubRepositoryScanReport,
  ): Promise<readonly SignalDecisionResult[]> {
    const results: SignalDecisionResult[] = [];
    for (const item of report.items) {
      if (item.skipped || !("signalId" in item) || !item.signalId) {
        continue;
      }
      const loaded = await this.loadSignal(item.signalId);
      if (!loaded) {
        continue;
      }
      results.push(await this.processSignal(loaded));
    }
    return results;
  }

  private async loadSignal(
    signalId: string,
  ): Promise<DomainSignalRecord | null> {
    return this.deps.signals.findById(signalId);
  }

  private async resolveBinding(
    signal: DomainSignalRecord,
  ): Promise<WorkspaceSourceBindingRecord | null> {
    if (signal.bindingId) {
      return this.deps.signals.findBindingById(signal.bindingId);
    }
    const repository =
      typeof signal.payloadJson.repository === "string"
        ? signal.payloadJson.repository
        : null;
    if (!repository) {
      return null;
    }
    return this.deps.signals.findBinding({
      workspaceId: signal.workspaceId,
      sourceType: GITHUB_SOURCE_TYPE,
      externalRef: repository,
    });
  }
}
