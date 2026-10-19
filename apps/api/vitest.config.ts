import { defineConfig } from "vitest/config";

/**
 * `pnpm test`             -> so testes unitarios (sem banco).
 * `pnpm test:integration` -> *.integration.test.ts contra o DATABASE_URL do .env.
 *   Nunca rode integracao apontando para o banco de producao.
 */
const integration = process.env.VITEST_INTEGRATION === "1";

export default defineConfig({
  test: {
    include: integration
      ? ["src/**/*.integration.test.ts"]
      : ["src/**/*.test.ts"],
    exclude: integration
      ? ["node_modules/**"]
      : ["node_modules/**", "src/**/*.integration.test.ts"],
    env: integration
      ? {}
      : {
          // Placeholder: modulos que importam config/env exigem a variavel,
          // mas os testes unitarios nao abrem conexao.
          DATABASE_URL:
            process.env.DATABASE_URL ??
            "postgresql://unit:unit@127.0.0.1:1/unit_tests",
        },
  },
});
