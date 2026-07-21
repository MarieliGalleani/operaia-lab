import type { Activity, Project, Task } from "@/types/office";

/** Projetos vivos = Workspaces. Espelham o seed do Workspace Runtime. */
export const projects: readonly Project[] = [
  {
    id: "nexo",
    name: "NEXO",
    objective: "Finalizar desenvolvimento da NEXO",
    status: "ACTIVE",
    progress: 65,
    teamIds: ["operaia-ceo", "cto-mag"],
    decisions: [
      {
        id: "d1",
        summary: "Priorizar autenticação antes da sincronização offline.",
        authorId: "operaia-ceo",
        date: "2026-07-21T02:40:00-03:00",
      },
      {
        id: "d2",
        summary: "Implementar incrementalmente com testes desde o início.",
        authorId: "cto-mag",
        date: "2026-07-21T02:44:00-03:00",
      },
    ],
  },
  {
    id: "menuflow",
    name: "MenuFlow",
    objective: "Estruturar o MVP do cardápio digital",
    status: "PLANNED",
    progress: 20,
    teamIds: ["operaia-ceo"],
    decisions: [
      {
        id: "d3",
        summary: "Aguardando definição de escopo do produto.",
        authorId: "operaia-ceo",
        date: "2026-07-20T18:10:00-03:00",
      },
    ],
  },
  {
    id: "plataforma",
    name: "Plataforma",
    objective: "Planejar o lançamento de uma nova plataforma",
    status: "PAUSED",
    progress: 10,
    teamIds: ["operaia-ceo"],
    decisions: [],
  },
];

export const tasks: readonly Task[] = [
  { id: "t1", projectId: "nexo", title: "Implementar autenticação", status: "IN_PROGRESS", assigneeId: "cto-mag", priority: "URGENT" },
  { id: "t2", projectId: "nexo", title: "Sincronizar dados offline", status: "BACKLOG", assigneeId: "cto-mag", priority: "HIGH" },
  { id: "t3", projectId: "nexo", title: "Escrever documentação técnica", status: "DONE", assigneeId: "cto-mag", priority: "MEDIUM" },
  { id: "t4", projectId: "nexo", title: "Revisar plano de execução", status: "DONE", assigneeId: "operaia-ceo", priority: "MEDIUM" },
  { id: "t5", projectId: "menuflow", title: "Definir escopo do MVP", status: "BACKLOG", assigneeId: "operaia-ceo", priority: "HIGH" },
  { id: "t6", projectId: "menuflow", title: "Mapear jornada do usuário", status: "BACKLOG", priority: "MEDIUM" },
  { id: "t7", projectId: "plataforma", title: "Levantar referências de mercado", status: "BACKLOG", assigneeId: "operaia-ceo", priority: "LOW" },
];

export const activities: readonly Activity[] = [
  { id: "a1", kind: "PLAN", actorId: "operaia-ceo", message: "CEO — Opera criou o plano de execução da NEXO.", timestamp: "2026-07-21T02:40:00-03:00", projectId: "nexo" },
  { id: "a2", kind: "DELEGATION", actorId: "operaia-ceo", message: "CEO — Opera delegou engenharia de software.", timestamp: "2026-07-21T02:42:00-03:00", projectId: "nexo" },
  { id: "a3", kind: "BRIEFING", actorId: "cto-mag", message: "CTO — Mag recebeu o briefing técnico da NEXO.", timestamp: "2026-07-21T02:44:00-03:00", projectId: "nexo" },
  { id: "a4", kind: "TASK", actorId: "cto-mag", message: "Tarefa criada: Implementar autenticação.", timestamp: "2026-07-21T02:46:00-03:00", projectId: "nexo" },
  { id: "a5", kind: "REVIEW", actorId: "operaia-ceo", message: "Revisão de ciclo concluída pela CEO — Opera.", timestamp: "2026-07-21T02:50:00-03:00", projectId: "nexo" },
];
