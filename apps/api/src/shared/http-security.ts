import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";

export const PRODUCTION_WEB_ORIGIN = "https://lab.operaia.com.br";
export const DEVELOPMENT_WEB_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
] as const;

export const GLOBAL_RATE_LIMIT = {
  max: 600,
  timeWindow: "1 minute",
} as const;

export const HEALTH_RATE_LIMIT = {
  max: 120,
  timeWindow: "1 minute",
} as const;

export const WEBHOOK_RATE_LIMIT = {
  max: 300,
  timeWindow: "1 minute",
} as const;

export const SENSITIVE_LOG_REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["x-hub-signature-256"]',
  "req.body.password",
  "password",
  "passwordHash",
  "sessionToken",
] as const;

export function allowedWebOrigins(
  environment: "development" | "test" | "production",
): readonly string[] {
  return environment === "production"
    ? [PRODUCTION_WEB_ORIGIN]
    : DEVELOPMENT_WEB_ORIGINS;
}

export function registerHttpSecurity(
  app: FastifyInstance,
  environment: "development" | "test" | "production",
): void {
  void app.register(cors, {
    origin: [...allowedWebOrigins(environment)],
    credentials: true,
  });
  void app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
  });
  void app.register(rateLimit, {
    global: true,
    ...GLOBAL_RATE_LIMIT,
  });
}
