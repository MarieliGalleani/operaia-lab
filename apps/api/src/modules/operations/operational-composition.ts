import {
  createLLMStack,
  RecordingLLMObserver,
  type LLMStackConfig,
} from "@operaia/ai-core";
import { createDigitalOffice } from "../employees/office-composition.js";
import { InMemoryWorkspaceSource } from "../employees/in-memory-workspace-source.js";
import { buildTestWorkspaceCatalog } from "../employees/test-workspace-catalog.js";
import type { WorkspaceSource } from "../employees/workspace-source.js";
import { OperationalMissionService } from "./operational-mission-service.js";
import { OperationalRunStore } from "./operational-run-store.js";

export interface OperationalRuntime {
  readonly service: OperationalMissionService;
  readonly observer: RecordingLLMObserver;
  readonly store: OperationalRunStore;
}

export interface OperationalRuntimeOptions {
  /** Forca Deterministic (testes / ciclo controlado sem rede). */
  readonly deterministic?: boolean;
  /** Config do stack LLM (produto). Ignorado se deterministic=true. */
  readonly stack?: Omit<
    LLMStackConfig,
    "observer" | "enableConsoleObservability"
  >;
  /**
   * Fonte de Workspace. Default = catalogo NEXO em memoria (ciclo controlado).
   * Em producao, injetar RepositoryWorkspaceSource no composition root.
   */
  readonly workspaces?: WorkspaceSource;
}

/**
 * Composition da operacao assistida — reutiliza office + MissionOrchestrator.
 * Sem import Prisma aqui (testes / ops:nexo nao dependem de generate).
 */
export function createOperationalRuntime(
  options: OperationalRuntimeOptions = {},
): OperationalRuntime {
  const observer = new RecordingLLMObserver();

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

  const store = new OperationalRunStore();
  const office = createDigitalOffice({ llm });
  const service = new OperationalMissionService(
    office,
    workspaces,
    observer,
    store,
  );

  return { service, observer, store };
}

/** Missao controlada canonica do primeiro ciclo NEXO. */
export const NEXO_OPERATIONAL_MISSION = {
  workspaceId: "nexo",
  objective:
    "Finalizar desenvolvimento da NEXO: priorizar autenticacao, " +
    "desbloquear sincronizacao offline e reportar proximas acoes executivas.",
} as const;
