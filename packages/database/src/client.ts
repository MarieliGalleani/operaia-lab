import { PrismaClient } from "@prisma/client";

/**
 * Cliente Prisma como singleton.
 * Em desenvolvimento, o hot-reload pode reinstanciar modulos varias vezes;
 * cachear a instancia em globalThis evita esgotar o pool de conexoes.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type Database = PrismaClient;
