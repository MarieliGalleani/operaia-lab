/**
 * Protecao F6.2 — proof/harness nao escreve silenciosamente no DB operacional.
 *
 * Padrao: ABORT se DATABASE_URL for operacional.
 * Opt-in explicito: OPERAIA_PROOF_ALLOW_OPERATIONAL_DB=1
 * Banco seguro: nome contem _test / _proof / _harness, ou OPERAIA_PROOF_DB_OK=1
 *              com URL que nao e operacional.
 */
export class ProofDatabaseUnsafeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProofDatabaseUnsafeError";
  }
}

export function parseDatabaseName(databaseUrl: string): string | null {
  try {
    const normalized = databaseUrl.replace(/^postgresql:/i, "http:");
    const url = new URL(normalized);
    const path = url.pathname.replace(/^\//, "");
    const name = path.split("?")[0]?.trim();
    return name || null;
  } catch {
    const match = /\/([^/?]+)(?:\?|$)/.exec(databaseUrl);
    return match?.[1] ?? null;
  }
}

export function isOperationalDatabaseUrl(databaseUrl: string): boolean {
  const explicit = process.env.OPERAIA_OPERATIONAL_DATABASE_URL?.trim();
  if (explicit && urlsLooselyEqual(explicit, databaseUrl)) {
    return true;
  }
  const name = parseDatabaseName(databaseUrl);
  if (!name) {
    return false;
  }
  // Nomes do lab/prod usados pelo systemd operaia-lab-api.
  return name === "operaia_lab" || name === "operaia";
}

export function isProofSafeDatabaseUrl(databaseUrl: string): boolean {
  if (!databaseUrl.trim()) {
    return false;
  }
  if (isOperationalDatabaseUrl(databaseUrl)) {
    return false;
  }
  const name = parseDatabaseName(databaseUrl) ?? "";
  if (/(_test|_proof|_harness)/i.test(name)) {
    return true;
  }
  return process.env.OPERAIA_PROOF_DB_OK === "1";
}

/**
 * Chamar ANTES de ContinuousRuntime.start / enqueue / latch writes.
 */
export function assertProofDatabaseIsSafe(context = "proof-harness"): void {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!databaseUrl.trim()) {
    throw new ProofDatabaseUnsafeError(
      `[${context}] DATABASE_URL ausente — abortando antes de qualquer escrita.`,
    );
  }

  if (process.env.OPERAIA_PROOF_ALLOW_OPERATIONAL_DB === "1") {
    return;
  }

  if (isOperationalDatabaseUrl(databaseUrl)) {
    throw new ProofDatabaseUnsafeError(
      `[${context}] DATABASE_URL aponta para banco operacional ` +
        `(${parseDatabaseName(databaseUrl) ?? "unknown"}). ` +
        `Proof/harness abortado antes de escrita. ` +
        `Use banco *_test/*_proof ou defina OPERAIA_PROOF_ALLOW_OPERATIONAL_DB=1 ` +
        `apenas em janela explicitamente autorizada.`,
    );
  }

  if (!isProofSafeDatabaseUrl(databaseUrl)) {
    throw new ProofDatabaseUnsafeError(
      `[${context}] DATABASE_URL nao reconhecida como segura para proofs ` +
        `(db=${parseDatabaseName(databaseUrl) ?? "unknown"}). ` +
        `Use sufixo _test/_proof/_harness ou OPERAIA_PROOF_DB_OK=1.`,
    );
  }
}

function urlsLooselyEqual(a: string, b: string): boolean {
  return a.trim() === b.trim();
}
