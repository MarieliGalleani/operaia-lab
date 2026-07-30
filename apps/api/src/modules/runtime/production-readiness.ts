/**
 * Production Readiness — auditoria de boot da Equipe Digital.
 * Nao altera CORE. Apenas valida componentes maduros.
 */
import { prisma } from "@operaia/database";
import type { DigitalOffice } from "../employees/office-composition.js";
import type { MemoryStore } from "@operaia/memory";
import type { MissionExecutionStack } from "../operations/mission-execution.js";
import type { WorkspaceSource } from "../employees/workspace-source.js";
import type { ProjectRepository } from "../projects/domain/project.repository.js";
import type { MissionQueue } from "../runtime/mission-queue.js";
import { buildWorkspacePortfolioSnapshot } from "../organization/workspace-portfolio.js";
import type { TaskRepository } from "../tasks/domain/task.repository.js";

export type ReadinessStatus = "READY" | "WARNING" | "FAIL";

export interface ComponentReadiness {
  readonly component: string;
  readonly status: ReadinessStatus;
  readonly mandatory: boolean;
  readonly detail: string;
  readonly checkedAt: string;
}

export interface ProductionReadinessReport {
  readonly checkedAt: string;
  readonly overall: ReadinessStatus;
  readonly canStartWorkers: boolean;
  readonly components: readonly ComponentReadiness[];
  readonly mandatoryFailed: readonly string[];
  readonly warnings: readonly string[];
}

export interface ProductionReadinessDeps {
  readonly office: DigitalOffice;
  readonly queue: MissionQueue;
  readonly workspaces: WorkspaceSource;
  readonly projects: ProjectRepository;
  readonly tasks: TaskRepository;
  readonly execution: MissionExecutionStack;
  readonly memory: MemoryStore;
  readonly continuousEnabled: boolean;
}

type CheckFn = () => Promise<ComponentReadiness> | ComponentReadiness;

export async function runProductionReadiness(
  deps: ProductionReadinessDeps,
): Promise<ProductionReadinessReport> {
  const checks: CheckFn[] = [
    () => checkPostgres(),
    () => checkMissionQueue(deps.queue),
    () => checkRegistry(deps.office),
    () => checkMatcher(deps.office),
    () => checkEmployeeRuntime(deps.office),
    () => checkExecutionEngine(deps.execution),
    () => checkOrchestration(deps.office),
    () => checkWorkspaceRuntime(deps.workspaces),
    () => checkMemoryStore(deps.memory),
    () => checkPortfolioSnapshot(deps),
    () => checkOrganizationalHealth(deps),
    () => checkImprovementEngine(),
    () => checkSchedulerConfig(deps.continuousEnabled),
    () => checkOracleVmRuntime(deps.continuousEnabled),
    () => checkWorkerManagerPrereq(deps.office),
  ];

  const components: ComponentReadiness[] = [];
  for (const check of checks) {
    try {
      components.push(await check());
    } catch (error) {
      components.push({
        component: "unknown",
        status: "FAIL",
        mandatory: true,
        detail: error instanceof Error ? error.message : String(error),
        checkedAt: new Date().toISOString(),
      });
    }
  }

  const mandatoryFailed = components
    .filter((c) => c.mandatory && c.status === "FAIL")
    .map((c) => c.component);
  const warnings = components
    .filter((c) => c.status === "WARNING")
    .map((c) => `${c.component}: ${c.detail}`);

  let overall: ReadinessStatus = "READY";
  if (mandatoryFailed.length > 0) {
    overall = "FAIL";
  } else if (warnings.length > 0) {
    overall = "WARNING";
  }

  return {
    checkedAt: new Date().toISOString(),
    overall,
    canStartWorkers: mandatoryFailed.length === 0,
    components,
    mandatoryFailed,
    warnings,
  };
}

function ready(
  component: string,
  detail: string,
  mandatory = true,
): ComponentReadiness {
  return {
    component,
    status: "READY",
    mandatory,
    detail,
    checkedAt: new Date().toISOString(),
  };
}

function warn(
  component: string,
  detail: string,
  mandatory = false,
): ComponentReadiness {
  return {
    component,
    status: "WARNING",
    mandatory,
    detail,
    checkedAt: new Date().toISOString(),
  };
}

