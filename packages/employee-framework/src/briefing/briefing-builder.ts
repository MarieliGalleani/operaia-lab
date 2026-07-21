import { TaskStatus } from "@operaia/shared";
import type { EmployeeTask } from "../contracts/employee-task.js";
import type { EmployeeBriefing } from "./employee-briefing.js";

/**
 * Snapshot de NEGOCIO de um Workspace, alimentado ao builder.
 * Dados puros: a traducao a partir do Workspace real (infra) acontece na
 * camada de composicao, nunca dentro dos funcionarios.
 */
export interface WorkspaceSnapshot {
  readonly workspaceId: string;
  readonly name: string;
  readonly objective?: string;
  readonly executiveSummary?: string;
  readonly tasks?: readonly EmployeeTask[];
  readonly documents?: readonly string[];
  readonly roadmap?: readonly string[];
  readonly history?: readonly string[];
  readonly constraints?: readonly string[];
  readonly successCriteria?: readonly string[];
  readonly sessions?: readonly {
    readonly id: string;
    readonly status: string;
    readonly objective: string;
  }[];
}

/**
 * BriefingBuilder: UNICO ponto de adaptacao Workspace -> Briefing.
 * Nenhuma adaptacao deve acontecer dentro dos funcionarios.
 */
export class BriefingBuilder {
  build(snapshot: WorkspaceSnapshot, objective?: string): EmployeeBriefing {
    const tasks = snapshot.tasks ?? [];
    const pending = tasks
      .filter((task) => task.status !== TaskStatus.DONE)
      .map((task) => task.title);
    const done = tasks.length - pending.length;

    return {
      project: snapshot.name,
      objective: objective ?? snapshot.objective ?? "",
      executiveSummary: snapshot.executiveSummary ?? "",
      currentState: `${done}/${tasks.length} tarefa(s) concluida(s).`,
      pending,
      tasks,
      documentation: snapshot.documents ?? [],
      history: snapshot.history ?? [],
      constraints: snapshot.constraints ?? [],
      successCriteria: snapshot.successCriteria ?? [],
      additional: {
        roadmap: snapshot.roadmap ?? [],
        sessions: snapshot.sessions ?? [],
      },
    };
  }
}
