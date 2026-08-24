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
  readonly domain: SpecialistDomainConfig;
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
    build: (deps) => new SpecialistBrain(deps.llm, config.domain),
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
  SPECIALIST_READ_ONLY_TOOL_IDS,
  type SpecialistDomainConfig,
  type SpecialistReadOnlyToolId,
} from "./specialist-brain.js";

export {
  UX_DELIVERY_TYPE,
  UX_EMPLOYEE_ID,
  isValidUxAnalysisDelivery,
  isValidUxResultJson,
  extractUxToolExecutions,
} from "./ux-delivery-validation.js";

export {
  UX_EVIDENCE_DOMAIN,
  buildUxEvidence,
  sanitizeUxEvidenceForResultJson,
} from "./ux-evidence.js";

export {
  isUxSensitivePath,
  validateUxReadFilePath,
  validateUxListDirectoryPath,
} from "./ux-artifact-path.js";

export {
  MARKETING_DELIVERY_TYPE,
  MARKETING_EMPLOYEE_ID,
  isValidMarketingAnalysisDelivery,
  isValidMarketingResultJson,
  extractMarketingToolExecutions,
} from "./marketing-delivery-validation.js";

export {
  MARKETING_EVIDENCE_DOMAIN,
  buildMarketingEvidence,
  sanitizeMarketingEvidenceForResultJson,
} from "./marketing-evidence.js";

export {
  isMarketingSensitivePath,
  validateMarketingReadFilePath,
  validateMarketingListDirectoryPath,
} from "./marketing-artifact-path.js";
