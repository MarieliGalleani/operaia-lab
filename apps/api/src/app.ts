import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { env } from "./config/env.js";
import { agentRoutes } from "./modules/agents/agents.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { projectRoutes } from "./modules/projects/projects.routes.js";
import { taskRoutes } from "./modules/tasks/tasks.routes.js";
import { workspaceRoutes } from "./modules/workspaces/workspaces.routes.js";
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

  app.register(healthRoutes);
  app.register(projectRoutes, { prefix: "/api/v1/projects" });
  app.register(taskRoutes, { prefix: "/api/v1/tasks" });
  app.register(agentRoutes, { prefix: "/api/v1/agents" });
  app.register(workspaceRoutes, { prefix: "/api/v1/workspaces" });

  return app;
}
