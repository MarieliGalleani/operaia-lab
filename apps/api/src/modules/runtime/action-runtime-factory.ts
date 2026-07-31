/**
 * Composition helper A.4 / A.4.1 — Action Runtime.
 * NAO integrado a WorkerManager / MissionQueue / Supervisor / UI.
 *
 * Default: InMemoryExecutionLedger
 * Producao: passar PrismaExecutionLedger(prisma)
 */
import {
  CaddyActionAdapter,
  createActionRuntime,
  DockerActionAdapter,
  InMemoryExecutionLedger,
  MapWorkspaceActionScope,
  MemoryCaddyActionClient,
  MemoryDockerActionClient,
  MemorySystemdActionClient,
  SystemdActionAdapter,
  type ActionRuntime,
  type ExecutionLedger,
  type WorkspaceActionScope,
} from "@operaia/action-runtime";

export interface CreateLabActionRuntimeInput {
  readonly workspaceTargets?: Readonly<Record<string, readonly string[]>>;
  readonly scope?: WorkspaceActionScope;
  /** Default: InMemoryExecutionLedger. Producao: PrismaExecutionLedger. */
  readonly executionLedger?: ExecutionLedger;
}

/**
 * Runtime de acoes controladas com clients em memoria (dev/test).
 * Producao futura injeta clients reais tipados — nunca shell arbitrario.
 */
export function createLabActionRuntime(
  input: CreateLabActionRuntimeInput = {},
): ActionRuntime {
  const docker = new MemoryDockerActionClient();
  const systemd = new MemorySystemdActionClient();
  const caddy = new MemoryCaddyActionClient();
  const ledger = input.executionLedger ?? new InMemoryExecutionLedger();
  const scope =
    input.scope ??
    new MapWorkspaceActionScope(
      input.workspaceTargets ?? {
        "operaia-lab": [
          "api",
          "operaia-lab-api.service",
          "infra/caddy/Caddyfile",
        ],
      },
    );

  return createActionRuntime({
    ledger,
    scope,
    adapters: [
      new DockerActionAdapter(docker),
      new SystemdActionAdapter(systemd),
      new CaddyActionAdapter(caddy),
    ],
  });
}
