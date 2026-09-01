import type { EmployeeTask } from "@operaia/employee-framework";
import { TaskStatus } from "@operaia/shared";
import type { OfficeWorkspaceRecord } from "./workspace-source.js";

/** Fixture de teste alinhada ao seed operacional (NEXO com pendencias tecnicas). */
export function buildTestWorkspaceCatalog(): readonly OfficeWorkspaceRecord[] {
  const nexoTasks: readonly EmployeeTask[] = [
    {
      id: "t1",
      title: "Implementar autenticacao",
      status: TaskStatus.TODO,
      impact: 5,
      urgency: 5,
    },
    {
      id: "t2",
      title: "Sincronizar dados offline",
      status: TaskStatus.TODO,
      impact: 4,
      urgency: 3,
      dependsOn: ["t1"],
    },
    {
      id: "t3",
      title: "Escrever documentacao",
      status: TaskStatus.DONE,
    },
  ];

  return [
    {
      id: "nexo",
      projectId: "project-nexo",
      name: "NEXO",
      objective: "Finalizar desenvolvimento da NEXO",
      status: "ACTIVE",
      progress: 33,
      teamIds: ["operaia-ceo", "cto-mag"],
      tasks: nexoTasks,
      projectObjective: null,
      projectContext: null,
      projectConstraints: null,
    },
    {
      id: "menuflow",
      projectId: "project-menuflow",
      name: "MenuFlow",
      objective: "Definir e validar o MVP do MenuFlow",
      status: "PLANNED",
      progress: 0,
      teamIds: ["operaia-ceo"],
      tasks: [
        {
          id: "mf1",
          title: "Definir escopo do MVP",
          status: TaskStatus.TODO,
          impact: 4,
          urgency: 4,
        },
      ],
      projectObjective: null,
      projectContext: null,
      projectConstraints: null,
    },
    {
      id: "plataforma",
      projectId: "project-plataforma",
      name: "Plataforma",
      objective: "Estruturar a plataforma OperaIA.lab",
      status: "PAUSED",
      progress: 0,
      teamIds: ["operaia-ceo"],
      tasks: [
        {
          id: "pl1",
          title: "Levantar referencias de mercado",
          status: TaskStatus.TODO,
          impact: 2,
          urgency: 1,
        },
      ],
      projectObjective: null,
      projectContext: null,
      projectConstraints: null,
    },
  ];
}
