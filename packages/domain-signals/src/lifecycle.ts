import type { DomainSignalStatus } from "./types.js";

/**
 * Transicoes permitidas (ADR-009).
 * converted exige avaliacao previa (EVALUATED → CONVERTED).
 */
const ALLOWED: Readonly<Record<DomainSignalStatus, readonly DomainSignalStatus[]>> =
  {
    DETECTED: ["EVALUATED", "IGNORED", "EXPIRED"],
    EVALUATED: ["CONVERTED", "IGNORED", "EXPIRED", "DETECTED"],
    CONVERTED: ["RESOLVED"],
    RESOLVED: [],
    IGNORED: [],
    EXPIRED: [],
  };

export function canTransition(
  from: DomainSignalStatus,
  to: DomainSignalStatus,
): boolean {
  if (from === to) {
    return true;
  }
  return ALLOWED[from].includes(to);
}

export function assertTransition(
  from: DomainSignalStatus,
  to: DomainSignalStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Transicao DomainSignal invalida: ${from} → ${to}`,
    );
  }
}

export function isTerminalStatus(status: DomainSignalStatus): boolean {
  return (
    status === "RESOLVED" || status === "IGNORED" || status === "EXPIRED"
  );
}
