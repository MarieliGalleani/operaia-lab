/**
 * POST /api/v1/webhooks/github — ingress GitHub (HMAC + Bridge + Policy).
 */
import type { FastifyPluginAsync } from "fastify";
import type {
  DomainSignalIngestService,
  DomainSignalService,
  GitHubSourceBridge,
} from "@operaia/domain-signals";
import {
  processGithubWebhook,
  type GithubWebhookPipelineDeps,
} from "./github-webhook-pipeline.js";
import { resolveWebhookSecret } from "./secret-resolver.js";

export interface GithubWebhookRouteDeps {
  readonly signals: DomainSignalService;
  readonly bridge: GitHubSourceBridge;
  readonly ingest: DomainSignalIngestService;
  readonly onConvertCandidate?: GithubWebhookPipelineDeps["onConvertCandidate"];
  readonly resolveSecret?: GithubWebhookPipelineDeps["resolveSecret"];
}

type RawBodyRequest = {
  rawBody?: string;
};

export function createGithubWebhookRoutes(
  deps: GithubWebhookRouteDeps,
): FastifyPluginAsync {
  return async (app) => {
    app.addContentTypeParser(
      "application/json",
      { parseAs: "string" },
      (request, body, done) => {
        const raw = typeof body === "string" ? body : String(body);
        (request as typeof request & RawBodyRequest).rawBody = raw;
        try {
          const parsed = JSON.parse(raw) as unknown;
          done(null, parsed);
        } catch (error) {
          done(error as Error, undefined);
        }
      },
    );

    const pipelineDeps: GithubWebhookPipelineDeps = {
      signals: deps.signals,
      bridge: deps.bridge,
      ingest: deps.ingest,
      onConvertCandidate: deps.onConvertCandidate,
      resolveSecret:
        deps.resolveSecret ??
        ((ref) => resolveWebhookSecret(ref)),
    };

    app.post("/github", async (request, reply) => {
      const rawBody =
        (request as typeof request & RawBodyRequest).rawBody ??
        JSON.stringify(request.body ?? {});
      const headers = request.headers;
      const result = await processGithubWebhook(pipelineDeps, {
        rawBody,
        body: request.body,
        headers: {
          signature256: String(headers["x-hub-signature-256"] ?? ""),
          deliveryId: String(headers["x-github-delivery"] ?? ""),
          githubEvent: String(headers["x-github-event"] ?? ""),
        },
      });
      return reply.status(result.httpStatus).send(result);
    });

    app.post("/github/:bindingId", async (request, reply) => {
      const rawBody =
        (request as typeof request & RawBodyRequest).rawBody ??
        JSON.stringify(request.body ?? {});
      const headers = request.headers;
      const params = request.params as { bindingId: string };
      const result = await processGithubWebhook(pipelineDeps, {
        rawBody,
        body: request.body,
        bindingId: params.bindingId,
        headers: {
          signature256: String(headers["x-hub-signature-256"] ?? ""),
          deliveryId: String(headers["x-github-delivery"] ?? ""),
          githubEvent: String(headers["x-github-event"] ?? ""),
        },
      });
      return reply.status(result.httpStatus).send(result);
    });
  };
}
