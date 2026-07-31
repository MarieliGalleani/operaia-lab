import { describe, expect, it } from "vitest";
import {
  ActionCapabilityGroup,
  ActionExecutionStatus,
  ActionId,
  ActionPolicy,
  CaddyActionAdapter,
  createActionRuntime,
  DockerActionAdapter,
  InMemoryExecutionLedger,
  MapWorkspaceActionScope,
  MemoryCaddyActionClient,
  MemoryDockerActionClient,
  MemorySystemdActionClient,
  SystemdActionAdapter,
  defaultActionPolicy,
} from "./index.js";

function buildRuntime(input?: {
  readonly docker?: MemoryDockerActionClient;
  readonly systemd?: MemorySystemdActionClient;
  readonly caddy?: MemoryCaddyActionClient;
  readonly scope?: MapWorkspaceActionScope;
  readonly ledger?: InMemoryExecutionLedger;
  readonly seedDefaults?: boolean;
}) {
  const docker = input?.docker ?? new MemoryDockerActionClient();
  const systemd = input?.systemd ?? new MemorySystemdActionClient();
  const caddy = input?.caddy ?? new MemoryCaddyActionClient();
  const ledger = input?.ledger ?? new InMemoryExecutionLedger();
  const seedDefaults = input?.seedDefaults ?? true;

  if (seedDefaults) {
    docker.seedStatus("operaia-lab", {
      name: "api",
      state: "running",
      health: "healthy",
    });
    docker.seedLogs("operaia-lab", "api", [
      { timestamp: "2026-07-31T12:00:00.000Z", message: "boot" },
      { timestamp: "2026-07-31T12:01:00.000Z", message: "ready" },
    ]);
    systemd.seed("operaia-lab", {
      unit: "operaia-lab-api.service",
      activeState: "active",
      subState: "running",
      loadState: "loaded",
    });
    caddy.seed("operaia-lab", {
      path: "infra/caddy/Caddyfile",
      valid: true,
      messages: [],
    });
  }
  const runtime = createActionRuntime({
    ledger,
    scope:
      input?.scope ??
      new MapWorkspaceActionScope({
        "operaia-lab": ["api", "operaia-lab-api.service", "infra/caddy/Caddyfile"],
        nexo: ["nexo-api"],
      }),
    adapters: [
      new DockerActionAdapter(docker),
      new SystemdActionAdapter(systemd),
      new CaddyActionAdapter(caddy),
    ],
  });

  return { runtime, docker, systemd, caddy, ledger };
}

