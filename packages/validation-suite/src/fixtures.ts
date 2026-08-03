/**
 * Fixtures compartilhadas — Action Runtime com adapters em memoria.
 * Nao altera o produto; apenas monta harness de validacao.
 */
import {
  ActionExecutionStatus,
  CaddyActionAdapter,
  createActionRuntime,
  DockerActionAdapter,
  InMemoryExecutionLedger,
  MapWorkspaceActionScope,
  MemoryCaddyActionClient,
  MemoryDockerActionClient,
  MemorySystemdActionClient,
  SystemdActionAdapter,
  type ActionExecutionRecord,
  type ActionRuntime,
  type CompleteExecutionInput,
  type CreateExecutionInput,
  type ExecutionLedger,
  type ExecutionStatusPatch,
} from "@operaia/action-runtime";
import type { EmployeeBriefing } from "@operaia/employee-framework";
import type { CeoReview, PrioritizedTask } from "@operaia/agents";

export interface ActionHarness {
  readonly runtime: ActionRuntime;
  readonly ledger: InMemoryExecutionLedger;
  readonly docker: MemoryDockerActionClient;
  readonly systemd: MemorySystemdActionClient;
  readonly caddy: MemoryCaddyActionClient;
  readonly scope: MapWorkspaceActionScope;
}

export function createActionHarness(input?: {
  readonly seedDefaults?: boolean;
  readonly ledger?: InMemoryExecutionLedger;
  readonly scope?: MapWorkspaceActionScope;
  readonly docker?: MemoryDockerActionClient;
}): ActionHarness {
  const docker = input?.docker ?? new MemoryDockerActionClient();
  const systemd = new MemorySystemdActionClient();
  const caddy = new MemoryCaddyActionClient();
  const ledger = input?.ledger ?? new InMemoryExecutionLedger();
  const scope =
    input?.scope ??
    new MapWorkspaceActionScope({
      "workspace-a": ["svc-a", "workspace-a.service"],
      "workspace-b": ["svc-b", "workspace-b.service"],
      nexo: ["nexo-api"],
      "operaia-lab": ["api", "operaia-lab-api.service", "infra/caddy/Caddyfile"],
    });

  if (input?.seedDefaults !== false) {
    docker.seedStatus("operaia-lab", {
      name: "api",
      state: "running",
      health: "healthy",
    });
    docker.seedStatus("workspace-a", {
      name: "svc-a",
      state: "running",
      health: "healthy",
    });
    docker.seedStatus("workspace-b", {
      name: "svc-b",
      state: "running",
      health: "healthy",
    });
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
    scope,
    adapters: [
      new DockerActionAdapter(docker),
      new SystemdActionAdapter(systemd),
      new CaddyActionAdapter(caddy),
    ],
  });

  return { runtime, ledger, docker, systemd, caddy, scope };
}

/**
 * Ledger que registra historico de status para provar REQUESTED → RUNNING → SUCCESS.
 */
export class StatusTrackingLedger implements ExecutionLedger {
  readonly statusHistory: Array<{
    readonly id: string;
    readonly status: ActionExecutionRecord["status"];
  }> = [];

  constructor(private readonly inner: InMemoryExecutionLedger = new InMemoryExecutionLedger()) {}

  create(input: CreateExecutionInput): Promise<ActionExecutionRecord> {
    return this.createExecution(input);
  }

  async createExecution(
    input: CreateExecutionInput,
  ): Promise<ActionExecutionRecord> {
    const record = await this.inner.createExecution(input);
    this.statusHistory.push({ id: record.id, status: record.status });
    return record;
  }

  updateStatus(
    id: string,
    status: ActionExecutionRecord["status"],
    patch?: ExecutionStatusPatch,
  ): Promise<ActionExecutionRecord> {
    return this.updateExecutionStatus(id, status, patch);
  }

  async updateExecutionStatus(
    id: string,
    status: ActionExecutionRecord["status"],
    patch?: ExecutionStatusPatch,
  ): Promise<ActionExecutionRecord> {
    const record = await this.inner.updateExecutionStatus(id, status, patch);
    this.statusHistory.push({ id, status: record.status });
    return record;
  }

  completeExecution(
    id: string,
    input: CompleteExecutionInput,
  ): Promise<ActionExecutionRecord> {
    return this.inner.completeExecution(id, input).then(async (record) => {
      this.statusHistory.push({ id, status: record.status });
      return record;
    });
  }

  getById(id: string): Promise<ActionExecutionRecord | null> {
    return this.inner.getById(id);
  }

  findByWorkspace(
    workspaceId: string,
  ): Promise<readonly ActionExecutionRecord[]> {
    return this.inner.findByWorkspace(workspaceId);
  }

  findByAction(
    actionId: string,
    options?: { readonly workspaceId?: string },
  ): Promise<readonly ActionExecutionRecord[]> {
    return this.inner.findByAction(actionId, options);
  }

  listByWorkspace(
    workspaceId: string,
  ): Promise<readonly ActionExecutionRecord[]> {
    return this.inner.listByWorkspace(workspaceId);
  }
}

export function sampleBriefing(
  overrides: Partial<EmployeeBriefing> = {},
): EmployeeBriefing {
  return {
    project: "NEXO",
    objective: "objetivo",
    executiveSummary: "Workspace NEXO em operacao no laboratorio.",
    currentState: "1/3 tarefas concluidas",
    pending: ["Implementar autenticacao"],
    tasks: [],
    documentation: [],
    history: [],
    constraints: [],
    successCriteria: [],
    additional: {},
    ...overrides,
  };
}

export function sampleReview(
  overrides: Partial<CeoReview> = {},
): CeoReview {
  return {
    objectiveAchieved: false,
    pendingCount: 1,
    blockedCount: 0,
    needsNewCycle: false,
    findings: ["Pendencia tecnica aberta"],
    ...overrides,
  };
}

export function samplePriorities(): readonly PrioritizedTask[] {
  return [
    {
      taskId: "t1",
      title: "Implementar autenticacao",
      score: 10,
      priority: "HIGH",
      rationale: "bloqueia entrega",
    },
  ];
}

export { ActionExecutionStatus };
