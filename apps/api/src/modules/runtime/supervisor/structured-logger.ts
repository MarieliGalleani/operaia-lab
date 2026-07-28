import type { SupervisorLoggerPort } from "./ports.js";
import { SupervisorEvent } from "./types.js";

export type StructuredLogSink = (
  level: "info" | "warn" | "error",
  payload: Readonly<Record<string, unknown>>,
) => void;

/**
 * Logger estruturado do Operational Supervisor.
 * Emite eventos canonicos (SUPERVISOR_*, HEALTH_*, MISSION_*, QUEUE_*).
 */
export class StructuredSupervisorLogger implements SupervisorLoggerPort {
  constructor(
    private readonly sink: StructuredLogSink = defaultSink,
    private readonly component = "operational-supervisor",
  ) {}

  emit(
    event: SupervisorEvent,
    data: Readonly<Record<string, unknown>> = {},
  ): void {
    const level =
      event === SupervisorEvent.HEALTH_FAIL ? "error" : ("info" as const);
    this.sink(level, {
      component: this.component,
      event,
      at: new Date().toISOString(),
      ...data,
    });
  }
}

function defaultSink(
  level: "info" | "warn" | "error",
  payload: Readonly<Record<string, unknown>>,
): void {
  const line = JSON.stringify({ level, ...payload });
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}
