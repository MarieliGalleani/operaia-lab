import { agentRegistry } from "@operaia/agents";
import { Priority, ProjectStatus, TaskStatus } from "@operaia/shared";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EVOLUTION_PROJECT_NAME = "OperaIA.lab";

const projects = [
  {
    name: "NEXO",
    description: "Finalizar desenvolvimento da NEXO",
    status: ProjectStatus.ACTIVE,
    priority: Priority.HIGH,
    goalTitle: "Lancar produtos digitais com qualidade e conformidade",
    tasks: [
      {
        title: "Implementar autenticacao",
        status: TaskStatus.TODO,
        priority: Priority.URGENT,
      },
      {
        title: "Sincronizar dados offline",
        status: TaskStatus.TODO,
        priority: Priority.HIGH,
      },
      {
        title: "Escrever documentacao",
        status: TaskStatus.DONE,
        priority: Priority.MEDIUM,
      },
      {
        title: "Revisar plano de execucao",
        status: TaskStatus.DONE,
        priority: Priority.MEDIUM,
      },
    ],
  },
  {
    name: "MenuFlow",
    description: "Definir e validar o MVP do MenuFlow",
    status: ProjectStatus.ACTIVE,
    priority: Priority.MEDIUM,
    goalTitle: "Lancar produtos digitais com qualidade e conformidade",
    tasks: [
      {
        title: "Definir escopo do MVP",
        status: TaskStatus.TODO,
        priority: Priority.HIGH,
      },
    ],
  },
  {
    name: EVOLUTION_PROJECT_NAME,
    description:
      "Evolucao continua da Equipe Digital — infraestrutura, processos e operacao",
    status: ProjectStatus.ACTIVE,
    priority: Priority.HIGH,
    goalTitle: "Evoluir a autonomia operacional da Equipe Digital",
    tasks: [
      {
        title: "Monitorar saude organizacional do Workspace",
        status: TaskStatus.TODO,
        priority: Priority.HIGH,
      },
      {
        title: "Revisar capacidade operacional dos Workers",
        status: TaskStatus.TODO,
        priority: Priority.MEDIUM,
      },
    ],
  },
  {
    name: "Plataforma",
    description: "Estruturar a plataforma OperaIA.lab",
    status: ProjectStatus.PAUSED,
    priority: Priority.MEDIUM,
    goalTitle: null,
    tasks: [
      {
        title: "Levantar referencias de mercado",
        status: TaskStatus.TODO,
        priority: Priority.LOW,
      },
    ],
  },
] as const;

async function seedAgents(): Promise<void> {
  for (const definition of agentRegistry.all()) {
    await prisma.agent.upsert({
      where: { name: definition.name },
      update: {
        role: definition.role,
        description: definition.description,
        systemInstructions: definition.systemInstructions,
        active: definition.active,
      },
      create: {
        name: definition.name,
        role: definition.role,
        description: definition.description,
        systemInstructions: definition.systemInstructions,
        active: definition.active,
      },
    });
    console.log(`Agente garantido: ${definition.name}`);
  }
}

async function ensureGoal(title: string, priority: Priority): Promise<string> {
  const existing = await prisma.organizationalGoal.findFirst({
    where: { title },
  });
  if (existing) {
    return existing.id;
  }
  const created = await prisma.organizationalGoal.create({
    data: {
      title,
      description: title,
      status: "ACTIVE",
      priority,
    },
  });
  console.log(`Objetivo organizacional criado: ${title}`);
  return created.id;
}

async function seedProjectsAndTasks(): Promise<void> {
  for (const project of projects) {
    const goalId = project.goalTitle
      ? await ensureGoal(
          project.goalTitle,
          project.priority === Priority.HIGH ? Priority.HIGH : Priority.MEDIUM,
        )
      : null;

    let existing = await prisma.project.findFirst({
      where: { name: project.name },
    });

    if (!existing) {
      existing = await prisma.project.create({
        data: {
          name: project.name,
          description: project.description,
          status: project.status,
          priority: project.priority,
          goalId,
        },
      });
      console.log(`Projeto criado: ${project.name}`);
    } else {
      existing = await prisma.project.update({
        where: { id: existing.id },
        data: {
          description: project.description,
          status: project.status,
          priority: project.priority,
          goalId,
        },
      });
      console.log(`Projeto atualizado: ${project.name}`);
    }

    for (const task of project.tasks) {
      const existingTask = await prisma.task.findFirst({
        where: { projectId: existing.id, title: task.title },
      });
      if (existingTask) {
        await prisma.task.update({
          where: { id: existingTask.id },
          data: {
            status: task.status,
            priority: task.priority,
          },
        });
        continue;
      }
      await prisma.task.create({
        data: {
          projectId: existing.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
        },
      });
      console.log(`  Tarefa criada: ${task.title}`);
    }
  }
}

async function main(): Promise<void> {
  console.log("Iniciando seed do OperaIA.lab...");
  await seedAgents();
  await seedProjectsAndTasks();
  console.log("Seed concluido.");
}

main()
  .catch((error: unknown) => {
    console.error("Falha no seed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
