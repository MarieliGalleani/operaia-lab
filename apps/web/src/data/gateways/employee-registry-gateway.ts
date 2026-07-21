import type { EmployeeProfileDTO } from "@/data/dto";

/**
 * Porta para o **Employee Registry**: quem são os funcionários contratados
 * (fonte da verdade sobre perfis e especialidades).
 */
export interface EmployeeRegistryGateway {
  listProfiles(): Promise<readonly EmployeeProfileDTO[]>;
  getProfile(id: string): Promise<EmployeeProfileDTO | undefined>;
}
