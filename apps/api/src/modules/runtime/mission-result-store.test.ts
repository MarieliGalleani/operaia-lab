import { describe, expect, it } from "vitest";
import { CEO_EMPLOYEE_ID } from "./mission-states.js";
import {
  mergeConsolidatePreservingInitial,
  type ConsolidatePhaseResult,
  type CoordinatePhaseResult,
  type StoredEmployeeResult,
} from "./mission-result-store.js";

function stored(
  overrides: Partial<StoredEmployeeResult["output"]["decision"]> = {},
): StoredEmployeeResult {
  return {
    employeeId: CEO_EMPLOYEE_ID,
    output: {
      decision: {
        analyzed: "analise",
        decision: "delegar",
        reasoning: "motivo",
        recommendations: [],
        risks: [],
        nextActions: [],
        delegations: [
          {
            specialization: "SOFTWARE_ENGINEERING" as never,
            reason: "auth",
            task: "implementar auth",
          },
        ],
        ...overrides,
      },
      report: {
        summary: "resumo inicial",
        analysis: "a",
        plan: [],
        recommendations: [],
        risks: [],
        nextActions: [],
      },
      quality: { passed: true, issues: [] },
    },
  };
}

describe("mergeConsolidatePreservingInitial (ADR-007 Fase 2.1)", () => {
  it("Caso 1 — sem initial previo: consolidado permanece completo (sem delegacao)", () => {
    const initial = stored({
      decision: "responder",
      delegations: [],
    });
    const incoming: ConsolidatePhaseResult = {
      phase: "consolidated",
      initial,
      usableResult: "resumo inicial",
      final: initial,
      timing: { ceoMs: 0, specialistMs: 0, consolidationMs: 0, totalMs: 10 },
    };

    const merged = mergeConsolidatePreservingInitial(null, incoming);
    expect(merged.phase).toBe("consolidated");
    expect(merged.final).toEqual(initial);
    expect(merged.initial).toEqual(initial);
    expect(merged.usableResult).toBe("resumo inicial");
  });

  it("Caso 2 — com COORDINATE waiting: preserva initial e final apos consolidate", () => {
    const coordinatedInitial = stored();
    const previous: CoordinatePhaseResult = {
      phase: "coordinated",
      initial: coordinatedInitial,
    };
    const finalStored = stored({
      decision: "consolidar",
      analyzed: "apos especialistas",
      delegations: [],
    });
    const incoming: ConsolidatePhaseResult = {
      phase: "consolidated",
      usableResult: "entrega final",
      final: finalStored,
      timing: { ceoMs: 0, specialistMs: 40, consolidationMs: 20, totalMs: 60 },
    };

    const merged = mergeConsolidatePreservingInitial(previous, incoming);

    expect(merged.phase).toBe("consolidated");
    expect(merged.initial).toEqual(coordinatedInitial);
    expect(merged.final).toEqual(finalStored);
    expect(merged.initial?.output.decision.delegations).toHaveLength(1);
    expect(merged.initial?.output.decision.delegations[0]?.task).toBe(
      "implementar auth",
    );
    expect(merged.usableResult).toBe("entrega final");
  });

  it("nao sobrescreve initial ja presente no payload consolidado", () => {
    const fromPayload = stored({ decision: "do-payload" });
    const fromRoot = stored({ decision: "da-raiz" });
    const merged = mergeConsolidatePreservingInitial(
      { phase: "coordinated", initial: fromRoot },
      {
        phase: "consolidated",
        initial: fromPayload,
        usableResult: "ok",
        final: fromPayload,
      },
    );
    expect(merged.initial?.output.decision.decision).toBe("do-payload");
  });

  it("re-merge idempotente se raiz ja estava consolidated com initial", () => {
    const initial = stored();
    const previous: ConsolidatePhaseResult = {
      phase: "consolidated",
      initial,
      usableResult: "old",
      final: initial,
    };
    const nextFinal = stored({ decision: "novo-final", delegations: [] });
    const merged = mergeConsolidatePreservingInitial(previous, {
      phase: "consolidated",
      usableResult: "new",
      final: nextFinal,
    });
    expect(merged.initial).toEqual(initial);
    expect(merged.final).toEqual(nextFinal);
  });
});
