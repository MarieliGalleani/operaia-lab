import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { env } from "./config/env.js";
import { agentRoutes } from "./modules/agents/agents.routes.js";
import { ArgonPasswordHasher } from "./modules/auth/argon-password-hasher.js";
import { createAuthRoutes } from "./modules/auth/auth.routes.js";
import { AuthService } from "./modules/auth/auth-service.js";
import { registerAuthGuard } from "./modules/auth/auth-guard.js";
import { registerAuthenticatedApiHooks } from "./modules/auth/authenticated-api.js";
import { PrismaAuthRepository } from "./modules/auth/prisma-auth-repository.js";
import { createEmployeeRoutes } from "./modules/employees/employees.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { publicStatusRoutes } from "./modules/health/public-status.routes.js";
import { infraRoutes } from "./modules/infra/vps.routes.js";
import { createOfficeStatusRoutes } from "./modules/office/office-status.routes.js";
import { createAutomationOfficeRoutes } from "./modules/automation-office/index.js";
import { scheduleRuleRoutes } from "./modules/schedule-rules/schedule-rules.routes.js";
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
import {
  registerHttpSecurity,
  SENSITIVE_LOG_REDACT_PATHS,
} from "./shared/http-security.js";

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
    logger: {
      level: env.LOG_LEVEL,
      redact: {
        paths: [...SENSITIVE_LOG_REDACT_PATHS],
        censor: "[REDACTED]",
      },
    },
    trustProxy: "127.0.0.1",
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);

  registerHttpSecurity(app, env.NODE_ENV);
  void app.register(cookie);

  const authService = new AuthService(
    new PrismaAuthRepository(),
    new ArgonPasswordHasher(),
  );
  registerAuthGuard(app, authService);

  const { lab, continuous, workGovernanceGate } = createProductLabRuntime();
  const signalRuntime = createSignalRuntime();

  app.register(healthRoutes);
  app.register(publicStatusRoutes);
  app.register(createAuthRoutes(authService, env.NODE_ENV === "production"), {
    prefix: "/api/auth",
  });
  app.register(async (protectedApi) => {
    registerAuthenticatedApiHooks(protectedApi);
    protectedApi.register(infraRoutes, { prefix: "/api/v1/infra" });
    protectedApi.register(projectRoutes, { prefix: "/api/v1/projects" });
    protectedApi.register(taskRoutes, { prefix: "/api/v1/tasks" });
    protectedApi.register(agentRoutes, { prefix: "/api/v1/agents" });
    protectedApi.register(createEmployeeRoutes(lab.team), {
      prefix: "/api/v1/employees",
    });
    protectedApi.register(createWorkspaceRoutes(lab.team), {
      prefix: "/api/v1/workspaces",
    });
    protectedApi.register(createOperationsRoutes(lab.operations), {
      prefix: "/api/v1/operations",
    });
    protectedApi.register(createRuntimeRoutes(continuous), {
      prefix: "/api/v1",
    });
    protectedApi.register(createOfficeStatusRoutes(continuous), {
      prefix: "/api/v1",
    });
    protectedApi.register(
      createAutomationOfficeRoutes({
        runtime: continuous,
        operations: lab.operations,
        workGovernanceGate,
        queue: continuous.queue,
      }),
      { prefix: "/api/v1" },
    );
    protectedApi.register(scheduleRuleRoutes, { prefix: "/api/v1" });
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
          gate: workGovernanceGate,
        }),
    }),
    { prefix: "/api/v1/webhooks" },
  );

  return { app, continuous };
}
