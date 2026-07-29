/**
 * Constantes e helpers M1 (memoria operacional).
 * Sem dependencia de Prisma — usavel por writers e pelo store.
 */

export const MEMORY_LAYER_OPERATIONAL = "operational" as const;

export const MEMORY_KIND_RUN_SUMMARY = "operational-run-summary" as const;
export const MEMORY_KIND_ORG_LEARNING = "organizational-learning" as const;
export const MEMORY_KIND_DIGEST = "operational-digest" as const;

export type MemoryM1Kind =
  | typeof MEMORY_KIND_RUN_SUMMARY
  | typeof MEMORY_KIND_ORG_LEARNING
  | typeof MEMORY_KIND_DIGEST;

export const MEMORY_SOURCE_MISSION = "mission" as const;
export const MEMORY_SOURCE_LEARNING = "learning" as const;
export const MEMORY_SOURCE_DIGEST = "digest" as const;

export type MemorySourceType =
  | typeof MEMORY_SOURCE_MISSION
  | typeof MEMORY_SOURCE_LEARNING
  | typeof MEMORY_SOURCE_DIGEST;

export const MEMORY_ORIGIN_PERSIST_MISSION = "persistMissionMemory" as const;
export const MEMORY_ORIGIN_RECORD_LEARNING = "recordMissionLearning" as const;
export const MEMORY_ORIGIN_BACKFILL_MISSION = "backfill-mission" as const;
export const MEMORY_ORIGIN_BACKFILL_LEARNING = "backfill-learning" as const;

/** Politicas M1-v1 (lab). */
export const MEMORY_M1_MAX_AGE_DAYS = 90;
export const MEMORY_M1_QUOTA_PER_WORKSPACE = 2_000;
export const MEMORY_M1_DEFAULT_TOP_K = 5;
export const MEMORY_M1_MAX_TOP_K = 20;
export const MEMORY_M1_MAX_CONTENT_CHARS = 4_096;

export class MemoryQuotaExceededError extends Error {
  readonly code = "MEMORY_QUOTA_EXCEEDED" as const;

  constructor(
    readonly workspaceId: string,
    readonly quota: number,
  ) {
    super(
      `Quota M1 excedida para workspace ${workspaceId} (max ${quota} notes ativas)`,
    );
    this.name = "MemoryQuotaExceededError";
  }
}

export class MemoryWorkspaceRequiredError extends Error {
  readonly code = "MEMORY_WORKSPACE_REQUIRED" as const;

  constructor() {
    super("MemoryStore.search exige filter.workspaceId (isolamento M1)");
    this.name = "MemoryWorkspaceRequiredError";
  }
}

export function defaultExpiresAt(
  from: Date = new Date(),
  maxAgeDays = MEMORY_M1_MAX_AGE_DAYS,
): Date {
  return new Date(from.getTime() + maxAgeDays * 24 * 60 * 60 * 1000);
}

export function clampMemoryContent(content: string): string {
  if (content.length <= MEMORY_M1_MAX_CONTENT_CHARS) {
    return content;
  }
  return content.slice(0, MEMORY_M1_MAX_CONTENT_CHARS);
}

export function isAllowedM1Kind(kind: string): kind is MemoryM1Kind {
  return (
    kind === MEMORY_KIND_RUN_SUMMARY ||
    kind === MEMORY_KIND_ORG_LEARNING ||
    kind === MEMORY_KIND_DIGEST
  );
}
