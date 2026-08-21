import { parseLLMProviderList } from "@operaia/ai-core";
import { DIGITAL_TEAM_EMPLOYEES } from "@operaia/digital-team";
import { DomainSignalService } from "@operaia/domain-signals";
import {
  PrismaExecutionLedger,
  type ActionExecutionPrismaClient,
} from "@operaia/action-runtime";
import { prisma } from "@operaia/database";
import { env } from "../../config/env.js";
import { RepositoryWorkspaceSource } from "../employees/repository-workspace-source.js";
import {
  createMemoryStore,
  resolveMemoryStoreMode,
} from "../memory/memory-store-factory.js";
import {
  createLabRuntime,
  type LabRuntime,
} from "../operations/lab-runtime.js";
import { PrismaProjectRepository } from "../projects/infrastructure/prisma-project.repository.js";
import { ensureOfficialOperationalCatalog } from "../projects/ensure-official-operational-catalog.js";
import { PrismaDomainSignalStore } from "../signals/prisma-domain-signal-store.js";
import { PrismaTaskRepository } from "../tasks/infrastructure/prisma-task.repository.js";
import { ContinuousRuntime } from "../runtime/continuous-runtime.js";
import { resolveWorkerLivenessMs } from "../runtime/worker-liveness.js";
import { createPrismaAlreadyDoneGate } from "../runtime/work-governance/index.js";

export interface ProductRuntime {
  readonly lab: LabRuntime;
  readonly continuous: ContinuousRuntime;
  readonly workGovernanceGate: ReturnType<
    typeof createPrismaAlreadyDoneGate
  >;
}

/**
 * Bootstrap de produto (API): Prisma + LLM + runtime continuo.
 * Separado de lab-runtime.ts para nao carregar env nos testes unitarios.
 */
export function createProductLabRuntime(): ProductRuntime {
  const taskRepository = new PrismaTaskRepository();
  const projectRepository = new PrismaProjectRepository();
  const teamIds = DIGITAL_TEAM_EMPLOYEES.map((entry) => entry.profile.id);
  const workspaces = new RepositoryWorkspaceSource(
    projectRepository,
    taskRepository,
    teamIds,
  );
  const signalStore = new PrismaDomainSignalStore();
  const signals = new DomainSignalService(signalStore);

  const memoryStore = createMemoryStore(
    resolveMemoryStoreMode(env.MEMORY_STORE),
  );

  const workGovernanceGate = createPrismaAlreadyDoneGate();

  const lab = createLabRuntime({
    stack: {
      provider: env.LLM_PROVIDER,
      model: env.LLM_MODEL,
      geminiApiKey: env.GEMINI_API_KEY,
      openaiApiKey: env.OPENAI_API_KEY,
      anthropicApiKey: env.ANTHROPIC_API_KEY,
      openRouterApiKey: env.OPENROUTER_API_KEY,
      fallbackProviders: parseLLMProviderList(env.LLM_FALLBACK_PROVIDERS),
      maxTokensClamp: env.LLM_MAX_TOKENS_CLAMP,
    },
    workspaces,
    taskRepository,
    memoryStore,
    enableConsoleObservability: env.LLM_OBSERVABILITY,
    // Unified Mission Gateway: default env true; kill-switch ASSISTED_QUEUE_MODE=false.
    preferQueue: env.ASSISTED_QUEUE_MODE,
    missionWait: {
      timeoutMs: env.ASSISTED_MISSION_WAIT_TIMEOUT_MS,
      pollIntervalMs: env.ASSISTED_MISSION_WAIT_POLL_MS,
    },
    workGovernanceGate,
  });

  const continuous = new ContinuousRuntime({
    office: lab.office,
    workspaces,
    projects: projectRepository,
    tasks: taskRepository,
    execution: lab.execution,
    memory: lab.memory,
    logger: createPinoLikeLogger(),
    enabled: env.CONTINUOUS_RUNTIME_ENABLED,
    pollIntervalMs: env.WORKER_POLL_INTERVAL_MS,
    heartbeatIntervalMs: env.WORKER_HEARTBEAT_INTERVAL_MS,
    schedulerIntervalMs: env.SCHEDULER_INTERVAL_MS,
    // MQ-3: grace = 3 batimentos perdidos (default 15s com HB=5s).
    // MISSION_STALE_RUNNING_MS nao e mais autoridade de reclaim por updatedAt.
    staleRunningMs: resolveWorkerLivenessMs(env.WORKER_HEARTBEAT_INTERVAL_MS),
    allowLearningPrismaFallback: env.MEMORY_M1_LEARNING_FALLBACK,
    ensureOfficialCatalog: () =>
      ensureOfficialOperationalCatalog({
        projects: projectRepository,
        upsertBinding: (binding) => signals.upsertBinding(binding),
      }),
    listEnabledBindingWorkspaceIds: async () => {
      const bindings = await signals.listBindings({ enabledOnly: true });
      return bindings.map((binding) => binding.workspaceId);
    },
    domainSignals: signals,
    githubToken: env.GITHUB_TOKEN,
    workGovernanceGate,
    workspaceInfraRoots: {
      "operaia-lab": process.cwd(),
    },
    executionLedger: new PrismaExecutionLedger(
      prisma as unknown as ActionExecutionPrismaClient,
    ),
    workspaceActionTargets: {
      "operaia-lab": [
        "api",
        "operaia-lab-api.service",
        "infra/caddy/Caddyfile",
      ],
    },
  });

  // Fila disponivel para Assisted; default ASSISTED_QUEUE_MODE=true (kill-switch=false).
  lab.operations.service.bindQueue(continuous.queue);
  lab.operations.service.bindWorkGovernanceGate(workGovernanceGate);
  lab.operations.fallbackObserver.bindSink(continuous.queue);

  return { lab, continuous, workGovernanceGate };
}

function createPinoLikeLogger() {
  return {
    info(obj: Record<string, unknown>, msg?: string) {
      console.log(JSON.stringify({ level: "info", msg, ...obj }));
    },
    warn(obj: Record<string, unknown>, msg?: string) {
      console.warn(JSON.stringify({ level: "warn", msg, ...obj }));
    },
    error(obj: Record<string, unknown>, msg?: string) {
      console.error(JSON.stringify({ level: "error", msg, ...obj }));
    },
  };
}
