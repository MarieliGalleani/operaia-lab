import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Config do Prisma CLI. Como o schema vive num pacote do monorepo, o .env
 * fica na raiz. Carregamos ele explicitamente (a partir de prisma.config.ts,
 * o Prisma nao carrega .env automaticamente).
 */
const rootEnv = resolve(import.meta.dirname, "../../.env");
try {
  process.loadEnvFile(rootEnv);
} catch {
  // Em CI/producao as variaveis vem do ambiente; ignorar ausencia do .env.
}

export default defineConfig({
  schema: resolve(import.meta.dirname, "prisma/schema.prisma"),
});