describe("ActionPolicy", () => {
  const policy = defaultActionPolicy;

  it("permite Atlas docker.status", () => {
    const decision = policy.decide({
      employeeId: "atlas",
      actionId: ActionId.dockerStatus,
      workspaceId: "operaia-lab",
    });
    expect(decision.allowed).toBe(true);
    expect(policy.isAllowed("atlas", ActionId.dockerRestart)).toBe(true);
    expect(policy.isAllowed("atlas", ActionId.caddyValidate)).toBe(true);
    expect(policy.isAllowed("atlas", ActionId.systemdStatus)).toBe(true);
  });

  it("bloqueia Mag docker.restart", () => {
    const decision = policy.decide({
      employeeId: "cto-mag",
      actionId: ActionId.dockerRestart,
      workspaceId: "operaia-lab",
    });
    expect(decision.allowed).toBe(false);
    expect(policy.isAllowed("cto-mag", ActionId.dockerStatus)).toBe(false);
    expect(policy.isAllowed("luna", ActionId.dockerLogs)).toBe(false);
    expect(policy.isAllowed("mercurio", ActionId.systemdStatus)).toBe(false);
    expect(policy.isAllowed("themis", ActionId.caddyValidate)).toBe(false);
  });

  it("Orion: docker.logs + systemd.status; sem restart", () => {
    expect(policy.isAllowed("orion", ActionId.dockerLogs)).toBe(true);
    expect(policy.isAllowed("orion", ActionId.systemdStatus)).toBe(true);
    expect(policy.isAllowed("orion", ActionId.dockerRestart)).toBe(false);
    expect(policy.isAllowed("orion", ActionId.dockerStatus)).toBe(false);
  });

  it("acao desconhecida retorna DENIED na policy", () => {
    const decision = policy.decide({
      employeeId: "atlas",
      actionId: "shell.run",
      workspaceId: "operaia-lab",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("desconhecida");
  });
});

describe("ActionRuntime", () => {
  it("adapter mock executa docker.status corretamente", async () => {
    const { runtime } = buildRuntime();
    const result = await runtime.execute({
      workspaceId: "operaia-lab",
      requestedBy: "atlas",
      actionId: ActionId.dockerStatus,
      target: "api",
    });
    expect(result.success).toBe(true);
    expect(result.actionId).toBe(ActionId.dockerStatus);
    expect(result.output).toEqual({
      name: "api",
      state: "running",
      health: "healthy",
    });
    expect(result.metadata.status).toBe(ActionExecutionStatus.SUCCESS);
  });

  it("policy bloqueia Mag docker.restart via runtime", async () => {
    const { runtime, docker, ledger } = buildRuntime();
    const result = await runtime.execute({
      workspaceId: "operaia-lab",
      requestedBy: "cto-mag",
      actionId: ActionId.dockerRestart,
      target: "api",
    });
    expect(result.success).toBe(false);
    expect(result.metadata.status).toBe(ActionExecutionStatus.DENIED);
    expect(docker.restartCalls).toHaveLength(0);

    const records = await ledger.listByWorkspace("operaia-lab");
    expect(records).toHaveLength(1);
    expect(records[0]?.status).toBe(ActionExecutionStatus.DENIED);
  });

  it("acao desconhecida retorna DENIED", async () => {
    const { runtime, ledger } = buildRuntime();
    const result = await runtime.execute({
      workspaceId: "operaia-lab",
      requestedBy: "atlas",
      actionId: "docker.exec",
      target: "api",
    });
    expect(result.success).toBe(false);
    expect(result.metadata.status).toBe(ActionExecutionStatus.DENIED);
    const record = await ledger.getById(result.metadata.executionId!);
    expect(record?.status).toBe(ActionExecutionStatus.DENIED);
  });

  it("workspace isolation: target de outro workspace e DENIED", async () => {
    const { runtime } = buildRuntime();
    const result = await runtime.execute({
      workspaceId: "operaia-lab",
      requestedBy: "atlas",
      actionId: ActionId.dockerRestart,
      target: "nexo-api",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("fora do workspace");
    expect(result.metadata.status).toBe(ActionExecutionStatus.DENIED);
  });

  it("ledger registra sucesso", async () => {
    const ledger = new InMemoryExecutionLedger();
    const { runtime } = buildRuntime({ ledger });
    const result = await runtime.execute({
      workspaceId: "operaia-lab",
      requestedBy: "atlas",
      actionId: ActionId.caddyValidate,
      target: "infra/caddy/Caddyfile",
    });
    expect(result.success).toBe(true);
    const record = await ledger.getById(result.metadata.executionId!);
    expect(record?.status).toBe(ActionExecutionStatus.SUCCESS);
    expect(record?.employeeId).toBe("atlas");
    expect(record?.actionId).toBe(ActionId.caddyValidate);
    expect(record?.finishedAt).toBeTruthy();
    expect(record?.error).toBeNull();
  });

  it("ledger registra falha do adapter", async () => {
    const docker = new MemoryDockerActionClient();
    const ledger = new InMemoryExecutionLedger();
    const { runtime } = buildRuntime({ docker, ledger, seedDefaults: false });
    const result = await runtime.execute({
      workspaceId: "operaia-lab",
      requestedBy: "atlas",
      actionId: ActionId.dockerStatus,
      target: "api",
    });
    expect(result.success).toBe(false);
    expect(result.metadata.status).toBe(ActionExecutionStatus.FAILED);
    const record = await ledger.getById(result.metadata.executionId!);
    expect(record?.status).toBe(ActionExecutionStatus.FAILED);
    expect(record?.error).toContain("nao encontrado");
  });

  it("Orion pode docker.logs; Atlas pode systemd.status", async () => {
    const { runtime } = buildRuntime();
    const logs = await runtime.execute({
      workspaceId: "operaia-lab",
      requestedBy: "orion",
      actionId: ActionId.dockerLogs,
      target: "api",
      parameters: { limit: 10 },
    });
    expect(logs.success).toBe(true);

    const unit = await runtime.execute({
      workspaceId: "operaia-lab",
      requestedBy: "atlas",
      actionId: ActionId.systemdStatus,
      target: "operaia-lab-api.service",
    });
    expect(unit.success).toBe(true);
  });

  it("politica customizada sobrescreve matriz", () => {
    const policy = new ActionPolicy({
      employeeGroups: {
        luna: [ActionCapabilityGroup.DockerLogs],
      },
    });
    expect(policy.isAllowed("luna", ActionId.dockerLogs)).toBe(true);
    expect(policy.isAllowed("luna", ActionId.dockerRestart)).toBe(false);
  });
});
