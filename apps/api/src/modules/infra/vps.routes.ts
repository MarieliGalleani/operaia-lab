import { prisma } from "@operaia/database";
import os from "node:os";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { env } from "../../config/env.js";

const checkStatusSchema = z.enum([
  "up",
  "down",
  "ready",
  "unconfigured",
  "warn",
]);

const insightLevelSchema = z.enum(["info", "success", "warning", "critical"]);

const vpsSnapshotSchema = z.object({
  checkedAt: z.string(),
  overall: z.enum(["healthy", "degraded", "down"]),
  summary: z.object({
    headline: z.string(),
    servicesUp: z.number(),
    servicesTotal: z.number(),
    scoreLabel: z.string(),
  }),
  vps: z.object({
    name: z.string(),
    provider: z.string(),
    region: z.string(),
    role: z.string(),
  }),
  costs: z.object({
    currency: z.string(),
    monthlyEstimate: z.number(),
    dailyEstimate: z.number(),
    yearlyEstimate: z.number(),
    status: z.enum(["none", "active"]),
    message: z.string(),
    note: z.string(),
  }),
  checks: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      category: z.string(),
      status: checkStatusSchema,
      detail: z.string(),
      hint: z.string().optional(),
      latencyMs: z.number().optional(),
    }),
  ),
  process: z.object({
    pid: z.number(),
    uptimeSec: z.number(),
    memoryRssMb: z.number(),
    memoryHeapUsedMb: z.number(),
    memoryHeapTotalMb: z.number(),
    memoryExternalMb: z.number(),
    memorySoftLimitMb: z.number(),
    nodeEnv: z.string(),
    nodeVersion: z.string(),
    platform: z.string(),
    arch: z.string(),
    cpuCount: z.number(),
    loadAvg1m: z.number(),
    loadAvg5m: z.number(),
    loadAvg15m: z.number(),
    hostname: z.string(),
  }),
  /** Métricas reais da máquina / SO (não simuladas). */
  host: z.object({
    totalMemMb: z.number(),
    freeMemMb: z.number(),
    usedMemMb: z.number(),
    usedMemPct: z.number(),
    cpuPct: z.number(),
    uptimeSec: z.number(),
  }),
  healthScore: z.number().min(0).max(100),
  database: z.object({
    host: z.string(),
    name: z.string(),
    reachable: z.boolean(),
    latencyMs: z.number().nullable(),
  }),
  llm: z.object({
    provider: z.string(),
    model: z.string(),
    configured: z.boolean(),
    fallbacks: z.array(z.string()),
    observability: z.boolean(),
  }),
  insights: z.array(
    z.object({
      id: z.string(),
      level: insightLevelSchema,
      title: z.string(),
      body: z.string(),
    }),
  ),
  refresh: z.object({
    suggestedIntervalSec: z.number(),
  }),
});

export type VpsSnapshot = z.infer<typeof vpsSnapshotSchema>;

/** Amostra anterior de CPU para calcular % real entre requests. */
let prevCpuSample: { idle: number; total: number } | null = null;

function readCpuTimes(): { idle: number; total: number } {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    idle += cpu.times.idle;
    total +=
      cpu.times.user +
      cpu.times.nice +
      cpu.times.sys +
      cpu.times.idle +
      cpu.times.irq;
  }
  return { idle, total };
}

/** CPU% real via delta entre amostras (fallback: média desde boot). */
function sampleCpuPct(): number {
  const now = readCpuTimes();
  if (!prevCpuSample || now.total <= prevCpuSample.total) {
    prevCpuSample = now;
    if (now.total <= 0) return 0;
    return Math.round((1 - now.idle / now.total) * 1000) / 10;
  }
  const idleDelta = now.idle - prevCpuSample.idle;
  const totalDelta = now.total - prevCpuSample.total;
  prevCpuSample = now;
  if (totalDelta <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - idleDelta / totalDelta) * 1000) / 10));
}

function hostMemory(): {
  totalMemMb: number;
  freeMemMb: number;
  usedMemMb: number;
  usedMemPct: number;
} {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const totalMemMb = roundMb(total);
  const freeMemMb = roundMb(free);
  const usedMemMb = roundMb(used);
  const usedMemPct =
    total > 0 ? Math.round((used / total) * 1000) / 10 : 0;
  return { totalMemMb, freeMemMb, usedMemMb, usedMemPct };
}

