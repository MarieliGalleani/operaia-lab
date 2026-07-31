/**
 * DelegationEngine — seleciona especialistas a partir do contexto da missao.
 * Separado da Opera: recomenda; a Opera valida e materializa delegacoes.
 */
import type { DelegationRequest } from "@operaia/employee-framework";
import { Specialization } from "@operaia/employee-framework";
import {
  DEFAULT_DELEGATION_MATRIX,
  matchDelegationPattern,
  type DelegationMatrixRule,
} from "./delegation-matrix.js";
import { inferDefaultEdges, type DelegationEdge } from "./ceo-strategic-plan.js";

export interface DelegationContext {
  readonly objective: string;
  readonly workspaceId?: string | null;
  readonly repository?: string | null;
  readonly affectedFiles?: readonly string[];
  readonly changeFields?: readonly string[];
  readonly changeReason?: string | null;
  readonly pendingTitles?: readonly string[];
}

export interface DelegationRecommendation {
  readonly specialization: Specialization;
  readonly reason: string;
  readonly task: string;
  readonly matchedRules: readonly string[];
  readonly matchedFiles: readonly string[];
}

export interface DelegationEngineResult {
  readonly ignored: boolean;
  readonly ignoreReason: string | null;
  readonly recommendations: readonly DelegationRecommendation[];
  readonly delegations: readonly DelegationRequest[];
  readonly edges: readonly DelegationEdge[];
  readonly specializations: readonly Specialization[];
}

export interface DelegationEngineOptions {
  readonly matrix?: readonly DelegationMatrixRule[];
}

const CHANGE_REASON_TECHNICAL = new Set([
  "technical_file_change",
  "pr_open_delta",
  "critical_issue",
]);

/**
 * Motor de recomendacao de especialistas (matriz configuravel).
 */
export class DelegationEngine {
  private readonly matrix: readonly DelegationMatrixRule[];

  constructor(options: DelegationEngineOptions = {}) {
    this.matrix = options.matrix ?? DEFAULT_DELEGATION_MATRIX;
  }

  recommend(context: DelegationContext): DelegationEngineResult {
    const parsed = enrichContext(context);
    const files = parsed.affectedFiles ?? [];

    if (files.length > 0) {
      const actionable = files.filter((file) => !this.isPureIgnorePath(file));

      if (actionable.length === 0) {
        return emptyResult("readme_or_docs_only");
      }

      return this.fromFiles(parsed, actionable);
    }

    // Sem arquivos: sinais de mudanca tecnica no motivo / changeFields
    if (
      parsed.changeReason &&
      CHANGE_REASON_TECHNICAL.has(parsed.changeReason)
    ) {
      return this.single(
        Specialization.SOFTWARE_ENGINEERING,
        `Motivo operacional: ${parsed.changeReason}`,
        parsed,
        "change-reason",
      );
    }

    if (
      (parsed.changeFields ?? []).some(
        (field) =>
          field === "lastCommitSha" ||
          field === "openPullRequestsCount" ||
          field === "openIssuesCount",
      )
    ) {
      return this.single(
        Specialization.SOFTWARE_ENGINEERING,
        "Mudanca operacional GitHub sem lista de arquivos.",
        parsed,
        "change-fields",
      );
    }

    return emptyResult(null);
  }

  /**
   * Opera valida a recomendacao (capacidade, dedupe, sem MANAGEMENT).
   */
  validate(
    result: DelegationEngineResult,
    options: {
      readonly saturatedSpecializations?: readonly string[];
      readonly maxDelegations?: number;
    } = {},
  ): DelegationEngineResult {
    if (result.ignored || result.recommendations.length === 0) {
      return result;
    }

    const saturated = new Set(
      (options.saturatedSpecializations ?? []).map((s) => s.toUpperCase()),
    );
    const max = options.maxDelegations ?? 8;
    const seen = new Set<Specialization>();
    const recommendations: DelegationRecommendation[] = [];

    for (const item of result.recommendations) {
      if (item.specialization === Specialization.MANAGEMENT) {
        continue;
      }
      if (saturated.has(item.specialization.toUpperCase())) {
        continue;
      }
      if (seen.has(item.specialization)) {
        continue;
      }
      seen.add(item.specialization);
      recommendations.push(item);
      if (recommendations.length >= max) {
        break;
      }
    }

    const specializations = recommendations.map((r) => r.specialization);
    return {
      ignored: recommendations.length === 0,
      ignoreReason:
        recommendations.length === 0 ? "filtered_by_validation" : null,
      recommendations,
      delegations: recommendations.map((r) => ({
        specialization: r.specialization,
        reason: r.reason,
        task: r.task,
      })),
      edges: inferDefaultEdges(specializations),
      specializations,
    };
  }

