import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { env } from "./config/env.js";
import { agentRoutes } from "./modules/agents/agents.routes.js";
import { createEmployeeRoutes } from "./modules/employees/employees.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { infraRoutes } from "./modules/infra/vps.routes.js";
import { createProductLabRuntime } from "./modules/operations/product-lab-runtime.js";
import { createOperationsRoutes } from "./modules/operations/operations.routes.js";
import { projectRoutes } from "./modules/projects/projects.routes.js";
import type { ContinuousRuntime } from "./modules/runtime/continuous-runtime.js";
import { createRuntimeRoutes } from "./modules/runtime/runtime.routes.js";
import { enqueueSignalCoordinateMission } from "./modules/runtime/signal-mission-converter.js";
import { createGithubWebhookRoutes } from "./modules/signals/github-webhook.routes.js";
import { createSignalRuntime } from "./modules/signals/signal-runtime.js";
import { resolveWebhookSecret } from "./modules/signals/secret-resolver.js";
import { taskRoutes } from "./modules/tasks/tasks.routes.js";
import { createWorkspaceRoutes } from "./modules/workspaces/workspaces.routes.js";
import { errorHandler } from "./shared/error-handler.js";

export interface AppBundle {
  readonly app: FastifyInstance;
  readonly continuous: ContinuousRuntime;
}

/**
 * Composition root da API: monta o Fastify e registra modulos.
 * Lab Runtime unificado = Equipe Digital + Operations + Continuous Runtime.
 */
export function buildApp(): AppBundle {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);

  void app.register(cors, {
    origin: true,
  });

  const { lab, continuous } = createProductLabRuntime();
  const signalRuntime = createSignalRuntime();

  app.register(healthRoutes);
  app.register(infraRoutes, { prefix: "/api/v1/infra" });
  app.register(projectRoutes, { prefix: "/api/v1/projects" });
  app.register(taskRoutes, { prefix: "/api/v1/tasks" });
  app.register(agentRoutes, { prefix: "/api/v1/agents" });
  app.register(createEmployeeRoutes(lab.team), {
    prefix: "/api/v1/employees",
  });
  app.register(createWorkspaceRoutes(lab.team), {
    prefix: "/api/v1/workspaces",
  });
  app.register(createOperationsRoutes(lab.operations), {
    prefix: "/api/v1/operations",
  });
  app.register(createRuntimeRoutes(continuous), {
    prefix: "/api/v1",
  });
  app.register(
    createGithubWebhookRoutes({
      signals: signalRuntime.signals,
      bridge: signalRuntime.bridge,
      ingest: signalRuntime.ingest,
      resolveSecret: (ref) =>
        resolveWebhookSecret(ref, {
          ...process.env,
          ...(env.GITHUB_WEBHOOK_SECRET
            ? { GITHUB_WEBHOOK_SECRET: env.GITHUB_WEBHOOK_SECRET }
            : {}),
        }),
      onConvertCandidate: async ({ signal }) =>
        enqueueSignalCoordinateMission({
          queue: continuous.queue,
          signal,
        }),
    }),
    { prefix: "/api/v1/webhooks" },
  );

  return { app, continuous };
}
