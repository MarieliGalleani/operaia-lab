import { agentRegistry } from "@operaia/agents";
import { Priority, ProjectStatus } from "@operaia/shared";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const projects = [
  {
    name: "NEXO",
    description: "Projeto NEXO.",
    status: ProjectStatus.ACTIVE,
    priority: Priority.HIGH,
  },
  {
    name: "MenuFlow",
    description: "Projeto MenuFlow.",
    status: ProjectStatus.ACTIVE,
    priority: Priority.MEDIUM,
  },
  {
    name: "Plataforma",
    description: "Projeto Plataforma.",
    status: ProjectStatus.PLANNED,
    priority: Priority.MEDIUM,
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

async function seedProjects(): Promise<void> {
  for (const project of projects) {
    const existing = await prisma.project.findFirst({
      where: { name: project.name },
    });
    if (existing) {
      console.log(`Projeto ja existe, ignorando: ${project.name}`);
      continue;
    }
    await prisma.project.create({ data: project });
    console.log(`Projeto criado: ${project.name}`);
  }
}

async function main(): Promise<void> {
  console.log("Iniciando seed do OperaIA.lab...");
  await seedAgents();
  await seedProjects();
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
