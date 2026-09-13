import { prisma } from "@operaia/database";

/**
 * Cartao de desempenho por funcionario (Fase 3 do plano "O Mural do
 * Escritorio"): missoes concluidas de verdade, taxa de sucesso e tempo
 * medio, agregados do historico real de Mission — nada calculado em
 * cima de amostra pequena vira "confiante" (ver MIN_SAMPLE abaixo).
 */

const MIN_SAMPLE = 3;

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

export function resolveConfidence(totalFinished: number, successRate: number | null): EmployeeConfidence {
  if (totalFinished < MIN_SAMPLE || successRate === null) return "SEM_DADOS";
  return successRate >= 0.8 ? "CONFIANTE" : "PRECISA_REVISAO";
}

export async function listEmployeeStats(): Promise<readonly EmployeeStats[]> {
  const [grouped, durationsRaw] = await Promise.all([
    prisma.mission.groupBy({
      by: ["ownerEmployeeId", "status"],
      _count: { _all: true },
      where: { status: { in: ["COMPLETED", "FAILED", "CANCELLED"] } },
    }),
    prisma.mission.findMany({
      where: { status: "COMPLETED", startedAt: { not: null }, finishedAt: { not: null } },
      select: { ownerEmployeeId: true, startedAt: true, finishedAt: true },
    }),
  ]);

  const counts = new Map<string, { completed: number; failed: number; cancelled: number }>();
  for (const row of grouped) {
    const entry = counts.get(row.ownerEmployeeId) ?? { completed: 0, failed: 0, cancelled: 0 };
    if (row.status === "COMPLETED") entry.completed = row._count._all;
    else if (row.status === "FAILED") entry.failed = row._count._all;
    else if (row.status === "CANCELLED") entry.cancelled = row._count._all;
    counts.set(row.ownerEmployeeId, entry);
  }

  const durationsByEmployee = new Map<string, number[]>();
  for (const mission of durationsRaw) {
    if (!mission.startedAt || !mission.finishedAt) continue;
    const ms = mission.finishedAt.getTime() - mission.startedAt.getTime();
    if (ms <= 0) continue;
    const list = durationsByEmployee.get(mission.ownerEmployeeId) ?? [];
    list.push(ms);
    durationsByEmployee.set(mission.ownerEmployeeId, list);
  }

  const employeeIds = new Set<string>([...counts.keys(), ...durationsByEmployee.keys()]);

  return [...employeeIds].map((employeeId) => {
    const c = counts.get(employeeId) ?? { completed: 0, failed: 0, cancelled: 0 };
    const totalFinished = c.completed + c.failed + c.cancelled;
    const successRate = totalFinished > 0 ? c.completed / totalFinished : null;
    const durations = durationsByEmployee.get(employeeId) ?? [];
    const avgDurationMs =
      durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

    return {
      employeeId,
      missionsCompleted: c.completed,
      missionsFailed: c.failed,
      totalFinished,
      successRate,
      avgDurationMs,
      confidence: resolveConfidence(totalFinished, successRate),
    };
  });
}
