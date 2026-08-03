/**
 * ValidationRunner — executa todos os cenarios oficiais da Sprint A.V.
 */
import { runScenarios } from "./scenario-runner.js";
import {
  buildValidationReport,
  type ValidationReport,
} from "./validation-report.js";
import { ALL_VALIDATION_SCENARIOS } from "./scenarios/scenarios.js";
import type { ValidationScenario } from "./scenario.js";
import {
  buildOperationalProof,
  type OperationalProof,
} from "./operational-proof.js";

export interface ValidationRunnerResult {
  readonly success: boolean;
  readonly executedScenarios: number;
  readonly passed: number;
  readonly failed: number;
  readonly duration: number;
  readonly report: ValidationReport;
  readonly proof: OperationalProof;
}

export interface ValidationRunnerOptions {
  readonly scenarios?: readonly ValidationScenario[];
  readonly packageVersions?: Readonly<Record<string, string>>;
}

export class ValidationRunner {
  private readonly scenarios: readonly ValidationScenario[];
  private readonly packageVersions: Readonly<Record<string, string>>;

  constructor(options: ValidationRunnerOptions = {}) {
    this.scenarios = options.scenarios ?? ALL_VALIDATION_SCENARIOS;
    this.packageVersions = options.packageVersions ?? {};
  }

  async run(): Promise<ValidationRunnerResult> {
    const startedAt = Date.now();
    const results = await runScenarios(this.scenarios);
    const duration = Date.now() - startedAt;
    const report = buildValidationReport({ results, durationMs: duration });
    const proof = buildOperationalProof({
      report,
      packageVersions: this.packageVersions,
    });

    return {
      success: report.success,
      executedScenarios: report.executedScenarios,
      passed: report.passed,
      failed: report.failed,
      duration,
      report,
      proof,
    };
  }
}

export async function runValidationSuite(
  options?: ValidationRunnerOptions,
): Promise<ValidationRunnerResult> {
  return new ValidationRunner(options).run();
}
