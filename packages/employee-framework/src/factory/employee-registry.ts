import type { Employee } from "../employee/employee-contract.js";
import type { EmployeeProfile } from "../employee/employee-profile.js";
import { EmployeeNotFoundError } from "../errors/index.js";
import {
  EmployeeFactory,
  type EmployeeBlueprint,
} from "./employee-factory.js";

/**
 * Entrada registravel: o perfil (para descoberta) + um criador que recebe as
 * dependencias de runtime. O cast de deps fica encapsulado em `defineEmployee`.
 */
export interface RegisteredEmployee {
  readonly profile: EmployeeProfile;
  create(dependencies?: unknown): Employee;
}

/**
 * Registro central de funcionarios disponiveis. Apenas armazena e lista;
 * nenhuma logica de negocio.
 */
export class EmployeeRegistry {
  private readonly entries = new Map<string, RegisteredEmployee>();

  register(entry: RegisteredEmployee): this {
    this.entries.set(entry.profile.id, entry);
    return this;
  }

  get(id: string): RegisteredEmployee | undefined {
    return this.entries.get(id);
  }

  require(id: string): RegisteredEmployee {
    const entry = this.entries.get(id);
    if (!entry) {
      throw new EmployeeNotFoundError(id);
    }
    return entry;
  }

  profiles(): readonly EmployeeProfile[] {
    return [...this.entries.values()].map((entry) => entry.profile);
  }

  /** Lista todas as entradas registradas (usada por descoberta/matching). */
  all(): readonly RegisteredEmployee[] {
    return [...this.entries.values()];
  }
}

/** Converte um blueprint tipado numa entrada registravel (encapsula o cast). */
export function defineEmployee<TDeps>(
  blueprint: EmployeeBlueprint<TDeps>,
  factory: EmployeeFactory = new EmployeeFactory(),
): RegisteredEmployee {
  return {
    profile: blueprint.profile,
    create: (dependencies?: unknown): Employee =>
      factory.create(blueprint, dependencies as TDeps),
  };
}
