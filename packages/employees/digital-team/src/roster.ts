import { ceoRegisteredEmployee } from "@operaia/agents";
import { magRegisteredEmployee } from "@operaia/cto-mag";
import { atlasRegisteredEmployee } from "@operaia/employee-atlas";
import { auroraRegisteredEmployee } from "@operaia/employee-aurora";
import {
  EmployeeRegistry,
  type RegisteredEmployee,
} from "@operaia/employee-framework";
import { lunaRegisteredEmployee } from "@operaia/employee-luna";
import { mercurioRegisteredEmployee } from "@operaia/employee-mercurio";
import { nexusRegisteredEmployee } from "@operaia/employee-nexus";
import { orionRegisteredEmployee } from "@operaia/employee-orion";
import { themisRegisteredEmployee } from "@operaia/employee-themis";

/**
 * Catalogo oficial da Equipe Digital.
 * Contratar = criar pacote do employee + adicionar UMA entrada aqui.
 * Matcher / Orchestrator / Framework nao mudam.
 */
export const DIGITAL_TEAM_EMPLOYEES: readonly RegisteredEmployee[] = [
  ceoRegisteredEmployee,
  magRegisteredEmployee,
  lunaRegisteredEmployee,
  nexusRegisteredEmployee,
  atlasRegisteredEmployee,
  auroraRegisteredEmployee,
  themisRegisteredEmployee,
  mercurioRegisteredEmployee,
  orionRegisteredEmployee,
];

/** Preenche o Registry com todos os Employees ativos. */
export function registerDigitalTeam(
  registry: EmployeeRegistry = new EmployeeRegistry(),
): EmployeeRegistry {
  for (const employee of DIGITAL_TEAM_EMPLOYEES) {
    registry.register(employee);
  }
  return registry;
}
