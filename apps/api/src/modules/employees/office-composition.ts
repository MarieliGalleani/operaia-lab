import type { LLMProvider } from "@operaia/ai-core";
import { registerDigitalTeam } from "@operaia/digital-team";
import {
  DelegationService,
  EmployeeMatcher,
  EmployeeRunner,
} from "@operaia/employee-runtime";

/**
 * Escritório digital montado na API: registry + camada de ativação.
 *
 * O roster oficial vive em `@operaia/digital-team`. Contratar um novo
 * Employee = pacote + uma entrada no roster — este Composition Root não muda.
 */
export interface DigitalOffice {
  readonly llm: LLMProvider;
  readonly registry: ReturnType<typeof registerDigitalTeam>;
  readonly runner: EmployeeRunner;
  readonly matcher: EmployeeMatcher;
  readonly delegation: DelegationService;
}

export interface DigitalOfficeConfig {
  readonly llm: LLMProvider;
}

/**
 * COMPOSITION ROOT da Equipe Digital.
 * Único lugar autorizado na API a montar o Registry e ligar
 * EmployeeRunner / EmployeeMatcher / DelegationService.
 */
export function createDigitalOffice(
  config: DigitalOfficeConfig,
): DigitalOffice {
  const { llm } = config;

  const registry = registerDigitalTeam();
  const runner = new EmployeeRunner();
  const matcher = new EmployeeMatcher(registry);
  const delegation = new DelegationService(matcher, runner, { llm });

  return { llm, registry, runner, matcher, delegation };
}
