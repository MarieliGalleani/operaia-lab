import type { EmployeeBriefing } from "@operaia/employee-framework";
import { TaskStatus } from "@operaia/shared";
import type { CeoReview } from "./ceo-types.js";

/**
 * Revisa, ao final de um ciclo, se o objetivo foi atingido, se restam
 * pendencias e se um novo ciclo e necessario.
 */
export class CeoReviewer {
  review(briefing: EmployeeBriefing): CeoReview {
    const tasks = briefing.tasks;
    const pending = tasks.filter((task) => task.status !== TaskStatus.DONE);
    const blocked = tasks.filter((task) => task.status === TaskStatus.BLOCKED);

    const hasTasks = tasks.length > 0;
    const objectiveAchieved = hasTasks && pending.length === 0;
    const needsNewCycle = !objectiveAchieved;

    const findings: string[] = [];
    if (!hasTasks) {
      findings.push("Nenhuma tarefa cadastrada; objetivo ainda nao decomposto.");
    }
    if (pending.length > 0) {
      findings.push(`${pending.length} tarefa(s) ainda em aberto.`);
    }
    if (blocked.length > 0) {
      findings.push(`${blocked.length} tarefa(s) bloqueada(s) exigem atencao.`);
    }
    if (objectiveAchieved) {
      findings.push(
        `Objetivo "${briefing.objective}" concluido: todas as tarefas DONE.`,
      );
    }

    return {
      objectiveAchieved,
      pendingCount: pending.length,
      blockedCount: blocked.length,
      needsNewCycle,
      findings,
    };
  }
}
