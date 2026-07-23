import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { parseLLMProviderList } from "@operaia/ai-core";
import { env } from "./config/env.js";
import { agentRoutes } from "./modules/agents/agents.routes.js";
import { digitalTeam } from "./modules/employees/digital-team.js";
import { createEmployeeRoutes } from "./modules/employees/employees.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { createOperationalRuntime } from "./modules/operations/operational-composition.js";
import { createOperationsRoutes } from "./modules/operations/operations.routes.js";
import { RepositoryWorkspaceSource } from "./modules/employees/repository-workspace-source.js";
import { PrismaProjectRepository } from "./modules/projects/infrastructure/prisma-project.repository.js";
import { PrismaTaskRepository } from "./modules/tasks/infrastructure/prisma-task.repository.js";
import { projectRoutes } from "./modules/projects/projects.routes.js";
import { taskRoutes } from "./modules/tasks/tasks.routes.js";
import { createWorkspaceRoutes } from "./modules/workspaces/workspaces.routes.js";
import { errorHandler } from "./shared/error-handler.js";

/**
 * Composition root da API: monta o Fastify, registra validacao Zod,
 * o handler de erros e os modulos de negocio sob o prefixo /api/v1.
 */
export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);

  void app.register(cors, {
    origin: true,
  });

  app.register(healthRoutes);
  app.register(projectRoutes, { prefix: "/api/v1/projects" });
  app.register(taskRoutes, { prefix: "/api/v1/tasks" });
  app.register(agentRoutes, { prefix: "/api/v1/agents" });
  app.register(createEmployeeRoutes(digitalTeam), {
    prefix: "/api/v1/employees",
  });
  app.register(createWorkspaceRoutes(digitalTeam), {
    prefix: "/api/v1/workspaces",
  });
  app.register(createOperationsRoutes(
    createOperationalRuntime({
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
        new PrismaTaskRepository(),
      ),
    }),
  ), {
    prefix: "/api/v1/operations",
  });

  return app;
}
