import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { AutomationOfficeDeps } from "./automation-office.types.js";
import {
  approveApproval,
  getApprovalById,
  listApprovals,
  modifyApproval,
  rejectApproval,
} from "./approval.service.js";
import {
  approvalActionResponseSchema,
  approvalDetailSchema,
  approvalListItemSchema,
  automationDetailSchema,
  automationListItemSchema,
  commandCenterResponseSchema,
  decisionTraceSchema,
  executeDemandBodySchema,
  executeDemandResponseSchema,
  executionDetailSchema,
  executionListItemSchema,
  interpretDemandBodySchema,
  interpretDemandResponseSchema,
  officeUnavailableSchema,
  workspaceContextSchema,
} from "./automation-office.schemas.js";
import { getAutomationById, listAutomations } from "./automation.service.js";
import { buildCommandCenter } from "./command-center.service.js";
import { getDecisionById, listDecisions } from "./decision-trace.service.js";
import { executeDemand, interpretDemand } from "./demand.service.js";
import {
  getExecutionById,
  listExecutions,
} from "./execution-projection.service.js";
import { getWorkspaceContext } from "./workspace-context.service.js";

export function createAutomationOfficeRoutes(
  deps: AutomationOfficeDeps,
): FastifyPluginAsyncZod {
  return async (app) => {
    app.get(
      "/office/command",
      {
        schema: {
          tags: ["automation-office"],
          response: {
            200: commandCenterResponseSchema,
            503: officeUnavailableSchema,
          },
        },
      },
      async () => {
        const body = await buildCommandCenter(deps.runtime);
        return JSON.parse(JSON.stringify(body));
      },
    );

    app.post(
      "/office/demands",
      {
        schema: {
          tags: ["automation-office"],
          body: interpretDemandBodySchema,
          response: { 200: interpretDemandResponseSchema },
        },
      },
      async (request) => {
        const result = await interpretDemand({
          text: request.body.text,
          workspaceId: request.body.workspaceId,
        });
        return JSON.parse(JSON.stringify(result));
      },
    );

    app.post(
      "/office/demands/:id/execute",
      {
        schema: {
          tags: ["automation-office"],
          params: z.object({ id: z.string().min(1) }),
          body: executeDemandBodySchema,
          response: { 200: executeDemandResponseSchema },
        },
      },
      async (request) =>
        executeDemand(deps, {
          demandId: request.params.id,
          autonomy: request.body.autonomy,
        }),
    );

    app.get(
      "/office/approvals",
      {
        schema: {
          tags: ["automation-office"],
          querystring: z.object({ workspaceId: z.string().optional() }),
          response: { 200: z.array(approvalListItemSchema) },
        },
      },
      async (request) => listApprovals(request.query.workspaceId),
    );

    app.get(
      "/office/approvals/:id",
      {
        schema: {
          tags: ["automation-office"],
          params: z.object({ id: z.string().min(1) }),
          response: { 200: approvalDetailSchema },
        },
      },
      async (request) => getApprovalById(request.params.id),
    );

    app.post(
      "/office/approvals/:id/approve",
      {
        schema: {
          tags: ["automation-office"],
          params: z.object({ id: z.string().min(1) }),
          body: z.object({}).optional(),
          response: { 200: approvalActionResponseSchema },
        },
      },
      async (request) =>
        approveApproval(
          request.params.id,
          request.authenticatedAdmin!.login,
        ),
    );

    app.post(
      "/office/approvals/:id/reject",
      {
        schema: {
          tags: ["automation-office"],
          params: z.object({ id: z.string().min(1) }),
          body: z.object({}).optional(),
          response: { 200: approvalActionResponseSchema },
        },
      },
      async (request) =>
        rejectApproval(
          request.params.id,
          request.authenticatedAdmin!.login,
        ),
    );

    app.post(
      "/office/approvals/:id/modify",
      {
        schema: {
          tags: ["automation-office"],
          params: z.object({ id: z.string().min(1) }),
          body: z.object({}).optional(),
          response: { 200: approvalActionResponseSchema },
        },
      },
      async (request) =>
        modifyApproval(
          request.params.id,
          request.authenticatedAdmin!.login,
        ),
    );

    app.get(
      "/office/decisions",
      {
        schema: {
          tags: ["automation-office"],
          querystring: z.object({ workspaceId: z.string().optional() }),
          response: { 200: z.array(decisionTraceSchema) },
        },
      },
      async (request) => listDecisions(request.query.workspaceId),
    );

    app.get(
      "/office/decisions/:id",
      {
        schema: {
          tags: ["automation-office"],
          params: z.object({ id: z.string().min(1) }),
          response: { 200: decisionTraceSchema },
        },
      },
      async (request) => getDecisionById(request.params.id),
    );

    app.get(
      "/office/automations",
      {
        schema: {
          tags: ["automation-office"],
          querystring: z.object({ workspaceId: z.string().optional() }),
          response: { 200: z.array(automationListItemSchema) },
        },
      },
      async (request) => listAutomations(request.query.workspaceId),
    );

    app.get(
      "/office/automations/:id",
      {
        schema: {
          tags: ["automation-office"],
          params: z.object({ id: z.string().min(1) }),
          response: { 200: automationDetailSchema },
        },
      },
      async (request) => getAutomationById(request.params.id),
    );

    app.get(
      "/office/executions",
      {
        schema: {
          tags: ["automation-office"],
          querystring: z.object({ workspaceId: z.string().optional() }),
          response: { 200: z.array(executionListItemSchema) },
        },
      },
      async (request) => listExecutions(request.query.workspaceId),
    );

    app.get(
      "/office/executions/:id",
      {
        schema: {
          tags: ["automation-office"],
          params: z.object({ id: z.string().min(1) }),
          response: { 200: executionDetailSchema },
        },
      },
      async (request) => getExecutionById(request.params.id),
    );

    app.get(
      "/office/workspaces/:id/context",
      {
        schema: {
          tags: ["automation-office"],
          params: z.object({ id: z.string().min(1) }),
          response: { 200: workspaceContextSchema },
        },
      },
      async (request) => getWorkspaceContext(request.params.id),
    );
  };
}
