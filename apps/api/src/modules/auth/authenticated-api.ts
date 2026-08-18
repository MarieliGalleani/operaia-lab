import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { requireOfficialWorkspaceAccess } from "./official-workspace-access.js";

export function registerAuthenticatedApiHooks(app: FastifyInstance): void {
  app.addHook("preHandler", app.authenticateAdmin);
  app.addHook(
    "preHandler",
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      if (reply.sent || !request.authenticatedAdmin) {
        return;
      }
      const workspaceIds = readWorkspaceIds(request);
      for (const workspaceId of workspaceIds) {
        requireOfficialWorkspaceAccess(
          request.authenticatedAdmin,
          workspaceId,
        );
      }
    },
  );
}

function readWorkspaceIds(request: FastifyRequest): readonly string[] {
  const candidates = [
    readStringProperty(request.params, "workspaceId"),
    readStringProperty(request.query, "workspaceId"),
    readStringProperty(request.body, "workspaceId"),
  ].filter((value): value is string => value !== undefined);
  return [...new Set(candidates)];
}

function readStringProperty(
  input: unknown,
  property: string,
): string | undefined {
  if (!input || typeof input !== "object" || !(property in input)) {
    return undefined;
  }
  const value = (input as Record<string, unknown>)[property];
  return typeof value === "string" ? value : undefined;
}