function computeHealthScore(input: {
  overall: VpsSnapshot["overall"];
  dbOk: boolean;
  dbLatency: number | null;
  memWarn: boolean;
  llmOk: boolean;
  cpuPct: number;
  usedMemPct: number;
}): number {
  let score = 100;
  if (!input.dbOk) score -= 45;
  else if (input.dbLatency != null && input.dbLatency > 120) score -= 15;
  if (!input.llmOk) score -= 12;
  if (input.memWarn) score -= 18;
  if (input.cpuPct > 85) score -= 15;
  else if (input.cpuPct > 70) score -= 8;
  if (input.usedMemPct > 90) score -= 12;
  else if (input.usedMemPct > 80) score -= 6;
  if (input.overall === "down") score = Math.min(score, 35);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function llmConfigured(): boolean {
  switch (env.LLM_PROVIDER) {
    case "gemini":
      return Boolean(env.GEMINI_API_KEY);
    case "openai":
      return Boolean(env.OPENAI_API_KEY);
    case "anthropic":
      return Boolean(env.ANTHROPIC_API_KEY);
    case "openrouter":
      return Boolean(env.OPENROUTER_API_KEY);
    case "deterministic":
      return true;
    default:
      return false;
  }
}

function parseDatabaseTarget(url: string): { host: string; name: string } {
  try {
    const parsed = new URL(url);
    const port = parsed.port || "5432";
    const name = parsed.pathname.replace(/^\//, "").split("?")[0] || "—";
    return { host: `${parsed.hostname}:${port}`, name };
  } catch {
    return { host: "—", name: "—" };
  }
}

function roundMb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

/**
 * Painel operacional da VPS / infra: saude rica + custo mensal estimado.
 */
export const infraRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/vps",
    {
      schema: {
        tags: ["infra"],
        response: { 200: vpsSnapshotSchema },
      },
    },
    async () => {
      const checkedAt = new Date().toISOString();
      const checks: VpsSnapshot["checks"] = [];
      const insights: VpsSnapshot["insights"] = [];
      const memorySoftLimitMb = 512;
      const dbTarget = parseDatabaseTarget(env.DATABASE_URL);

      checks.push({
        id: "api",
        label: "API Fastify",
        category: "Runtime",
        status: "up",
        detail: `${env.API_HOST}:${env.API_PORT} · log ${env.LOG_LEVEL}`,
        hint: "Endpoint de negócio e health checks",
      });

      let dbOk = false;
      let dbLatency: number | null = null;
      const dbStarted = Date.now();
      try {
        await prisma.$queryRaw`SELECT 1`;
        dbOk = true;
        dbLatency = Date.now() - dbStarted;
        checks.push({
          id: "database",
          label: "PostgreSQL",
          category: "Dados",
          status: dbLatency > 120 ? "warn" : "up",
          detail: `${dbTarget.name} @ ${dbTarget.host}`,
          hint:
            dbLatency > 120
              ? "Latência elevada — verifique carga ou rede"
              : "Consulta SELECT 1 respondendo",
          latencyMs: dbLatency,
        });
        if (dbLatency > 120) {
          insights.push({
            id: "db-latency",
            level: "warning",
            title: "Banco lento",
            body: `PostgreSQL respondeu em ${dbLatency} ms. Acima de 120 ms merece atenção.`,
          });
        }
      } catch (error) {
        console.log("[infra/vps] database check failed:", error);
        checks.push({
          id: "database",
          label: "PostgreSQL",
          category: "Dados",
          status: "down",
          detail: `${dbTarget.name} @ ${dbTarget.host}`,
          hint: "Suba o Docker/Postgres ou confira DATABASE_URL",
          latencyMs: Date.now() - dbStarted,
        });
        insights.push({
          id: "db-down",
          level: "critical",
          title: "Banco indisponível",
          body: "A API não conseguiu consultar o PostgreSQL. Projetos e equipe ficam bloqueados.",
        });
      }

      const mem = process.memoryUsage();
      const memoryRssMb = roundMb(mem.rss);
      const memoryHeapUsedMb = roundMb(mem.heapUsed);
      const memoryHeapTotalMb = roundMb(mem.heapTotal);
      const memoryExternalMb = roundMb(mem.external);
      const memWarn = memoryRssMb > memorySoftLimitMb;
      checks.push({
        id: "process",
        label: "Processo Node",
        category: "Runtime",
        status: memWarn ? "warn" : "up",
        detail: `PID ${process.pid} · RSS ${memoryRssMb} MB`,
        hint: memWarn
          ? `RSS acima do soft limit (${memorySoftLimitMb} MB)`
          : "Memória dentro do limite operacional",
      });

      const llmOk = llmConfigured();
      const fallbacks = (env.LLM_FALLBACK_PROVIDERS ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      checks.push({
        id: "llm",
        label: "LLM Stack",
        category: "IA",
        status: llmOk ? "ready" : "unconfigured",
        detail: `${env.LLM_PROVIDER} · ${env.LLM_MODEL}`,
        hint: llmOk
          ? fallbacks.length
            ? `Fallbacks: ${fallbacks.join(", ")}`
            : "Chave presente · sem fallbacks"
          : "Defina a API key do provedor no .env",
      });
      if (!llmOk) {
        insights.push({
          id: "llm-key",
          level: "warning",
          title: "LLM sem chave",
          body: `Provider ${env.LLM_PROVIDER} está ativo, mas a chave não foi encontrada.`,
        });
      }

      const monthly = env.VPS_MONTHLY_COST_BRL;
      const daily = Math.round((monthly / 30) * 100) / 100;
      const yearly = Math.round(monthly * 12 * 100) / 100;
      const costs: VpsSnapshot["costs"] = {
        currency: env.VPS_COST_CURRENCY,
        monthlyEstimate: monthly,
        dailyEstimate: daily,
        yearlyEstimate: yearly,
        status: monthly > 0 ? "active" : "none",
        message:
          monthly > 0
            ? "Estimativa mensal configurada no ambiente"
            : "Sem custo mensal no momento",
        note:
          monthly > 0
            ? "Valor manual (env). Não sincroniza billing do provedor."
            : "Ideal para lab local / free tier. Atualize VPS_MONTHLY_COST_BRL quando houver VPS paga.",
      };

      if (monthly === 0) {
        insights.push({
          id: "cost-zero",
          level: "success",
          title: "Custo zerado",
          body: "Nenhum gasto mensal configurado. O painel segue monitorando só a saúde.",
        });
      }

      const load = os.loadavg();
      const load1 = Math.round((load[0] ?? 0) * 100) / 100;
      const load5 = Math.round((load[1] ?? 0) * 100) / 100;
      const load15 = Math.round((load[2] ?? 0) * 100) / 100;
      const hostMem = hostMemory();
      const cpuPct = sampleCpuPct();

      let overall: VpsSnapshot["overall"] = "healthy";
      if (!dbOk) overall = "down";
      else if (
        !llmOk ||
        memWarn ||
        (dbLatency != null && dbLatency > 120) ||
        cpuPct > 85 ||
        hostMem.usedMemPct > 90
      ) {
        overall = "degraded";
      }

      if (overall === "healthy") {
        insights.unshift({
          id: "all-good",
          level: "success",
          title: "Infra estável",
          body: "API, dados e processo respondendo. Bom momento para operar o Campus.",
        });
      } else if (overall === "degraded") {
        insights.unshift({
          id: "degraded",
          level: "warning",
          title: "Ambiente degradado",
          body: "Algum serviço precisa de atenção, mas a API ainda responde.",
        });
      }

      if (cpuPct > 85) {
        insights.push({
          id: "cpu-high",
          level: "warning",
          title: "CPU elevada",
          body: `Uso de CPU em ${cpuPct}% — verifique processos ou carga da API.`,
        });
      }
      if (hostMem.usedMemPct > 85) {
        insights.push({
          id: "host-mem",
          level: "warning",
          title: "RAM do host pressionada",
          body: `${hostMem.usedMemPct}% da memória da máquina em uso (${hostMem.usedMemMb}/${hostMem.totalMemMb} MB).`,
        });
      }

      const servicesUp = checks.filter((c) =>
        ["up", "ready"].includes(c.status),
      ).length;
      const servicesTotal = checks.length;
      const headline =
        overall === "healthy"
          ? "Tudo operacional"
          : overall === "degraded"
            ? "Operando com ressalvas"
            : "Falha crítica na infra";

      const healthScore = computeHealthScore({
        overall,
        dbOk,
        dbLatency,
        memWarn,
        llmOk,
        cpuPct,
        usedMemPct: hostMem.usedMemPct,
      });

      const snapshot: VpsSnapshot = {
        checkedAt,
        overall,
        summary: {
          headline,
          servicesUp,
          servicesTotal,
          scoreLabel: `${servicesUp}/${servicesTotal} serviços OK`,
        },
        vps: {
          name: env.VPS_NAME,
          provider: env.VPS_PROVIDER,
          region: env.VPS_REGION,
          role: "Ambiente de execução OperaIA",
        },
        costs,
        checks,
        process: {
          pid: process.pid,
          uptimeSec: Math.floor(process.uptime()),
          memoryRssMb,
          memoryHeapUsedMb,
          memoryHeapTotalMb,
          memoryExternalMb,
          memorySoftLimitMb,
          nodeEnv: env.NODE_ENV,
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          cpuCount: os.cpus().length,
          loadAvg1m: load1,
          loadAvg5m: load5,
          loadAvg15m: load15,
          hostname: os.hostname(),
        },
        host: {
          ...hostMem,
          cpuPct,
          uptimeSec: Math.floor(os.uptime()),
        },
        healthScore,
        database: {
          host: dbTarget.host,
          name: dbTarget.name,
          reachable: dbOk,
          latencyMs: dbLatency,
        },
        llm: {
          provider: env.LLM_PROVIDER,
          model: env.LLM_MODEL,
          configured: llmOk,
          fallbacks,
          observability: env.LLM_OBSERVABILITY,
        },
        insights,
        refresh: { suggestedIntervalSec: 12 },
      };

      console.log(
        "[infra/vps] overall=",
        snapshot.overall,
        "score=",
        healthScore,
        "cpu=",
        cpuPct,
        "hostMem%=",
        hostMem.usedMemPct,
      );
      return snapshot;
    },
  );
};
