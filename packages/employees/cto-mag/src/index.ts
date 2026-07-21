import type { LLMProvider } from "@operaia/ai-core";
import {
  EmployeeFactory,
  defineEmployee,
  type Employee,
  type EmployeeBlueprint,
  type RegisteredEmployee,
} from "@operaia/employee-framework";
import { MagBrain } from "./mag-brain.js";
import { magProfile } from "./mag-profile.js";

export { magProfile } from "./mag-profile.js";
export {
  MAG_PROMPT_BLOCKS,
  buildMagSystemPrompt,
} from "./mag-system-rules.js";
export { MagBrain, type MagBrainDependencies } from "./mag-brain.js";

/** Dependencias de runtime da CTO Mag. */
export interface MagDependencies {
  readonly llm: LLMProvider;
}

/** Blueprint da CTO Mag: perfil + como construir o brain. Criar = especializar. */
export const magBlueprint: EmployeeBlueprint<MagDependencies> = {
  profile: magProfile,
  build: (deps) => new MagBrain({ llm: deps.llm }),
};

/** Entrada registravel da Mag para o EmployeeRegistry. */
export const magRegisteredEmployee: RegisteredEmployee =
  defineEmployee(magBlueprint);

/** Atalho de composicao: instancia a CTO via Factory com as politicas padrao. */
export function createCto(
  llm: LLMProvider,
  factory: EmployeeFactory = new EmployeeFactory(),
): Employee {
  return factory.create(magBlueprint, { llm });
}
