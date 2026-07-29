import { Specialization } from "@operaia/employee-framework";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { describe, expect, it } from "vitest";
import {
  createOperationalRuntime,
  NEXO_OPERATIONAL_MISSION,
} from "./operational-composition.js";
import { createOperationsRoutes } from "./operations.routes.js";

describe("Etapa 8 — Operacao Assistida NEXO", () => {
  it("executa missao real controlada e gera resultado utilizavel", async () => {
    const runtime = createOperationalRuntime({ deterministic: true });
    const run = await runtime.service.run({ ...NEXO_OPERATIONAL_MISSION });

    expect(run.workspaceId).toBe("nexo");
    expect(run.workspaceName).toBe("NEXO");
    expect(run.status).toBe("completed");
    expect(run.usableResult.length).toBeGreaterThan(40);
    expect(run.reply.employeeId).toBe("operaia-ceo");
    expect(run.reply.answer.nextActions.length).toBeGreaterThan(0);

    expect(run.mission.initial.output.decision.delegations[0]?.specialization).toBe(
      Specialization.SOFTWARE_ENGINEERING,
    );
    expect(run.mission.outcomes[0]?.employeeId).toBe("cto-mag");
    expect(run.mission.final.employeeId).toBe("operaia-ceo");

    expect(run.llmEvents.filter((e) => e.type === "call_succeeded")).toHaveLength(
      3,
    );
    expect(run.gaps.some((gap) => gap.code === "NARROW_ROSTER")).toBe(true);
    expect(run.gaps.some((gap) => gap.code === "DETERMINISTIC_LLM")).toBe(true);

    expect(runtime.service.get(run.id)?.id).toBe(run.id);
    expect(runtime.service.list()[0]?.id).toBe(run.id);
  });

  it("HTTP POST /operations/missions/nexo registra a missao", async () => {
    const runtime = createOperationalRuntime({ deterministic: true });
    const app = Fastify().withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(createOperationsRoutes(runtime), {
      prefix: "/api/v1/operations",
    });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/operations/missions/nexo",
    });
    expect(response.statusCode).toBe(201);
    const body = response.json() as {
      usableResult: string;
      specialists: { employeeId?: string }[];
      gaps: { code: string }[];
      llmEvents: unknown[];
    };
    expect(body.usableResult).toContain("Resumo");
    expect(body.specialists[0]?.employeeId).toBe("cto-mag");
    expect(body.llmEvents.length).toBeGreaterThanOrEqual(3);
    expect(body.gaps.length).toBeGreaterThan(0);

    const listed = await app.inject({
      method: "GET",
      url: "/api/v1/operations/missions",
    });
    expect(listed.statusCode).toBe(200);
    expect((listed.json() as unknown[]).length).toBe(1);
  });
});
