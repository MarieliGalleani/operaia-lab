import { Priority, ProjectStatus, TaskStatus } from "@operaia/shared";
import { describe, expect, it } from "vitest";
import type { Project } from "../projects/domain/project.entity.js";
import type { Task } from "../tasks/domain/task.entity.js";
import {
  buildOfficeWorkspace,
  publicWorkspaceId,
  toEmployeeTask,
} from "./workspace-mappers.js";

const now = new Date();

describe("Etapa 4 — workspace-mappers", () => {
  it("mapeia Project NEXO para id publico nexo", () => {
    const project: Project = {
      id: "uuid-nexo",
      name: "NEXO",
      description: "Finalizar desenvolvimento da NEXO",
      status: ProjectStatus.ACTIVE,
      priority: Priority.HIGH,
      createdAt: now,
      updatedAt: now,
    };
    expect(publicWorkspaceId(project)).toBe("nexo");

    const tasks: Task[] = [
      {
        id: "t1",
        projectId: project.id,
        title: "Implementar autenticacao",
        description: null,
        status: TaskStatus.TODO,
        priority: Priority.URGENT,
        assignedAgentId: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "t2",
        projectId: project.id,
        title: "Docs",
        description: null,
        status: TaskStatus.DONE,
        priority: Priority.LOW,
        assignedAgentId: null,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const workspace = buildOfficeWorkspace(project, tasks, [
      "operaia-ceo",
      "cto-mag",
    ]);
    expect(workspace.id).toBe("nexo");
    expect(workspace.projectId).toBe("uuid-nexo");
    expect(workspace.progress).toBe(50);
    expect(workspace.objective).toContain("NEXO");
    expect(toEmployeeTask(tasks[0]!).urgency).toBe(5);
  });
});
