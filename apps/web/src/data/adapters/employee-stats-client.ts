/** Cliente do cartão de desempenho por funcionário (Fase 3 — O Mural do Escritório). */
import { createHttpClient } from "./http-client";

export type EmployeeConfidence = "CONFIANTE" | "PRECISA_REVISAO" | "SEM_DADOS";

export interface EmployeeStats {
  readonly employeeId: string;
  readonly missionsCompleted: number;
  readonly missionsFailed: number;
  readonly totalFinished: number;
  readonly successRate: number | null;
  readonly avgDurationMs: number | null;
  readonly confidence: EmployeeConfidence;
}

export function createEmployeeStatsClient() {
  const http = createHttpClient();
  return {
    async listStats(): Promise<readonly EmployeeStats[]> {
      return http.get<readonly EmployeeStats[]>("/employees/stats");
    },
  };
}
