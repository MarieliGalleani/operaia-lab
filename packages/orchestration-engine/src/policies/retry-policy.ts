/**
 * Estrategia de retry/backoff para chamadas transitorias (Runtime/Execucao).
 * Totalmente desacoplada e plugavel.
 */
export interface RetryPolicy {
  shouldRetry(attempt: number, error: unknown): boolean;
  delayMs(attempt: number): number;
}

/** Sem retry (default). */
export class NoRetryPolicy implements RetryPolicy {
  shouldRetry(): boolean {
    return false;
  }
  delayMs(): number {
    return 0;
  }
}

export interface BackoffOptions {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly factor: number;
}

/** Retry com backoff exponencial: delay = baseDelayMs * factor^(attempt-1). */
export class ExponentialBackoffRetryPolicy implements RetryPolicy {
  constructor(private readonly options: BackoffOptions) {}

  shouldRetry(attempt: number): boolean {
    return attempt <= this.options.maxRetries;
  }

  delayMs(attempt: number): number {
    return this.options.baseDelayMs * this.options.factor ** (attempt - 1);
  }
}
