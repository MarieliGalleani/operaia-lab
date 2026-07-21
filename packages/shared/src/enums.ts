/**
 * Enums de dominio compartilhados por todos os modulos.
 * Sao a fonte unica da verdade e espelham os enums definidos no Prisma.
 */

export const ProjectStatus = {
  PLANNED: "PLANNED",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  COMPLETED: "COMPLETED",
  ARCHIVED: "ARCHIVED",
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const TaskStatus = {
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  BLOCKED: "BLOCKED",
  DONE: "DONE",
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const Priority = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];
