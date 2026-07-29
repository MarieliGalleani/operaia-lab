/**
 * Observabilidade de ingestao Domain Signal (S2/S3.1).
 */

export type IngestObsResult =
  | "accepted"
  | "duplicate_delivery"
  | "rejected";

export type IngestRejectionReason =
  | "unknown_bridge"
  | "auth_failed"
  | "binding_missing"
  | "binding_disabled"
  | "hmac_failed"
  | "replay_skew"
  | "invalid_context";

export interface IngestObservation {
  readonly sourceType: string;
  readonly correlationId: string | null;
  readonly workspaceId: string | null;
  readonly deliveryId: string | null;
  readonly result: IngestObsResult;
  readonly rejectionReason?: IngestRejectionReason;
  readonly signalId?: string | null;
  readonly at: string;
  /** Campos opcionais GitHub (S3.1). */
  readonly githubEvent?: string | null;
  readonly repository?: string | null;
  readonly severity?: string | null;
  readonly mapIgnoreReason?: string | null;
  readonly ingestResult?: string | null;
}

export type IngestObserver = (event: IngestObservation) => void;

export function createConsoleIngestObserver(): IngestObserver {
  return (event) => {
    console.log(
      JSON.stringify({
        channel: "domain-signal-ingest",
        ...event,
      }),
    );
  };
}

export function emitIngestObservation(
  observer: IngestObserver | undefined,
  event: Omit<IngestObservation, "at"> & { readonly at?: string },
): void {
  if (!observer) {
    return;
  }
  observer({
    ...event,
    at: event.at ?? new Date().toISOString(),
  });
}
