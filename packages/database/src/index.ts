export { prisma } from "./client.js";
export type { Database } from "./client.js";

// Re-exporta tipos e enums gerados pelo Prisma para consumo tipado nos modulos.
export {
  type Project,
  type Task,
  type Agent,
  Prisma,
} from "@prisma/client";
