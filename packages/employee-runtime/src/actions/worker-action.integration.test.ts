/**
 * Sprint A.5 — Worker + ActionRuntime (via EmployeeRunner / briefing).
 * Employee nunca acessa adapters; so requestAction.
 */
import { describe, expect, it } from "vitest";
import { Specialization } from "@operaia/employee-framework";
import {
  ActionExecutionStatus,
  ActionId,
  CaddyActionAdapter,
  createActionRuntime,
  DockerActionAdapter,
  InMemoryExecutionLedger,
  MapWorkspaceActionScope,
  MemoryCaddyActionClient,
  MemoryDockerActionClient,
  MemorySystemdActionClient,
  SystemdActionAdapter,
} from "@operaia/action-runtime";
import {
  BRIEFING_ACTION_CAPABILITY_KEY,
  buildActionsForEmployee,
  createEmployeeActionsFactory,
  EmployeeRunner,
  getActionCapabilityFromBriefing,
  isActionCapableEmployee,
} from "../index.js";

const workspace = {
  workspaceId: "operaia-lab",
  name: "OperaIA.lab",
  objective: "Operar infra",
  tasks: [] as const,
};

function createTestActionRuntime(ledger = new InMemoryExecutionLedger()) {
  const docker = new MemoryDockerActionClient();
  const systemd = new MemorySystemdActionClient();
  const caddy = new MemoryCaddyActionClient();

  docker.seedStatus("operaia-lab", {
    name: "api",
    state: "running",
    health: "healthy",
  });
  docker.seedLogs("operaia-lab", "api", [
    { timestamp: "2026-07-31T18:00:00.000Z", message: "ok" },
  ]);
  systemd.seed("operaia-lab", {
    unit: "operaia-lab-api.service",
    activeState: "active",
    subState: "running",
    loadState: "loaded",
  });

  const runtime = createActionRuntime({
    ledger,
    scope: new MapWorkspaceActionScope({
      "operaia-lab": ["api", "operaia-lab-api.service", "infra/caddy/Caddyfile"],
      nexo: ["nexo-api"],
    }),
    adapters: [
      new DockerActionAdapter(docker),
      new SystemdActionAdapter(systemd),
      new CaddyActionAdapter(caddy),
    ],
  });

  return { runtime, docker, ledger };
}

function okOutput(summary: string) {
  return {
    decision: {
      analyzed: summary,
      decision: summary,
      reasoning: summary,
      recommendations: [],
      delegations: [],
      risks: [],
      nextActions: [],
    },
    report: {
      summary,
      analysis: summary,
      plan: [],
      recommendations: [],
      risks: [],
      nextActions: [],
    },
    quality: { passed: true, issues: [] },
  };
}

