/**
 * Side-effect: define DATABASE_URL a partir do .env do monorepo
 * antes do Prisma Client ser inicializado (vitest nao usa --env-file).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDatabaseUrl(): void {
  if (process.env.DATABASE_URL) {
    return;
  }
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) {
      continue;
    }
    const text = readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (!line.startsWith("DATABASE_URL=")) {
        continue;
      }
      let value = line.slice("DATABASE_URL=".length).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env.DATABASE_URL = value;
      return;
    }
  }
}

loadDatabaseUrl();
