import type { ExecutionSummary } from "./execution-engine.js";

/**
 * Plano proposto pelo Runtime. Para o orquestrador o `payload` e OPACO:
 * ele apenas o repassa a porta de execucao, sem inspecionar seu conteudo.
 * Isso mantem o orquestrador neutro em relacao ao formato real do plano.
 */
export interface ProposedPlan {
  readonly id: string;
  readonly actionCount: number;
  readonly payload: unknown;
}

/** Requisicao enviada ao Runtime a cada ciclo. */
export interface RuntimeRequest {
  readonly objective: string;
  readonly cycle: number;
  readonly metadata: Readonly<Record<string, unknown>>;
  /** Resultado da execucao anterior, para permitir replanejamento. */
  readonly previousExecution: ExecutionSummary | null;
}

/** Resposta neutra do Runtime a partir da qual o plano e extraido. */
export interface RuntimeOutcome {
  readonly plan: ProposedPlan;
  /** Sinal (fornecido pelo adapter do agente) de que o objetivo foi atingido. */
  readonly objectiveCompleted: boolean;
  readonly output?: string;
}

/** Porta para o Agent Runtime. Coordena qualquer agente, presente ou futuro. */
export interface RuntimePort {
  run(request: RuntimeRequest): Promise<RuntimeOutcome>;
}