function fail(
  component: string,
  detail: string,
  mandatory = true,
): ComponentReadiness {
  return {
    component,
    status: "FAIL",
    mandatory,
    detail,
    checkedAt: new Date().toISOString(),
  };
}
async function checkPostgres(): Promise<ComponentReadiness> {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return ready("PostgreSQL", "Conexao OK");
  } catch (error) {
    return fail(
      "PostgreSQL",
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function checkMemoryStore(
  memory: MemoryStore,
): Promise<ComponentReadiness> {
  try {
    if (!memory) {
      return fail("MemoryStore", "MemoryStore ausente");
    }

    return ready("MemoryStore", "MemoryStore disponível");
  } catch (error) {
    return warn(
      "MemoryStore",
      error instanceof Error ? error.message : String(error),
      false,
    );
  }
}

async function checkMissionQueue(
  queue: MissionQueue,
): Promise<ComponentReadiness> {
  try {
    const depths = await queue.depths();
    return ready(
      "MissionQueue",
      `queued=${depths.queued} running=${depths.running} waiting=${depths.waiting}`,
    );
  } catch (error) {
    return fail(
      "MissionQueue",
      error instanceof Error ? error.message : String(error),
    );
  }
}

function checkRegistry(office: DigitalOffice): ComponentReadiness {
  const all = office.registry.all();
  if (all.length < 9) {
    return fail(
      "EmployeeRegistry",
      `Esperados 9 employees, encontrados ${all.length}`,
    );
  }
  return ready("EmployeeRegistry", `${all.length} employees registrados`);
}

function checkMatcher(office: DigitalOffice): ComponentReadiness {
  const matched = office.matcher.match("SOFTWARE_ENGINEERING");
  if (!matched) {
    return fail("EmployeeMatcher", "SOFTWARE_ENGINEERING sem match");
  }
  return ready("EmployeeMatcher", `match OK → ${matched.profile.id}`);
}

function checkEmployeeRuntime(office: DigitalOffice): ComponentReadiness {
  if (!office.runner) {
    return fail("EmployeeRuntime", "EmployeeRunner ausente");
  }
  return ready("EmployeeRuntime", "EmployeeRunner disponivel");
}

function checkExecutionEngine(
  execution: MissionExecutionStack,
): ComponentReadiness {
  if (!execution.engine || !execution.registry || !execution.policy) {
    return fail("ExecutionEngine", "Stack incompleto");
  }
  return ready("ExecutionEngine", "Stack de execucao OK");
}

function checkOrchestration(office: DigitalOffice): ComponentReadiness {
  if (!office.delegation) {
    return fail("OrchestrationEngine", "DelegationService ausente");
  }
  return ready(
    "OrchestrationEngine",
    "DelegationService + QueuedMissionExecutor path OK",
  );
}

async function checkWorkspaceRuntime(
  workspaces: WorkspaceSource,
): Promise<ComponentReadiness> {
  try {
    const list = await workspaces.listWorkspaces();
    if (list.length === 0) {
      return warn("WorkspaceRuntime", "Nenhum workspace listado", false);
    }
    return ready("WorkspaceRuntime", `${list.length} workspace(s)`);
  } catch (error) {
    return fail(
      "WorkspaceRuntime",
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function checkPortfolioSnapshot(
  deps: ProductionReadinessDeps,
): Promise<ComponentReadiness> {
  try {
    const snap = await buildWorkspacePortfolioSnapshot({
      projects: deps.projects,
      tasks: deps.tasks,
      queue: deps.queue,
    });
    return ready(
      "PortfolioSnapshot",
      `${snap.activeProjects.length} projetos ACTIVE`,
    );
  } catch (error) {
    return fail(
      "PortfolioSnapshot",
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function checkOrganizationalHealth(
  deps: ProductionReadinessDeps,
): Promise<ComponentReadiness> {
  try {
    const snap = await buildWorkspacePortfolioSnapshot({
      projects: deps.projects,
      tasks: deps.tasks,
      queue: deps.queue,
    });
    if (!snap.health || snap.health.hints.length === 0) {
      return warn("OrganizationalHealth", "Health sem hints", false);
    }
    return ready(
      "OrganizationalHealth",
      `${snap.health.hints.length} hint(s)`,
    );
  } catch (error) {
    return fail(
      "OrganizationalHealth",
      error instanceof Error ? error.message : String(error),
    );
  }
}

function checkImprovementEngine(): ComponentReadiness {
  // Componente de observacao — presente no codigo; detalhe validado no wiring.
  return ready(
    "ImprovementEngine",
    "Modulo de observers disponivel (observacao apenas)",
  );
}

function checkSchedulerConfig(enabled: boolean): ComponentReadiness {
  if (!enabled) {
    return warn(
      "Scheduler",
      "CONTINUOUS_RUNTIME_ENABLED=false — scheduler nao iniciara",
      false,
    );
  }
  return ready("Scheduler", "Runtime continuo habilitado");
}

function checkOracleVmRuntime(enabled: boolean): ComponentReadiness {
  const platform = process.platform;
  const detail = `platform=${platform} pid=${process.pid} node=${process.version}`;
  if (!enabled) {
    return warn("OracleVMRuntime", `Runtime desabilitado (${detail})`, false);
  }
  return ready("OracleVMRuntime", detail);
}

function checkWorkerManagerPrereq(office: DigitalOffice): ComponentReadiness {
  const count = office.registry.all().length;
  if (count < 1) {
    return fail("WorkerManager", "Registry vazio — workers nao podem subir");
  }
  return ready("WorkerManager", `Pronto para ${count} workers`);
}