describe("Worker × ActionRuntime (A.5)", () => {
  it("mission gera action request autorizada (Atlas docker.status)", async () => {
    const { runtime, ledger } = createTestActionRuntime();
    const actions = buildActionsForEmployee("atlas", "operaia-lab", runtime);
    expect(actions).not.toBeNull();

    const runner = new EmployeeRunner();
    const employee = {
      profile: {
        id: "atlas",
        name: "Atlas",
        role: "Automation",
        specialization: Specialization.AUTOMATION,
        responsibilities: [],
        limits: [],
        qualityRules: [],
      },
      async work({ briefing }: { briefing: { additional: Record<string, unknown> } }) {
        const capability = getActionCapabilityFromBriefing(briefing as never);
        expect(capability).not.toBeNull();
        expect(briefing.additional[BRIEFING_ACTION_CAPABILITY_KEY]).toBe(
          capability,
        );

        const result = await capability!.requestAction({
          actionId: ActionId.dockerStatus,
          target: "api",
        });
        expect(result.success).toBe(true);
        expect(result.metadata.status).toBe(ActionExecutionStatus.SUCCESS);

        return okOutput(`status=${(result.output as { state: string }).state}`);
      },
    };

    const missionResult = await runner.run(employee as never, {
      workspace: workspace as never,
      objective: "Checar status do container api",
      actions,
    });

    expect(missionResult.output.report.summary).toContain("running");
    const records = await ledger.findByWorkspace("operaia-lab");
    expect(records).toHaveLength(1);
    expect(records[0]?.employeeId).toBe("atlas");
    expect(records[0]?.actionId).toBe(ActionId.dockerStatus);
    expect(records[0]?.status).toBe(ActionExecutionStatus.SUCCESS);
  });

  it("policy permite Orion docker.logs; bloqueia docker.restart", async () => {
    const { runtime, docker, ledger } = createTestActionRuntime();
    const actions = buildActionsForEmployee("orion", "operaia-lab", runtime)!;

    const runner = new EmployeeRunner();
    const employee = {
      profile: {
        id: "orion",
        name: "Orion",
        role: "Ops",
        specialization: Specialization.OPERATIONS,
        responsibilities: [],
        limits: [],
        qualityRules: [],
      },
      async work({ briefing }: { briefing: unknown }) {
        const capability = getActionCapabilityFromBriefing(briefing as never)!;
        const logs = await capability.requestAction({
          actionId: ActionId.dockerLogs,
          target: "api",
        });
        expect(logs.success).toBe(true);

        const denied = await capability.requestAction({
          actionId: ActionId.dockerRestart,
          target: "api",
        });
        expect(denied.success).toBe(false);
        expect(denied.metadata.status).toBe(ActionExecutionStatus.DENIED);
        expect(docker.restartCalls).toHaveLength(0);

        return okOutput("orion-ok");
      },
    };

    await runner.run(employee as never, {
      workspace: workspace as never,
      objective: "Ler logs",
      actions,
    });

    const records = await ledger.listByWorkspace("operaia-lab");
    expect(records.some((r) => r.status === ActionExecutionStatus.SUCCESS)).toBe(
      true,
    );
    expect(records.some((r) => r.status === ActionExecutionStatus.DENIED)).toBe(
      true,
    );
  });

  it("policy bloqueia Mag — factory nao integra Mag/Luna/Mercurio/Themis", async () => {
    const { runtime } = createTestActionRuntime();
    const factory = createEmployeeActionsFactory(runtime);

    expect(await factory("cto-mag", "operaia-lab")).toBeNull();
    expect(await factory("luna", "operaia-lab")).toBeNull();
    expect(await factory("mercurio", "operaia-lab")).toBeNull();
    expect(await factory("themis", "operaia-lab")).toBeNull();
    expect(isActionCapableEmployee("atlas")).toBe(true);
    expect(isActionCapableEmployee("orion")).toBe(true);

    const runner = new EmployeeRunner();
    const mag = {
      profile: {
        id: "cto-mag",
        name: "Mag",
        role: "CTO",
        specialization: Specialization.SOFTWARE_ENGINEERING,
        responsibilities: [],
        limits: [],
        qualityRules: [],
      },
      async work({ briefing }: { briefing: unknown }) {
        expect(getActionCapabilityFromBriefing(briefing as never)).toBeNull();
        return okOutput("mag-no-actions");
      },
    };

    await runner.run(mag as never, {
      workspace: workspace as never,
      objective: "Sem acoes",
      actions: null,
    });
  });

  it("falha do adapter retorna erro controlado e ledger FAILED", async () => {
    const ledger = new InMemoryExecutionLedger();
    const docker = new MemoryDockerActionClient();
    // sem seed → falha
    const runtime = createActionRuntime({
      ledger,
      scope: new MapWorkspaceActionScope({
        "operaia-lab": ["api"],
      }),
      adapters: [new DockerActionAdapter(docker)],
    });
    const actions = buildActionsForEmployee("atlas", "operaia-lab", runtime)!;

    const runner = new EmployeeRunner();
    const employee = {
      profile: {
        id: "atlas",
        name: "Atlas",
        role: "Automation",
        specialization: Specialization.AUTOMATION,
        responsibilities: [],
        limits: [],
        qualityRules: [],
      },
      async work({ briefing }: { briefing: unknown }) {
        const capability = getActionCapabilityFromBriefing(briefing as never)!;
        const result = await capability.requestAction({
          actionId: ActionId.dockerStatus,
          target: "api",
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain("nao encontrado");
        expect(result.metadata.status).toBe(ActionExecutionStatus.FAILED);
        return okOutput("failed-controlled");
      },
    };

    await runner.run(employee as never, {
      workspace: workspace as never,
      objective: "Status ausente",
      actions,
    });

    const records = await ledger.findByWorkspace("operaia-lab");
    expect(records[0]?.status).toBe(ActionExecutionStatus.FAILED);
  });

  it("workspace isolation mantido (target de outro workspace DENIED)", async () => {
    const { runtime, ledger } = createTestActionRuntime();
    const actions = buildActionsForEmployee("atlas", "operaia-lab", runtime)!;

    const runner = new EmployeeRunner();
    const employee = {
      profile: {
        id: "atlas",
        name: "Atlas",
        role: "Automation",
        specialization: Specialization.AUTOMATION,
        responsibilities: [],
        limits: [],
        qualityRules: [],
      },
      async work({ briefing }: { briefing: unknown }) {
        const capability = getActionCapabilityFromBriefing(briefing as never)!;
        expect(capability.workspaceId).toBe("operaia-lab");
        const result = await capability.requestAction({
          actionId: ActionId.dockerRestart,
          target: "nexo-api",
        });
        expect(result.success).toBe(false);
        expect(result.metadata.status).toBe(ActionExecutionStatus.DENIED);
        expect(result.error).toContain("fora do workspace");
        return okOutput("isolated");
      },
    };

    await runner.run(employee as never, {
      workspace: workspace as never,
      objective: "Nao cruzar workspace",
      actions,
    });

    const records = await ledger.findByWorkspace("operaia-lab");
    expect(records[0]?.status).toBe(ActionExecutionStatus.DENIED);
  });
});
