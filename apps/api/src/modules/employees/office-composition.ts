import { ceoRegisteredEmployee } from "@operaia/agents";
import type { LLMProvider } from "@operaia/ai-core";
import { magRegisteredEmployee } from "@operaia/cto-mag";
import { EmployeeRegistry } from "@operaia/employee-framework";
import {
  DelegationService,
  EmployeeMatcher,
  EmployeeRunner,
} from "@operaia/employee-runtime";

/**
 * Escritório digital montado na API: registry + camada de ativação.
 *
 * Espelha a composição já validada em
 * `packages/employee-runtime/src/activation-flow.test.ts` (`office()`),
 * agora como Composition Root reutilizável do produto.
 *
 * O LLM é injetado (sem singleton global). Nesta etapa o provider concreto
 * ainda não é escolhido — Etapa 5 da sprint.
 */
export interface DigitalOffice {
  readonly llm: LLMProvider;
  readonly registry: EmployeeRegistry;
  readonly runner: EmployeeRunner;
  readonly matcher: EmployeeMatcher;
  readonly delegation: DelegationService;
}

export interface DigitalOfficeConfig {
  readonly llm: LLMProvider;
}

/**
 * COMPOSITION ROOT da equipe digital (CEO + Mag).
 * Único lugar autorizado na API a registrar funcionários e ligar
 * EmployeeRunner / EmployeeMatcher / DelegationService.
 */
export function createDigitalOffice(
  config: DigitalOfficeConfig,
): DigitalOffice {
  const { llm } = config;

  const registry = new EmployeeRegistry()
    .register(ceoRegisteredEmployee)
    .register(magRegisteredEmployee);

  const runner = new EmployeeRunner();
  const matcher = new EmployeeMatcher(registry);
  const delegation = new DelegationService(matcher, runner, { llm });

  return { llm, registry, runner, matcher, delegation };
}
