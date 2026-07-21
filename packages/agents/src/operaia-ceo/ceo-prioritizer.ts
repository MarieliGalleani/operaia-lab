import type { EmployeeTask } from "@operaia/employee-framework";
import { Priority, TaskStatus } from "@operaia/shared";
import type { PrioritizedTask } from "./ceo-types.js";

/** Pesos do modelo de priorizacao. Ajustaveis sem alterar o algoritmo. */
const WEIGHTS = {
  impact: 0.3,
  urgency: 0.3,
  risk: 0.2,
  dependents: 0.15,
  effort: 0.15,
} as const;

const DEFAULT_DIMENSION = 3;
const MAX_DEPENDENTS = 5;

/**
 * Algoritmo simples e deterministico de priorizacao.
 *
 * score = impacto*wI + urgencia*wU + risco*wR + dependentes*wD - esforco*wE
 * onde "dependentes" = quantas tarefas dependem desta (ela desbloqueia valor).
 */
export class CeoPrioritizer {
  prioritize(tasks: readonly EmployeeTask[]): PrioritizedTask[] {
    const active = tasks.filter((task) => task.status !== TaskStatus.DONE);
    const dependents = countDependents(active);

    return active
      .map((task) => this.scoreTask(task, dependents.get(task.id) ?? 0))
      .sort((a, b) => b.score - a.score);
  }

  private scoreTask(task: EmployeeTask, dependents: number): PrioritizedTask {
    const impact = dimension(task.impact);
    const urgency = dimension(task.urgency);
    const risk = dimension(task.risk);
    const effort = dimension(task.effort);
    const blockers = Math.min(dependents, MAX_DEPENDENTS);

    const score =
      impact * WEIGHTS.impact +
      urgency * WEIGHTS.urgency +
      risk * WEIGHTS.risk +
      blockers * WEIGHTS.dependents -
      effort * WEIGHTS.effort;

    return {
      taskId: task.id,
      title: task.title,
      score: round(score),
      priority: toPriority(score),
      rationale:
        `impacto=${impact}, urgencia=${urgency}, risco=${risk}, ` +
        `dependentes=${blockers}, esforco=${effort}` +
        (task.status === TaskStatus.BLOCKED ? " (bloqueada)" : ""),
    };
  }
}

function countDependents(tasks: readonly EmployeeTask[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    for (const dependencyId of task.dependsOn ?? []) {
      counts.set(dependencyId, (counts.get(dependencyId) ?? 0) + 1);
    }
  }
  return counts;
}

function dimension(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_DIMENSION;
  }
  return Math.max(0, Math.min(5, value));
}

function toPriority(score: number): Priority {
  if (score >= 3.5) {
    return Priority.URGENT;
  }
  if (score >= 2.5) {
    return Priority.HIGH;
  }
  if (score >= 1.5) {
    return Priority.MEDIUM;
  }
  return Priority.LOW;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
