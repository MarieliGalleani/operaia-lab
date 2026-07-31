/**
 * Pipeline operacional GitHub webhook (S3.2+):
 * HMAC → Bridge → Ingest → Decision Policy → (opcional) convert callback.
 *
 * NAO importa MissionQueue (invariante architecture.test do modulo signals).
 * Conversao para missao fica no composition root via onConvertCandidate.
 */
import {
  applyGitHubEvaluationPolicy,
  DomainSignalIngestError,
  GITHUB_SOURCE_TYPE,
  type DomainSignalIngestService,
  type DomainSignalRecord,
  type DomainSignalService,
  type GitHubBindingConfig,
  type GitHubSourceBridge,
  type WorkspaceSourceBindingRecord,
} from "@operaia/domain-signals";
import { extractGithubExternalRef } from "./github-external-ref.js";
import { resolveWebhookSecret } from "./secret-resolver.js";

export interface GithubWebhookHeaders {
  readonly signature256: string;
  readonly deliveryId: string;
  readonly githubEvent: string;
}

export interface GithubWebhookPipelineDeps {
  readonly signals: DomainSignalService;
  readonly bridge: GitHubSourceBridge;
  readonly ingest: DomainSignalIngestService;
  readonly resolveSecret?: (
    secretRef: string | null,
  ) => string | null;
  /**
   * Chamado apenas para CONVERT_CANDIDATE apos evaluate.
   * Deve enfileirar COORDINATE e retornar missionId (ou null se adiados).
   */
  readonly onConvertCandidate?: (input: {
    readonly signal: DomainSignalRecord;
    readonly binding: WorkspaceSourceBindingRecord;
  }) => Promise<string | null>;
}

export type GithubWebhookPipelineResult =
  | {
      readonly httpStatus: 202;
      readonly outcome: "accepted" | "converted" | "duplicate";
      readonly signalId: string;
      readonly workspaceId: string;
      readonly externalRef?: string;
      readonly decision: string | null;
      readonly missionId: string | null;
      readonly correlationId: string;
    }
  | {
      readonly httpStatus: 200;
      readonly outcome: "ignored" | "deferred";
      readonly reason: string;
      readonly signalId?: string;
      readonly decision?: string;
    }
  | {
      readonly httpStatus: 401 | 404 | 409 | 400;
      readonly outcome: "rejected";
      readonly reason: string;
      readonly message?: string;
    };

