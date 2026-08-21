import {
  composeLLMObservers,
  ConsoleLLMObserver,
  createLLMStack,
  RecordingLLMObserver,
  type LLMObserver,
  type LLMStackConfig,
} from "@operaia/ai-core";
import type { ActionPolicy } from "@operaia/execution-engine";
import type { MemoryStore } from "@operaia/memory";
import { InMemoryMemoryStore } from "@operaia/workspace-runtime";
import { EmployeesApplication } from "../employees/employees.application.js";
import { createDigitalOffice } from "../employees/office-composition.js";
import { InMemoryWorkspaceSource } from "../employees/in-memory-workspace-source.js";
import { buildTestWorkspaceCatalog } from "../employees/test-workspace-catalog.js";
import type { WorkspaceSource } from "../employees/workspace-source.js";
import type { TaskRepository } from "../tasks/domain/task.repository.js";
import { MissionFallbackLLMObserver } from "../runtime/mission-llm-fallback-observer.js";
import { createMissionExecutionStack } from "./mission-execution.js";
import {
  OperationalMissionService,
  type AssistedMissionQueuePort,
  type OperationalMissionServiceOptions,
} from "./operational-mission-service.js";
import { OperationalRunStore } from "./operational-run-store.js";

/** Peças Operations expostas ao HTTP / CLI. */
export interface OperationalRuntime {
  readonly service: OperationalMissionService;
  readonly observer: RecordingLLMObserver;
  readonly fallbackObserver: MissionFallbackLLMObserver;
  readonly store: OperationalRunStore;
}

/**
 * Runtime unificado da sede (Equipe Digital + Operations).
 * Uma composition → um office → um store → mesma execução de missão.
 */
export interface LabRuntime {
  readonly office: ReturnType<typeof createDigitalOffice>;
  readonly team: EmployeesApplication;
  readonly operations: OperationalRuntime;
  readonly memory: MemoryStore;
  readonly execution: ReturnType<typeof createMissionExecutionStack>;
}

export interface LabRuntimeOptions {
  readonly deterministic?: boolean;
  readonly stack?: Omit<
    LLMStackConfig,
    "observer" | "enableConsoleObservability"
  >;
  readonly workspaces?: WorkspaceSource;
  readonly memoryStore?: MemoryStore;
  readonly actionPolicy?: ActionPolicy;
  readonly taskRepository?: TaskRepository;
  readonly enableConsoleObservability?: boolean;
  /** Unified Mission Gateway — preferQueue via env no product; default false em lab isolado. */
  readonly missionQueue?: AssistedMissionQueuePort;
  readonly preferQueue?: boolean;
  readonly missionWait?: OperationalMissionServiceOptions["wait"];
  readonly workGovernanceGate?: OperationalMissionServiceOptions["workGovernanceGate"];
}

/**
 * Composition compartilhada: Sala da CEO e Operations apontam para a mesma execução.
 * Sem regra de negocio — apenas wiring. Sem import de env (testes seguros).
 */
export function createLabRuntime(
  options: LabRuntimeOptions = {},
): LabRuntime {
  const recordingObserver = new RecordingLLMObserver();
  const fallbackObserver = new MissionFallbackLLMObserver();
  const observers: LLMObserver[] = [
    recordingObserver,
    fallbackObserver,
  ];
  if (options.enableConsoleObservability) {
    observers.push(new ConsoleLLMObserver());
  }
  const observer = composeLLMObservers(...observers);

  const llm = createLLMStack({
    ...(options.deterministic || !options.stack
      ? { provider: "deterministic" as const }
      : options.stack),
    observer,
    enableConsoleObservability: false,
  });

  const workspaces =
    options.workspaces ??
    new InMemoryWorkspaceSource(buildTestWorkspaceCatalog());

  const memory = options.memoryStore ?? new InMemoryMemoryStore();
  const execution = createMissionExecutionStack({
    ...(options.actionPolicy ? { policy: options.actionPolicy } : {}),
    ...(options.taskRepository
      ? { taskRepository: options.taskRepository }
      : {}),
  });
  const store = new OperationalRunStore();
  const office = createDigitalOffice({ llm });
  const service = new OperationalMissionService(
    office,
    workspaces,
    recordingObserver,
    store,
    memory,
    execution,
    {
      ...(options.missionQueue ? { queue: options.missionQueue } : {}),
      preferQueue: options.preferQueue ?? false,
      ...(options.missionWait ? { wait: options.missionWait } : {}),
      ...(options.workGovernanceGate
        ? { workGovernanceGate: options.workGovernanceGate }
        : {}),
    },
  );

  const team = new EmployeesApplication({
    office,
    workspaces,
    missions: service,
  });

  return {
    office,
    team,
    operations: {
      service,
      observer: recordingObserver,
      fallbackObserver,
      store,
    },
    memory,
    execution,
  };
}
