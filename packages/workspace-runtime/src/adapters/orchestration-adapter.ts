import type {
  OrchestrationEngine,
  OrchestrationResult,
} from "@operaia/orchestration-engine";
import type { SessionRunInput, SessionRunner } from "../ports/session-runner.js";

/**
 * Adapta o OrchestrationEngine concreto a porta SessionRunner usada pelo
 * WorkspaceManager. Mantem o manager desacoplado do engine de orquestracao.
 */
export class OrchestrationAdapter implements SessionRunner {
  constructor(private readonly engine: OrchestrationEngine) {}

  run(input: SessionRunInput): Promise<OrchestrationResult> {
    return this.engine.run({
      objective: input.objective,
      id: input.sessionId,
      metadata: input.metadata,
      signal: input.signal,
    });
  }
}
