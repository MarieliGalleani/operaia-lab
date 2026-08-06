/**
 * Logs estruturados de observabilidade operacional (A.5.3).
 */

export type OperationalLogSeverity = "info" | "warn" | "error";

export interface OperationalLogEvent {
  readonly event:
    | "operational_alert"
    | "operation_criticality"
    | "health_snapshot"
    | "maintenance_execution";
  readonly severity: OperationalLogSeverity;
  readonly component: string;
  readonly workspaceId?: string;
  readonly correlationId?: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly timestamp?: string;
}

export function logOperationalEvent(input: OperationalLogEvent): void {
  console.log(
    JSON.stringify({
      level: input.severity === "error" ? "error" : input.severity,
      event: input.event,
      component: input.component,
      workspaceId: input.workspaceId ?? null,
      correlationId: input.correlationId ?? null,
      timestamp: input.timestamp ?? new Date().toISOString(),
      ...input.payload,
    }),
  );
}
