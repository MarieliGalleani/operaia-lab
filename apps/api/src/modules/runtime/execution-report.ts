/**
 * Relatorio estruturado de execucao de especialista.
 * A Opera consolida; especialistas nao respondem ao usuario.
 */
export interface ExecutionReport {
  readonly employeeId: string;
  readonly summary: string;
  readonly findings: readonly string[];
  readonly risks: readonly string[];
  readonly recommendations: readonly string[];
  readonly confidence: number;
  /** Tempo de execucao em ms. */
  readonly executionTime: number;
}

export function buildExecutionReport(input: {
  readonly employeeId: string;
  readonly summary: string;
  readonly analysis?: string;
  readonly risks?: readonly string[];
  readonly recommendations?: readonly string[];
  readonly findings?: readonly string[];
  readonly qualityPassed?: boolean;
  readonly executionTime: number;
}): ExecutionReport {
  const findings = [
    ...(input.findings ?? []),
    ...(input.analysis ? [input.analysis] : []),
  ].filter((item) => item.trim().length > 0);

  return {
    employeeId: input.employeeId,
    summary: input.summary,
    findings,
    risks: [...(input.risks ?? [])],
    recommendations: [...(input.recommendations ?? [])],
    confidence: input.qualityPassed === false ? 0.45 : 0.85,
    executionTime: Math.max(0, input.executionTime),
  };
}

/**
 * Consolida ExecutionReports em texto executivo (input para a Opera).
 * Nao e a resposta final ao usuario — a Opera sintetiza depois.
 */
export function consolidateExecutionReports(
  reports: readonly ExecutionReport[],
): {
  readonly summary: string;
  readonly findings: readonly string[];
  readonly risks: readonly string[];
  readonly recommendations: readonly string[];
  readonly averageConfidence: number;
  readonly totalExecutionTime: number;
} {
  if (reports.length === 0) {
    return {
      summary: "Nenhum ExecutionReport de especialista.",
      findings: [],
      risks: [],
      recommendations: [],
      averageConfidence: 0,
      totalExecutionTime: 0,
    };
  }

  const totalExecutionTime = reports.reduce(
    (acc, report) => acc + report.executionTime,
    0,
  );
  const averageConfidence =
    reports.reduce((acc, report) => acc + report.confidence, 0) /
    reports.length;

  return {
    summary: reports
      .map((report) => `${report.employeeId}: ${report.summary}`)
      .join(" | "),
    findings: reports.flatMap((report) => report.findings),
    risks: reports.flatMap((report) => report.risks),
    recommendations: reports.flatMap((report) => report.recommendations),
    averageConfidence,
    totalExecutionTime,
  };
}
