import type { LLMProvider } from "@operaia/ai-core";
import {
  EmployeeFactory,
  defineEmployee,
  type Employee,
  type EmployeeBlueprint,
  type RegisteredEmployee,
} from "@operaia/employee-framework";
import { CeoBrain } from "./ceo-brain.js";
import { ceoProfile } from "./ceo-profile.js";

/** Dependencias de runtime do CEO. */
export interface CeoDependencies {
  readonly llm: LLMProvider;
}

/** Blueprint do CEO: perfil + como construir o brain. Criar = especializar. */
export const ceoBlueprint: EmployeeBlueprint<CeoDependencies> = {
  profile: ceoProfile,
  build: (deps) => new CeoBrain({ llm: deps.llm }),
};

/** Entrada registravel do CEO para o EmployeeRegistry. */
export const ceoRegisteredEmployee: RegisteredEmployee =
  defineEmployee(ceoBlueprint);

/** Atalho de composicao: instancia o CEO via Factory com as politicas padrao. */
export function createCeo(
  llm: LLMProvider,
  factory: EmployeeFactory = new EmployeeFactory(),
): Employee {
  return factory.create(ceoBlueprint, { llm });
}
