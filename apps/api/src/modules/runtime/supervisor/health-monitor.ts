import type { ClockPort, HealthCheckPort } from "./ports.js";
import type { HealthComponentReport, HealthReport, HealthStatus } from "./types.js";

/**
 * HealthMonitor — verifica Runtime, Registry, Memory, Queue, Execution, Mission engine.
 * Registra snapshot. Nunca decide.
 */
export class HealthMonitor {
  constructor(
    private readonly checks: readonly HealthCheckPort[],
    private readonly clock: ClockPort,
  ) {}

  async run(): Promise<HealthReport> {
    const components: HealthComponentReport[] = [];
    for (const check of this.checks) {
      try {
        const result = await check.check();
        components.push({
          name: check.name,
          status: result.status,
          detail: result.detail,
        });
      } catch (error) {
        components.push({
          name: check.name,
          status: "fail",
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      checkedAt: this.clock.now().toISOString(),
      overall: resolveOverall(components),
      components,
    };
  }
}

function resolveOverall(
  components: readonly HealthComponentReport[],
): HealthStatus {
  if (components.some((c) => c.status === "fail")) {
    return "fail";
  }
  if (components.some((c) => c.status === "degraded")) {
    return "degraded";
  }
  return "ok";
}

/** Alias legado. */
export { HealthMonitor as HealthChecker };
