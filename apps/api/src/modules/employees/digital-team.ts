import {
  createLLMStack,
  parseLLMProviderList,
} from "@operaia/ai-core";
import { env } from "../../config/env.js";
import { PrismaProjectRepository } from "../projects/infrastructure/prisma-project.repository.js";
import { PrismaTaskRepository } from "../tasks/infrastructure/prisma-task.repository.js";
import { EmployeesApplication } from "./employees.application.js";
import { createDigitalOffice } from "./office-composition.js";
import { RepositoryWorkspaceSource } from "./repository-workspace-source.js";

/**
 * Instancia unica da Equipe Digital na API.
 * LLM via createLLMStack (policy + observability + fallback) —
 * Employees nao conhecem Gemini nem policies.
 */
export function createDigitalTeam(): EmployeesApplication {
  const llm = createLLMStack({
    provider: env.LLM_PROVIDER,
    model: env.LLM_MODEL,
    geminiApiKey: env.GEMINI_API_KEY,
    openaiApiKey: env.OPENAI_API_KEY,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    openRouterApiKey: env.OPENROUTER_API_KEY,
    fallbackProviders: parseLLMProviderList(env.LLM_FALLBACK_PROVIDERS),
    maxTokensClamp: env.LLM_MAX_TOKENS_CLAMP,
    enableConsoleObservability: env.LLM_OBSERVABILITY,
  });

  return new EmployeesApplication({
    office: createDigitalOffice({ llm }),
    workspaces: new RepositoryWorkspaceSource(
      new PrismaProjectRepository(),
      new PrismaTaskRepository(),
    ),
  });
}

export const digitalTeam = createDigitalTeam();
