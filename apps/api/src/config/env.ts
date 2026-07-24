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
