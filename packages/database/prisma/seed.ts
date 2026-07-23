import { agentRegistry } from "@operaia/agents";
import { Priority, ProjectStatus, TaskStatus } from "@operaia/shared";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const projects = [
  {
    name: "NEXO",
    description: "Finalizar desenvolvimento da NEXO",
    status: ProjectStatus.ACTIVE,
    priority: Priority.HIGH,
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
    status: ProjectStatus.PLANNED,
    priority: Priority.MEDIUM,
    tasks: [
      {
        title: "Definir escopo do MVP",
        status: TaskStatus.TODO,
        priority: Priority.HIGH,
      },
    ],
  },
  {
    name: "Plataforma",
    description: "Estruturar a plataforma OperaIA.lab",
    status: ProjectStatus.PAUSED,
    priority: Priority.MEDIUM,
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

async function seedProjectsAndTasks(): Promise<void> {
  for (const project of projects) {
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
