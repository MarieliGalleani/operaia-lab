export type {
  DomainSignalStatus,
  DomainSignalEvaluationDecision,
  WorkspaceSourceBindingRecord,
  DomainSignalRecord,
  EvaluationAudit,
  OperaEvaluationContext,
  IngestSignalInput,
  IngestResultKind,
  IngestSignalResult,
  EvaluateSignalInput,
  UpsertBindingInput,
} from "./types.js";

export {
  DOMAIN_SIGNAL_STATUSES,
  DOMAIN_SIGNAL_EVALUATION_DECISIONS,
  OPEN_SIGNAL_STATUSES,
} from "./types.js";

export {
  canTransition,
  assertTransition,
  isTerminalStatus,
} from "./lifecycle.js";

export { computeSignalHash, type SignalHashParts } from "./signal-hash.js";

export {
  verifyHmacSha256,
  signHmacSha256,
  type HmacValidationInput,
  type HmacValidationResult,
} from "./hmac.js";

export {
  redactPayload,
  DEFAULT_DENY_KEYS,
  REDACTED,
} from "./redact.js";

export {
  assertTimestampWithinSkew,
  DEFAULT_REPLAY_SKEW_MS,
  type ReplayCheckResult,
} from "./replay.js";

export type {
  DomainSignalStore,
  CreateDomainSignalData,
  UpdateDomainSignalData,
} from "./domain-signal-store.js";

export {
  InMemoryDomainSignalStore,
  DuplicateDeliveryError,
} from "./in-memory-domain-signal-store.js";

export {
  toOperaEvaluationContext,
  toEvaluationAudit,
  buildEvaluationJson,
} from "./opera-evaluation-context.js";

export { DomainSignalService } from "./domain-signal-service.js";

export type {
  NormalizedIngressEvent,
  InternalAuthContext,
  GitHubAuthContext,
  IngressAuthContext,
  IngressHmacContext,
} from "./normalized-ingress.js";

export { workspaceIdFromAuth } from "./normalized-ingress.js";

export type {
  SourceBridge,
  BridgeCapabilities,
  BridgeValidationResult,
  PreparedIngress,
} from "./source-bridge.js";

export {
  BridgeRegistry,
  createDefaultBridgeRegistry,
  createPlatformBridgeRegistry,
} from "./bridge-registry.js";

export {
  InternalSourceBridge,
  INTERNAL_SOURCE_TYPE,
  buildInternalIngressEvent,
} from "./internal-source-bridge.js";

export {
  GITHUB_SOURCE_TYPE,
  mapGitHubWebhookEvent,
  type GitHubBindingConfig,
  type GitHubMappedSignal,
  type GitHubMapResult,
} from "./github-event-mapper.js";

export {
  GitHubSourceBridge,
  signGitHubWebhookBody,
  type GitHubWebhookIngressInput,
  type GitHubAcceptResult,
  type GitHubSourceBridgeOptions,
} from "./github-source-bridge.js";

export {
  GITHUB_EVALUATION_POLICY,
  applyGitHubEvaluationPolicy,
  decideGitHubEvaluation,
  type GitHubPolicyDecision,
  type ApplyGitHubEvaluationPolicyInput,
  type GitHubEvaluationConfig,
} from "./github-evaluation-policy.js";

export {
  decideGithubRepoSnapshotChanged,
  isTechnicalPath,
  isReadmeOrDocsPath,
  isCriticalIssueLabel,
  type GithubSnapshotDecisionPayload,
} from "./github-snapshot-decision.js";

export {
  SIGNAL_SEVERITIES,
  severityForGitHubSignalType,
  type SignalSeverity,
} from "./signal-severity.js";

export type {
  IngestObsResult,
  IngestRejectionReason,
  IngestObservation,
  IngestObserver,
} from "./ingest-observability.js";

export {
  createConsoleIngestObserver,
  emitIngestObservation,
} from "./ingest-observability.js";

export {
  DomainSignalIngestService,
  DomainSignalIngestError,
  type DomainSignalIngestSuccess,
  type DomainSignalIngestServiceOptions,
} from "./domain-signal-ingest-service.js";