  private fromFiles(
    context: DelegationContext,
    files: readonly string[],
  ): DelegationEngineResult {
    const bySpec = new Map<
      Specialization,
      { rules: Set<string>; files: Set<string> }
    >();

    for (const file of files) {
      for (const rule of this.matrix) {
        if (rule.ignore) {
          continue;
        }
        if (!rule.patterns.some((pattern) => matchDelegationPattern(file, pattern))) {
          continue;
        }
        for (const spec of rule.specializations) {
          const entry = bySpec.get(spec) ?? {
            rules: new Set<string>(),
            files: new Set<string>(),
          };
          entry.rules.add(rule.id);
          entry.files.add(file);
          bySpec.set(spec, entry);
        }
      }
    }

    if (bySpec.size === 0) {
      // Arquivos nao cobertos pela matriz mas nao-docs → Mag default tecnico
      if (files.some((file) => !this.isPureIgnorePath(file))) {
        return this.single(
          Specialization.SOFTWARE_ENGINEERING,
          "Arquivo tecnico fora da matriz explicita.",
          context,
          "fallback-technical",
          files,
        );
      }
      return emptyResult("no_matrix_match");
    }

    const recommendations: DelegationRecommendation[] = [
      ...bySpec.entries(),
    ].map(([specialization, meta]) => ({
      specialization,
      reason: `Matriz de delegacao: regras ${[...meta.rules].join(", ")}.`,
      task: buildTask(specialization, context, [...meta.files]),
      matchedRules: [...meta.rules],
      matchedFiles: [...meta.files],
    }));

    const ordered = orderRecommendations(recommendations);
    const specializations = ordered.map((r) => r.specialization);

    return {
      ignored: false,
      ignoreReason: null,
      recommendations: ordered,
      delegations: ordered.map((r) => ({
        specialization: r.specialization,
        reason: r.reason,
        task: r.task,
      })),
      edges: inferDefaultEdges(specializations),
      specializations,
    };
  }

  private single(
    specialization: Specialization,
    reason: string,
    context: DelegationContext,
    ruleId: string,
    files: readonly string[] = [],
  ): DelegationEngineResult {
    const recommendation: DelegationRecommendation = {
      specialization,
      reason,
      task: buildTask(specialization, context, files),
      matchedRules: [ruleId],
      matchedFiles: [...files],
    };
    return {
      ignored: false,
      ignoreReason: null,
      recommendations: [recommendation],
      delegations: [
        {
          specialization,
          reason,
          task: recommendation.task,
        },
      ],
      edges: [],
      specializations: [specialization],
    };
  }

  private isPureIgnorePath(path: string): boolean {
    const ignoreRules = this.matrix.filter((rule) => rule.ignore);
    if (ignoreRules.length === 0) {
      return false;
    }
    const matchedIgnore = ignoreRules.some((rule) =>
      rule.patterns.some((pattern) => matchDelegationPattern(path, pattern)),
    );
    if (!matchedIgnore) {
      return false;
    }
    return !this.hasTechnicalRule(path);
  }

  private hasTechnicalRule(path: string): boolean {
    return this.matrix.some(
      (rule) =>
        !rule.ignore &&
        rule.specializations.length > 0 &&
        rule.patterns.some((pattern) => matchDelegationPattern(path, pattern)),
    );
  }
}

function emptyResult(reason: string | null): DelegationEngineResult {
  return {
    ignored: true,
    ignoreReason: reason,
    recommendations: [],
    delegations: [],
    edges: [],
    specializations: [],
  };
}

function buildTask(
  specialization: Specialization,
  context: DelegationContext,
  files: readonly string[],
): string {
  const repo = context.repository ? ` repo=${context.repository}` : "";
  const fileList =
    files.length > 0 ? ` arquivos=${files.slice(0, 8).join(", ")}` : "";
  return (
    `Analisar e executar como ${specialization} no workspace` +
    `${context.workspaceId ? ` ${context.workspaceId}` : ""}${repo}${fileList}. ` +
    `Objetivo: ${context.objective.slice(0, 240)}`
  );
}

const SPEC_ORDER: readonly Specialization[] = [
  Specialization.SOFTWARE_ENGINEERING,
  Specialization.PRODUCT_DESIGN,
  Specialization.PRODUCT_MANAGEMENT,
  Specialization.AUTOMATION,
  Specialization.LEGAL,
  Specialization.MARKETING,
  Specialization.FINANCE,
  Specialization.OPERATIONS,
];

function orderRecommendations(
  items: readonly DelegationRecommendation[],
): readonly DelegationRecommendation[] {
  return [...items].sort(
    (a, b) =>
      SPEC_ORDER.indexOf(a.specialization) -
      SPEC_ORDER.indexOf(b.specialization),
  );
}

/**
 * Extrai contexto de delegacao do objective SIGNAL / texto livre.
 */
export function parseDelegationContextFromObjective(
  objective: string,
  extras: Partial<DelegationContext> = {},
): DelegationContext {
  const workspaceId =
    extras.workspaceId ??
    capture(objective, /workspace=([^\s·]+)/i) ??
    null;
  const repository =
    extras.repository ??
    capture(objective, /repository=([^\s·]+)/i) ??
    null;
  const changeReason =
    extras.changeReason ??
    capture(objective, /motivo=([^\s·]+)/i) ??
    null;
  const mudanca = capture(objective, /mudanca=([^·]+?)(?:\s·|$)/i);
  const arquivos = capture(objective, /arquivos=([^·]+?)(?:\s·|$)/i);

  const changeFields =
    extras.changeFields ??
    (mudanca
      ? mudanca
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : []);

  let affectedFiles = extras.affectedFiles ?? [];
  if (affectedFiles.length === 0 && arquivos && arquivos !== "n/a") {
    affectedFiles = arquivos
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item && item !== "n/a");
  }

  return {
    objective,
    workspaceId,
    repository,
    affectedFiles,
    changeFields,
    changeReason,
    pendingTitles: extras.pendingTitles,
  };
}

function enrichContext(context: DelegationContext): DelegationContext {
  if (
    (context.affectedFiles?.length ?? 0) > 0 ||
    (context.changeFields?.length ?? 0) > 0 ||
    context.changeReason
  ) {
    return {
      ...context,
      affectedFiles: context.affectedFiles ?? [],
      changeFields: context.changeFields ?? [],
    };
  }
  return parseDelegationContextFromObjective(context.objective, context);
}

function capture(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match?.[1]?.trim() || null;
}

/** Instancia default compartilhada. */
export const defaultDelegationEngine = new DelegationEngine();
