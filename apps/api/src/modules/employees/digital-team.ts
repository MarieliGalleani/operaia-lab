import type { EmployeesApplication } from "./employees.application.js";
import { createProductLabRuntime } from "../operations/product-lab-runtime.js";

/**
 * Equipe Digital — via Lab Runtime unificado (mesmo que Operations).
 * Preferir createProductLabRuntime() no composition root da API.
 */
export function createDigitalTeam(): EmployeesApplication {
  return createProductLabRuntime().lab.team;
}

/**
 * @deprecated Use createProductLabRuntime() uma vez no app.ts.
 * Singleton legado — runtime proprio (nao compartilhado com Operations no mesmo process se app.ts tambem criar).
 */
export const digitalTeam = createDigitalTeam();
