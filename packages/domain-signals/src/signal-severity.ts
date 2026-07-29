/**
 * Severidade informativa (S3.1) — nunca decide execucao.
 */
export const SIGNAL_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export type SignalSeverity = (typeof SIGNAL_SEVERITIES)[number];

export function severityForGitHubSignalType(type: string): SignalSeverity {
  switch (type) {
    case "github.pr.updated":
    case "github.push":
      return "LOW";
    case "github.pr.opened":
    case "github.pr.merged":
    case "github.pr.closed":
    case "github.issue.opened":
    case "github.issue.labeled":
    case "github.issue.closed":
      return "MEDIUM";
    default:
      return "LOW";
  }
}
