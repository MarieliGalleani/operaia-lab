import { parseLLMProviderList } from "@operaia/ai-core";
import { env } from "../../config/env.js";
import { RepositoryWorkspaceSource } from "../employees/repository-workspace-source.js";
import { PrismaProjectRepository } from "../projects/infrastructure/prisma-project.repository.js";
import { PrismaTaskRepository } from "../tasks/infrastructure/prisma-task.repository.js";
import { createLabRuntime, type LabRuntime } from "./lab-runtime.js";

/**
 * Bootstrap de produto (API): Prisma + stack LLM do env.
 * Separado de lab-runtime.ts para nao carregar env nos testes unitarios.
 */
export function createProductLabRuntime(): LabRuntime {
  const taskRepository = new PrismaTaskRepository();
  return createLabRuntime({
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
    workspaces: new RepositoryWorkspaceSource(
      new PrismaProjectRepository(),
      taskRepository,
    ),
    taskRepository,
    enableConsoleObservability: env.LLM_OBSERVABILITY,
  });
}
