/**
 * CLI — executa a Validation Suite e grava o Operational Proof.
 *
 * Uso:
 *   pnpm --filter @operaia/validation-suite validate
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ValidationRunner } from "./validation-runner.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const proofPath = path.join(
  repoRoot,
  "docs/validation/sprint-a-operational-proof.md",
);

async function readPackageVersion(packageName: string): Promise<string> {
  const pkgPath = path.join(
    repoRoot,
    "packages",
    packageName,
    "package.json",
  );
  try {
    const raw = await readFile(pkgPath, "utf8");
    const json = JSON.parse(raw) as { version?: string; name?: string };
    return json.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function main(): Promise<void> {
  const packageVersions: Record<string, string> = {
    "@operaia/validation-suite": await readPackageVersion("validation-suite"),
    "@operaia/mission-router": await readPackageVersion("mission-router"),
    "@operaia/action-runtime": await readPackageVersion("action-runtime"),
    "@operaia/agents": await readPackageVersion("agents"),
    "@operaia/employee-framework": await readPackageVersion(
      "employee-framework",
    ),
  };

  const result = await new ValidationRunner({ packageVersions }).run();

  await mkdir(path.dirname(proofPath), { recursive: true });
  await writeFile(proofPath, `${result.proof.markdown}\n`, "utf8");

  console.log(result.report.text);
  console.log("");
  console.log(`Operational Proof gravado em: ${proofPath}`);
  console.log(
    result.success
      ? `ValidationRunner: SUCCESS (${result.passed}/${result.executedScenarios})`
      : `ValidationRunner: FAILED (${result.failed} falha(s))`,
  );

  if (!result.success) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
