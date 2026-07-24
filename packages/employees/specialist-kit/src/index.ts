import type { LLMProvider } from "@operaia/ai-core";
import {
  EmployeeFactory,
  defineEmployee,
  type Employee,
  type EmployeeBlueprint,
  type EmployeeProfile,
  type RegisteredEmployee,
} from "@operaia/employee-framework";
import {
  SpecialistBrain,
  type SpecialistDomainConfig,
} from "./specialist-brain.js";

export interface SpecialistPackageConfig {
  readonly profile: EmployeeProfile;
  readonly domain: Omit<SpecialistDomainConfig, "systemPrompt"> & {
    readonly systemPrompt: string;
  };
}

export interface SpecialistDependencies {
  readonly llm: LLMProvider;
}

/** Monta blueprint + RegisteredEmployee a partir de um perfil de dominio. */
export function defineSpecialistPackage(
  config: SpecialistPackageConfig,
): {
  readonly blueprint: EmployeeBlueprint<SpecialistDependencies>;
  readonly registered: RegisteredEmployee;
  create(llm: LLMProvider, factory?: EmployeeFactory): Employee;
} {
  const blueprint: EmployeeBlueprint<SpecialistDependencies> = {
    profile: config.profile,
    build: (deps) =>
      new SpecialistBrain(deps.llm, {
        domainLabel: config.domain.domainLabel,
        proposedActions: config.domain.proposedActions,
        systemPrompt: config.domain.systemPrompt,
      }),
  };

  const registered = defineEmployee(blueprint);

  return {
    blueprint,
    registered,
    create(llm, factory = new EmployeeFactory()) {
      return factory.create(blueprint, { llm });
    },
  };
}

export {
  SpecialistBrain,
  buildSpecialistSystemPrompt,
  type SpecialistDomainConfig,
} from "./specialist-brain.js";
