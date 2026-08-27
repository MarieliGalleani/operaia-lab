/**
 * Evidence verificavel de uma execucao browser (sem secrets).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface BrowserCheckResult {
  readonly name: string;
  readonly ok: boolean;
  readonly detail?: string;
}

export interface BrowserEvidence {
  readonly url: string;
  readonly timestamp: string;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly checks: readonly BrowserCheckResult[];
  readonly screenshotPath: string | null;
  readonly errors: readonly string[];
  readonly consoleSafe: readonly string[];
  readonly networkFailures: readonly {
    readonly host: string;
    readonly path: string;
    readonly status: number | null;
  }[];
}

export function writeBrowserEvidence(
  filePath: string,
  evidence: BrowserEvidence,
): void {
  const abs = resolve(filePath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}
