import type { Clock } from "../ports/clock.js";
import type { ExecutionStep } from "../types/execution-plan.js";
import type { LogLevel, RuntimeLog } from "../types/runtime-response.js";

/** Coletor de logs com medicao de duracao por estagio. */
export class RuntimeLogger {
  private readonly entries: RuntimeLog[] = [];

  constructor(private readonly clock: Clock) {}

  add(
    step: ExecutionStep,
    level: LogLevel,
    message: string,
    durationMs?: number,
  ): void {
    this.entries.push({
      step,
      level,
      message,
      at: this.clock.now(),
      durationMs,
    });
  }

  /** Executa `fn`, mede a duracao e registra a mensagem derivada do resultado. */
  async track<T>(
    step: ExecutionStep,
    fn: () => Promise<T> | T,
    describe: (result: T) => string,
  ): Promise<T> {
    const start = this.clock.now().getTime();
    const result = await fn();
    const durationMs = this.clock.now().getTime() - start;
    this.add(step, "info", describe(result), durationMs);
    return result;
  }

  snapshot(): readonly RuntimeLog[] {
    return [...this.entries];
  }
}
