/**
 * Latch edge-triggered de COORDINATE (workspaceId + reason).
 *
 * PENDING = borda adquirida (missao ainda nao confirmada).
 * CONSUMED = COORDINATE entregue.
 * PENDING orfao (crash) so e reclamado apos staleAfterMs — evita roubar
 * acquire in-flight de outra instancia.
 */

export interface CoordinationLatchKey {
  readonly workspaceId: string;
  readonly reason: string;
}

export interface CoordinationAcquireResult {
  readonly acquired: boolean;
  readonly latchedAt?: Date;
  /** fresh = nova borda; reclaim = PENDING orfao stale recuperado. */
  readonly mode?: "fresh" | "reclaim";
}

export interface CoordinationAcquireOptions {
  /**
   * Idade minima de PENDING sem lastMissionId para reclaim (crash recovery).
   * Default do dispatcher: tipicamente = intervalo do Supervisor.
   */
  readonly staleAfterMs?: number;
}

export interface CoordinationLatchPort {
  tryAcquire(
    key: CoordinationLatchKey,
    options?: CoordinationAcquireOptions,
  ): Promise<CoordinationAcquireResult>;

  release(key: CoordinationLatchKey): Promise<void>;

  releaseAbsent(active: readonly CoordinationLatchKey[]): Promise<void>;

  releaseAll(): Promise<void>;

  /** PENDING → CONSUMED apos COORDINATE confirmada. */
  complete(key: CoordinationLatchKey, missionId: string): Promise<void>;
}

export function coordinationLatchKeyOf(
  key: CoordinationLatchKey,
): string {
  return `${key.workspaceId}\0${key.reason}`;
}
