/**
 * Teste arquitetural S1 (API signals): sem fila oficial / Matcher / Execution.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

const FORBIDDEN_IMPORT_PATTERNS = [
  /from\s+["'][^"']*mission-queue[^"']*["']/,
  /from\s+["'][^"']*queued-mission-executor[^"']*["']/,
  /from\s+["'][^"']*mission-orchestrator[^"']*["']/,
  /from\s+["'][^"']*execution-engine[^"']*["']/,
  /from\s+["']@operaia\/execution-engine["']/,
  /from\s+["'][^"']*operational-run-from-queue[^"']*["']/,
] as const;

const FORBIDDEN_SYMBOLS_IN_CODE = [
  "MissionQueue",
  "QueuedMissionExecutor",
  "MissionOrchestrator",
  "DelegationService",
  "ExecutionEngine",
] as const;

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (
      name.endsWith(".ts") &&
      !name.endsWith(".test.ts") &&
      !name.endsWith(".integration.test.ts")
    ) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("architecture — signals module sem execucao", () => {
  it("modulos de signals nao importam fila/Matcher/Execution", () => {
    const files = listTsFiles(ROOT);
    expect(files.length).toBeGreaterThan(0);
    const violations: string[] = [];
    for (const file of files) {
      const text = stripComments(readFileSync(file, "utf8"));
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        if (pattern.test(text)) {
          violations.push(`${relative(ROOT, file)} → ${pattern}`);
        }
      }
      for (const symbol of FORBIDDEN_SYMBOLS_IN_CODE) {
        if (text.includes(symbol)) {
          violations.push(`${relative(ROOT, file)} → ${symbol}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
