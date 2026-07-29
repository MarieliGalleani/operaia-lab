import { z } from "zod";

/**
 * Validacao das variaveis de ambiente na inicializacao.
 * Falhar cedo (fail-fast) evita erros obscuros em runtime.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(3333),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  DATABASE_URL: z.string().url(),

  /** Provedor de LLM da Equipe Digital. */
  LLM_PROVIDER: z
    .enum(["gemini", "openai", "anthropic", "openrouter", "deterministic"])
    .default("gemini"),
  LLM_MODEL: z.string().default("gemini-3.6-flash"),
  /** CSV de fallbacks, ex.: "openai,anthropic" (ignorados se nao implementados). */
  LLM_FALLBACK_PROVIDERS: z.string().optional(),
  LLM_MAX_TOKENS_CLAMP: z.coerce.number().int().positive().default(8192),
  LLM_OBSERVABILITY: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),

  /** Painel VPS — metadados e custo mensal estimado (0 = sem custo). */
  VPS_NAME: z.string().default("OperaIA · ambiente local"),
  VPS_PROVIDER: z.string().default("local"),
  VPS_REGION: z.string().default("dev"),
  VPS_MONTHLY_COST_BRL: z.coerce.number().nonnegative().default(0),
  VPS_COST_CURRENCY: z.string().default("BRL"),

  /** Runtime continuo (workers + scheduler + fila). */
  CONTINUOUS_RUNTIME_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  WORKER_HEARTBEAT_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(5000),
  SCHEDULER_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
  MISSION_STALE_RUNNING_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),

  /**
   * Unified Mission Gateway (ADR-007) — Assisted via MissionQueue.
   * Default true: Queue e o caminho oficial.
   * Kill-switch: ASSISTED_QUEUE_MODE=false volta ao Path A sync (legado).
   */
  ASSISTED_QUEUE_MODE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  /** Timeout do waitUntilTerminal no Assisted→Queue (ms). Evita HTTP infinito. */
  ASSISTED_MISSION_WAIT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(180_000),
  ASSISTED_MISSION_WAIT_POLL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(500),

  /**
   * Memory M1 — store persistente vs volátil.
   * prisma = OperationalMemoryNote (default produto).
   * inmemory = kill-switch / rollback sem drop de tabela.
   */
  MEMORY_STORE: z.enum(["prisma", "inmemory"]).default("prisma"),

  /**
   * M1.4 — fallback controlado: se o indice OperationalMemoryNote
   * nao tiver learnings, le MissionLearning (ledger).
   * Default false apos cutover; true so durante migracao/backfill incompleto.
   */
  MEMORY_M1_LEARNING_FALLBACK: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Variaveis de ambiente invalidas:",
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
