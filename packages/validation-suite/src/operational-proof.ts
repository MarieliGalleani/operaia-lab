/**
 * Sprint A Operational Proof — artefato gerado pela Validation Suite.
 */
import type { ValidationReport } from "./validation-report.js";

export interface OperationalProof {
  readonly title: string;
  readonly generatedAt: string;
  readonly success: boolean;
  readonly markdown: string;
  readonly approvedFlows: readonly string[];
  readonly rejectedFlows: readonly string[];
  readonly totalDurationMs: number;
  readonly packageVersions: Readonly<Record<string, string>>;
}

export function buildOperationalProof(input: {
  readonly report: ValidationReport;
  readonly packageVersions?: Readonly<Record<string, string>>;
}): OperationalProof {
  const versions = input.packageVersions ?? {};
  const approved = input.report.results
    .filter((r) => r.status === "passed")
    .map((r) => `${r.name} (${r.id})`);
  const rejected = input.report.results
    .filter((r) => r.status === "failed")
    .map((r) => `${r.name} (${r.id})${r.error ? `: ${r.error}` : ""}`);

  const versionLines =
    Object.keys(versions).length === 0
      ? ["- (versoes nao informadas)"]
      : Object.entries(versions).map(([name, version]) => `- \`${name}\`: ${version}`);

  const lines = [
    "# Sprint A Operational Proof",
    "",
    "> Artefato gerado automaticamente por `@operaia/validation-suite`.",
    "> Comprova que a arquitetura operacional da Sprint A funciona integrada.",
    "",
    "## Resumo executivo",
    "",
    input.report.success
      ? "A organizacao digital do OperaIA.lab respondeu corretamente em todos os fluxos validados: roteamento conversacional, delegacao especializada, Action Runtime, policy, isolamento de workspace, ledger e recuperacao controlada."
      : "A validacao operacional encontrou falhas. Revisar os fluxos reprovados antes de considerar a Sprint A concluida.",
    "",
    `| Campo | Valor |`,
    `|---|---|`,
    `| Status | **${input.report.success ? "APROVADO" : "REPROVADO"}** |`,
    `| Data da execucao | ${input.report.generatedAt} |`,
    `| Tempo total | ${input.report.durationMs}ms |`,
    `| Fluxos executados | ${input.report.executedScenarios} |`,
    `| Fluxos aprovados | ${input.report.passed} |`,
    `| Fluxos reprovados | ${input.report.failed} |`,
    "",
    "## Arquitetura validada",
    "",
    "- ConversationMissionRouter (porta unica conversacional)",
    "- Mission Intent Router (classificacao + employee)",
    "- CEO: GENERAL_CONVERSATION vs OPERATIONAL_REVIEW",
    "- Delegacao Mag (TECH / BUG)",
    "- Delegacao Atlas/Orion (INFRA) + ActionCapabilityProvider",
    "- Action Runtime (policy → adapter → resultado)",
    "- ActionPolicy (negacao Mag docker.restart)",
    "- Workspace isolation (MapWorkspaceActionScope)",
    "- Execution Ledger (REQUESTED → RUNNING → SUCCESS / FAILED / DENIED)",
    "- Recovery controlada (falha de adapter)",
    "",
    "## Fluxos executados",
    "",
    "| Scenario | Status | Duration | Observacoes |",
    "|---|---|---|---|",
  ];

  for (const result of input.report.results) {
    const status = result.status === "passed" ? "✅ PASSED" : "❌ FAILED";
    const obs = (result.observations.join("; ") || "—").replace(/\|/g, "/");
    lines.push(
      `| ${result.name} (${result.id}) | ${status} | ${result.durationMs}ms | ${obs} |`,
    );
  }

  lines.push("");
  lines.push("## Fluxos aprovados");
  lines.push("");
  if (approved.length === 0) {
    lines.push("- (nenhum)");
  } else {
    for (const flow of approved) {
      lines.push(`- ${flow}`);
    }
  }

  lines.push("");
  lines.push("## Fluxos reprovados");
  lines.push("");
  if (rejected.length === 0) {
    lines.push("- (nenhum)");
  } else {
    for (const flow of rejected) {
      lines.push(`- ${flow}`);
    }
  }

  lines.push("");
  lines.push("## Versoes dos pacotes");
  lines.push("");
  lines.push(...versionLines);

  lines.push("");
  lines.push("## Relatorio completo");
  lines.push("");
  lines.push("```");
  lines.push(input.report.text);
  lines.push("```");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    "Esta prova faz parte da Definition of Done (DoD) de todas as proximas sprints.",
  );

  return {
    title: "Sprint A Operational Proof",
    generatedAt: input.report.generatedAt,
    success: input.report.success,
    markdown: lines.join("\n"),
    approvedFlows: approved,
    rejectedFlows: rejected,
    totalDurationMs: input.report.durationMs,
    packageVersions: versions,
  };
}