export async function processGithubWebhook(
  deps: GithubWebhookPipelineDeps,
  input: {
    readonly rawBody: string;
    readonly body: unknown;
    readonly headers: GithubWebhookHeaders;
    readonly bindingId?: string;
  },
): Promise<GithubWebhookPipelineResult> {
  const signature = input.headers.signature256?.trim() ?? "";
  const deliveryId = input.headers.deliveryId?.trim() ?? "";
  const githubEvent = input.headers.githubEvent?.trim() ?? "";

  if (!deliveryId) {
    return {
      httpStatus: 400,
      outcome: "rejected",
      reason: "invalid_context",
      message: "X-GitHub-Delivery ausente",
    };
  }
  if (!githubEvent) {
    return {
      httpStatus: 400,
      outcome: "rejected",
      reason: "invalid_context",
      message: "X-GitHub-Event ausente",
    };
  }
  if (!signature) {
    return {
      httpStatus: 401,
      outcome: "rejected",
      reason: "hmac_failed",
      message: "X-Hub-Signature-256 ausente",
    };
  }

  const binding = await resolveBinding(deps, input);
  if ("error" in binding) {
    return binding.error;
  }

  const resolveSecret = deps.resolveSecret ?? ((ref) => resolveWebhookSecret(ref));
  const webhookSecret = resolveSecret(binding.record.secretRef);
  if (!webhookSecret) {
    return {
      httpStatus: 401,
      outcome: "rejected",
      reason: "hmac_failed",
      message: "webhook secret nao resolvido",
    };
  }

  const accepted = deps.bridge.acceptWebhook({
    rawBody: input.rawBody,
    signature256: signature,
    deliveryId,
    githubEvent,
    webhookSecret,
    workspaceId: binding.record.workspaceId,
    config: (binding.record.configJson ?? undefined) as
      | GitHubBindingConfig
      | undefined,
  });

  if (accepted.kind === "rejected") {
    const httpStatus =
      accepted.reason === "hmac_failed" || accepted.reason === "replay_skew"
        ? 401
        : 400;
    return {
      httpStatus,
      outcome: "rejected",
      reason: accepted.reason,
      message: accepted.message,
    };
  }

  if (accepted.kind === "ignored") {
    return {
      httpStatus: 200,
      outcome: "ignored",
      reason: accepted.reason,
    };
  }

  // Isolamento M1: workspace vem exclusivamente do binding do repo — sem fallback NEXO.
  const routedWorkspaceId = binding.record.workspaceId;
  const routedExternalRef = accepted.event.externalRef;
  if (!routedWorkspaceId?.trim()) {
    return {
      httpStatus: 404,
      outcome: "rejected",
      reason: "binding_missing",
      message: "binding sem workspaceId",
    };
  }

  const event = {
    ...accepted.event,
    metadata: {
      ...(accepted.event.metadata ?? {}),
      externalRef: routedExternalRef,
      repository: routedExternalRef,
      workspaceId: routedWorkspaceId,
    },
  };

  let ingestResult;
  try {
    ingestResult = await deps.ingest.ingest(event);
  } catch (error) {
    if (error instanceof DomainSignalIngestError) {
      const httpStatus =
        error.rejectionReason === "binding_missing" ||
        error.rejectionReason === "binding_disabled"
          ? 404
          : 400;
      return {
        httpStatus,
        outcome: "rejected",
        reason: error.rejectionReason,
        message: error.message,
      };
    }
    throw error;
  }

  const signal = ingestResult.signal;
  if (signal.workspaceId !== routedWorkspaceId) {
    return {
      httpStatus: 400,
      outcome: "rejected",
      reason: "invalid_context",
      message: `workspace do sinal (${signal.workspaceId}) diverge do binding (${routedWorkspaceId})`,
    };
  }

  if (ingestResult.ingestResult === "duplicate_delivery") {
    return {
      httpStatus: 202,
      outcome: "duplicate",
      signalId: signal.id,
      workspaceId: signal.workspaceId,
      externalRef: routedExternalRef,
      decision: signal.evaluationDecision,
      missionId: signal.missionId,
      correlationId: signal.correlationId,
    };
  }

  const evaluated = await applyGitHubEvaluationPolicy({
    signals: deps.signals,
    signal,
    binding: binding.record,
  });

  if (evaluated.evaluationDecision === "IGNORE") {
    return {
      httpStatus: 200,
      outcome: "ignored",
      reason: evaluated.evaluationReason ?? "ignored",
      signalId: evaluated.id,
      decision: evaluated.evaluationDecision,
    };
  }

  if (evaluated.evaluationDecision === "DEFER") {
    return {
      httpStatus: 200,
      outcome: "deferred",
      reason: evaluated.evaluationReason ?? "deferred",
      signalId: evaluated.id,
      decision: evaluated.evaluationDecision,
    };
  }

  if (evaluated.evaluationDecision !== "CONVERT_CANDIDATE") {
    return {
      httpStatus: 200,
      outcome: "ignored",
      reason: evaluated.evaluationReason ?? "no_convert",
      signalId: evaluated.id,
      decision: evaluated.evaluationDecision ?? undefined,
    };
  }

  let missionId: string | null = null;
  let converted = evaluated;
  if (deps.onConvertCandidate) {
    missionId = await deps.onConvertCandidate({
      signal: evaluated,
      binding: binding.record,
    });
    if (missionId) {
      converted = await deps.signals.markConverted({
        signalId: evaluated.id,
        missionId,
      });
    }
  }

  return {
    httpStatus: 202,
    outcome: missionId ? "converted" : "accepted",
    signalId: converted.id,
    workspaceId: converted.workspaceId,
    externalRef: routedExternalRef,
    decision: converted.evaluationDecision,
    missionId: converted.missionId,
    correlationId: converted.correlationId,
  };
}

async function resolveBinding(
  deps: GithubWebhookPipelineDeps,
  input: {
    readonly body: unknown;
    readonly bindingId?: string;
  },
): Promise<
  | { readonly record: WorkspaceSourceBindingRecord }
  | { readonly error: Extract<GithubWebhookPipelineResult, { outcome: "rejected" }> }
> {
  if (input.bindingId?.trim()) {
    const byId = await deps.signals.findBindingById(input.bindingId.trim());
    if (!byId || byId.sourceType !== GITHUB_SOURCE_TYPE) {
      return {
        error: {
          httpStatus: 404,
          outcome: "rejected",
          reason: "binding_missing",
        },
      };
    }
    if (!byId.enabled) {
      return {
        error: {
          httpStatus: 404,
          outcome: "rejected",
          reason: "binding_disabled",
        },
      };
    }
    return { record: byId };
  }

  const externalRef = extractGithubExternalRef(input.body);
  if (!externalRef) {
    return {
      error: {
        httpStatus: 400,
        outcome: "rejected",
        reason: "invalid_context",
        message: "repository ausente no payload",
      },
    };
  }

  const bindings = await deps.signals.findBindingsByExternalRef({
    sourceType: GITHUB_SOURCE_TYPE,
    externalRef,
    enabledOnly: true,
  });

  if (bindings.length === 0) {
    return {
      error: {
        httpStatus: 404,
        outcome: "rejected",
        reason: "binding_missing",
      },
    };
  }
  if (bindings.length > 1) {
    return {
      error: {
        httpStatus: 409,
        outcome: "rejected",
        reason: "binding_ambiguous",
        message: `Multiplos bindings para ${externalRef}; use /webhooks/github/:bindingId`,
      },
    };
  }
  return { record: bindings[0]! };
}
