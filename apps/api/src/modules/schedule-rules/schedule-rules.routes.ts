import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  createScheduleRuleBodySchema,
  deleteScheduleRuleResponseSchema,
  scheduleRuleParamsSchema,
  scheduleRuleSchema,
  updateScheduleRuleBodySchema,
} from "./schedule-rules.schemas.js";
import {
  createScheduleRule,
  deleteScheduleRule,
  listScheduleRules,
  updateScheduleRule,
} from "./schedule-rules.service.js";

/**
 * CRUD do gatilho recorrente (ScheduleRule). O motor de disparo em si
 * ja existe em runtime/mission-scheduler.ts — este modulo so cobre a
 * gestao das regras (o que faltava).
 */
export const scheduleRuleRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/schedule-rules",
    {
      schema: {
        tags: ["schedule-rules"],
        querystring: z.object({ workspaceId: z.string().optional() }),
        response: { 200: z.array(scheduleRuleSchema) },
      },
    },
    async (request) => listScheduleRules(request.query.workspaceId),
  );

  app.post(
    "/schedule-rules",
    {
      schema: {
        tags: ["schedule-rules"],
        body: createScheduleRuleBodySchema,
        response: { 200: scheduleRuleSchema },
      },
    },
    async (request) => createScheduleRule(request.body),
  );

  app.patch(
    "/schedule-rules/:id",
    {
      schema: {
        tags: ["schedule-rules"],
        params: scheduleRuleParamsSchema,
        body: updateScheduleRuleBodySchema,
        response: { 200: scheduleRuleSchema },
      },
    },
    async (request) => updateScheduleRule(request.params.id, request.body),
  );

  app.delete(
    "/schedule-rules/:id",
    {
      schema: {
        tags: ["schedule-rules"],
        params: scheduleRuleParamsSchema,
        response: { 200: deleteScheduleRuleResponseSchema },
      },
    },
    async (request) => {
      await deleteScheduleRule(request.params.id);
      return { deleted: true as const };
    },
  );
};
