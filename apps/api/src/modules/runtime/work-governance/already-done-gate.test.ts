/**
 * Testes unitários do AlreadyDoneGate (contrato Work Governance).
 */
import { describe, expect, it } from "vitest";
import { AlreadyDoneGate } from "./already-done-gate.js";
import { InMemoryWorkGovernanceLedger } from "./decision-ledger.js";
import { InMemoryPriorMissionLookup } from "./prior-mission-lookup.js";
import type { GovernanceMissionSnapshot, WorkContextHints } from "./types.js";

function createGate() {
  const ledger = new InMemoryWorkGovernanceLedger();
  const missions = new InMemoryPriorMissionLookup();
  return {
    ledger,
    missions,
    gate: new AlreadyDoneGate({ ledger, missions }),
  };
}

function validExecuteChild(parentId: string): GovernanceMissionSnapshot {
  return {
    id: `${parentId}-exec`,
    workspaceId: "nexo",
    status: "COMPLETED",
    missionKind: "EXECUTE",
    objective: "implementar autenticacao",
    parentMissionId: parentId,
    resultJson: {
      phase: "executed",
      delivery: {
        type: "technical_analysis",
        status: "DELIVERED",
        missionId: `${parentId}-exec`,
        employeeId: "cto-mag",
        objective: "implementar autenticacao",
        summary: "ok",
        findings: ["a"],
        evidence: [{ source: "tool", data: { ok: true } }],
        recommendations: [],
        deliveredAt: new Date().toISOString(),
      },
    },
  };
}

async function materializeValid(
  bundle: ReturnType<typeof createGate>,
  input: {
    readonly objective: string;
    readonly hints: WorkContextHints;
    readonly correlationId: string;
    readonly rootId: string;
    readonly source?: "assisted" | "signal";
  },
): Promise<void> {
  const request = {
    workspaceId: "nexo",
    objective: input.objective,
    source: input.source ?? ("assisted" as const),
    missionKind: "COORDINATE",
    contextHints: input.hints,
    correlationId: input.correlationId,
  };
  const admit = await bundle.gate.admit(request);
  expect(admit.decision).toBe("EXECUTE");
  await bundle.gate.bindExecute({
    admit,
    request,
    missionId: input.rootId,
  });
  bundle.missions.seed({
    id: input.rootId,
    workspaceId: "nexo",
    status: "COMPLETED",
    missionKind: "COORDINATE",
    objective: input.objective,
    parentMissionId: null,
    resultJson: {},
  });
  bundle.missions.seed(validExecuteChild(input.rootId));
}

const techObjective =
  "[MISSION_INTENT] TECH_IMPLEMENTATION|employee:cto-mag|confidence:0.90\n\nimplementar autenticacao nexo";

const signalObjective =
  "[COORDINATE/SIGNAL] github.repo.snapshot.changed · workspace=nexo · " +
  "repository=acme/nexo · mudanca=lastCommitSha · " +
  "arquivos=apps/api/src/foo.ts · motivo=technical_file_change · " +
  "source=abc1234 · sha=abc1234deadbeef · correlation=c1 · delivery=d1";

describe("AlreadyDoneGate", () => {
  it("TESTE 1 — nunca executado → EXECUTE", async () => {
    const { gate } = createGate();
    const admit = await gate.admit({
      workspaceId: "nexo",
      objective: techObjective,
      source: "assisted",
      missionKind: "COORDINATE",
      contextHints: { commitSha: "abc1234", files: ["apps/api/a.ts"] },
    });
    expect(admit.decision).toBe("EXECUTE");
    expect(admit.reason).toMatch(/no_valid_prior/);
  });

  it("TESTE 2 — COMPLETED sem delivery → EXECUTE", async () => {
    const bundle = createGate();
    const hints = { commitSha: "abc1234", files: ["apps/api/a.ts"] };
    const first = await bundle.gate.admit({
      workspaceId: "nexo",
      objective: techObjective,
      source: "assisted",
      missionKind: "COORDINATE",
      contextHints: hints,
      correlationId: "t2-a",
    });
    await bundle.gate.bindExecute({
      admit: first,
      request: {
        workspaceId: "nexo",
        objective: techObjective,
        source: "assisted",
        missionKind: "COORDINATE",
        contextHints: hints,
        correlationId: "t2-a",
      },
      missionId: "root-nodelivery",
    });
    bundle.missions.seed({
      id: "root-nodelivery",
      workspaceId: "nexo",
      status: "COMPLETED",
      missionKind: "COORDINATE",
      objective: techObjective,
      parentMissionId: null,
      resultJson: { usableResult: "sem delivery" },
    });

    const second = await bundle.gate.admit({
      workspaceId: "nexo",
      objective: techObjective,
      source: "assisted",
      missionKind: "COORDINATE",
      contextHints: hints,
      correlationId: "t2-b",
    });
    expect(second.decision).toBe("EXECUTE");
  });

  it("TESTE 3 — delivery FAILED → EXECUTE", async () => {
    const bundle = createGate();
    const hints = { commitSha: "abc1234", files: ["a.ts"] };
    const first = await bundle.gate.admit({
      workspaceId: "nexo",
      objective: techObjective,
      source: "assisted",
      missionKind: "COORDINATE",
      contextHints: hints,
      correlationId: "t3-a",
    });
    await bundle.gate.bindExecute({
      admit: first,
      request: {
        workspaceId: "nexo",
        objective: techObjective,
        source: "assisted",
        missionKind: "COORDINATE",
        contextHints: hints,
        correlationId: "t3-a",
      },
      missionId: "root-failed-delivery",
    });
    bundle.missions.seed({
      id: "root-failed-delivery",
      workspaceId: "nexo",
      status: "COMPLETED",
      missionKind: "COORDINATE",
      objective: techObjective,
      parentMissionId: null,
      resultJson: {},
    });
    bundle.missions.seed({
      id: "exec-failed",
      workspaceId: "nexo",
      status: "COMPLETED",
      missionKind: "EXECUTE",
      objective: "x",
      parentMissionId: "root-failed-delivery",
      resultJson: {
        delivery: {
          type: "technical_analysis",
          status: "FAILED",
          evidence: [{ source: "t", data: {} }],
        },
      },
    });

    const second = await bundle.gate.admit({
      workspaceId: "nexo",
      objective: techObjective,
      source: "assisted",
      missionKind: "COORDINATE",
      contextHints: hints,
      correlationId: "t3-b",
    });
    expect(second.decision).toBe("EXECUTE");
  });

  it("TESTE 4 — ValidResult + mesmo contexto → SKIP", async () => {
    const bundle = createGate();
    const hints = { commitSha: "abc1234", files: ["apps/api/a.ts"] };
    await materializeValid(bundle, {
      objective: techObjective,
      hints,
      correlationId: "t4-a",
      rootId: "root-ok",
    });

    const second = await bundle.gate.admit({
      workspaceId: "nexo",
      objective: techObjective,
      source: "assisted",
      missionKind: "COORDINATE",
      contextHints: hints,
      correlationId: "t4-b",
    });
    expect(second.decision).toBe("SKIP");
    expect(second.resultingMissionId).toBe("root-ok");
  });

  it("TESTE 5 — mesmo trabalho + SHA diferente → EXECUTE", async () => {
    const bundle = createGate();
    await materializeValid(bundle, {
      objective: techObjective,
      hints: { commitSha: "aaaaaaaa", files: ["a.ts"] },
      correlationId: "t5-a",
      rootId: "root-sha1",
    });

    const second = await bundle.gate.admit({
      workspaceId: "nexo",
      objective: techObjective,
      source: "assisted",
      missionKind: "COORDINATE",
      contextHints: { commitSha: "bbbbbbbb", files: ["a.ts"] },
      correlationId: "t5-b",
    });
    expect(second.decision).toBe("EXECUTE");
  });

  it("TESTE 6 — arquivos diferentes → EXECUTE", async () => {
    const bundle = createGate();
    await materializeValid(bundle, {
      objective: techObjective,
      hints: { commitSha: "abc1234", files: ["a.ts"] },
      correlationId: "t6-a",
      rootId: "root-files",
    });

    const second = await bundle.gate.admit({
      workspaceId: "nexo",
      objective: techObjective,
      source: "assisted",
      missionKind: "COORDINATE",
      contextHints: { commitSha: "abc1234", files: ["b.ts"] },
      correlationId: "t6-b",
    });
    expect(second.decision).toBe("EXECUTE");
  });

  it("TESTE 7 — WorkIdentity diferente → EXECUTE", async () => {
    const bundle = createGate();
    const hints = { commitSha: "abc1234", files: ["a.ts"] };
    await materializeValid(bundle, {
      objective: techObjective,
      hints,
      correlationId: "t7-a",
      rootId: "root-other",
    });

    const otherObjective =
      "[MISSION_INTENT] TECH_IMPLEMENTATION|employee:cto-mag|confidence:0.90\n\nimplementar pagamento stripe";
    const second = await bundle.gate.admit({
      workspaceId: "nexo",
      objective: otherObjective,
      source: "assisted",
      missionKind: "COORDINATE",
      contextHints: hints,
      correlationId: "t7-b",
    });
    expect(second.decision).toBe("EXECUTE");
  });

  it("TESTE 8 — contexto insuficiente → EXECUTE", async () => {
    const { gate } = createGate();
    const admit = await gate.admit({
      workspaceId: "nexo",
      objective: techObjective,
      source: "assisted",
      missionKind: "COORDINATE",
    });
    expect(admit.decision).toBe("EXECUTE");
    expect(admit.reason).toBe("insufficient_context");
  });

  it("TESTE 9 — COORDINATE sem delegation → EXECUTE", async () => {
    const bundle = createGate();
    const hints = { commitSha: "abc1234", files: ["a.ts"] };
    const first = await bundle.gate.admit({
      workspaceId: "nexo",
      objective: techObjective,
      source: "assisted",
      missionKind: "COORDINATE",
      contextHints: hints,
      correlationId: "t9-a",
    });
    await bundle.gate.bindExecute({
      admit: first,
      request: {
        workspaceId: "nexo",
        objective: techObjective,
        source: "assisted",
        missionKind: "COORDINATE",
        contextHints: hints,
        correlationId: "t9-a",
      },
      missionId: "root-nodeleg",
    });
    bundle.missions.seed({
      id: "root-nodeleg",
      workspaceId: "nexo",
      status: "COMPLETED",
      missionKind: "COORDINATE",
      objective: techObjective,
      parentMissionId: null,
      resultJson: {
        phase: "finishWithoutDelegation",
        usableResult: "CEO sozinha",
      },
    });

    const second = await bundle.gate.admit({
      workspaceId: "nexo",
      objective: techObjective,
      source: "assisted",
      missionKind: "COORDINATE",
      contextHints: hints,
      correlationId: "t9-b",
    });
    expect(second.decision).toBe("EXECUTE");
  });

  it("TESTE 10 — Assisted dedupe:false nao impede Gate", async () => {
    const bundle = createGate();
    const hints = { commitSha: "abc1234", files: ["a.ts"] };
    await materializeValid(bundle, {
      objective: techObjective,
      hints,
      correlationId: "t10-a",
      rootId: "root-dedupe-false",
    });

    const second = await bundle.gate.admit({
      workspaceId: "nexo",
      objective: techObjective,
      source: "assisted",
      missionKind: "COORDINATE",
      contextHints: hints,
      correlationId: "t10-b",
    });
    expect(second.decision).toBe("SKIP");
  });

  it("TESTE 11 — Signal mesmo SHA → SKIP", async () => {
    const bundle = createGate();
    const hints = {
      commitSha: "abc1234deadbeef",
      files: ["apps/api/src/foo.ts"],
      repository: "acme/nexo",
    };
    await materializeValid(bundle, {
      objective: signalObjective,
      hints,
      correlationId: "sig-1",
      rootId: "root-sig",
      source: "signal",
    });

    const second = await bundle.gate.admit({
      workspaceId: "nexo",
      objective: signalObjective,
      source: "signal",
      missionKind: "COORDINATE",
      contextHints: hints,
      correlationId: "sig-2",
    });
    expect(second.decision).toBe("SKIP");
  });

  it("TESTE 12 — Signal SHA novo → EXECUTE", async () => {
    const bundle = createGate();
    await materializeValid(bundle, {
      objective: signalObjective,
      hints: {
        commitSha: "aaaaaaaa",
        files: ["apps/api/src/foo.ts"],
        repository: "acme/nexo",
      },
      correlationId: "sig-sha-a",
      rootId: "root-sig-sha",
      source: "signal",
    });

    const second = await bundle.gate.admit({
      workspaceId: "nexo",
      objective: signalObjective,
      source: "signal",
      missionKind: "COORDINATE",
      contextHints: {
        commitSha: "bbbbbbbb",
        files: ["apps/api/src/foo.ts"],
        repository: "acme/nexo",
      },
      correlationId: "sig-sha-b",
    });
    expect(second.decision).toBe("EXECUTE");
  });

  it("TESTE 13 — forceExecute → EXECUTE + ledger override", async () => {
    const bundle = createGate();
    const hints = { commitSha: "abc1234", files: ["a.ts"] };
    await materializeValid(bundle, {
      objective: techObjective,
      hints,
      correlationId: "t13-a",
      rootId: "root-force",
    });

    const forced = await bundle.gate.admit({
      workspaceId: "nexo",
      objective: techObjective,
      source: "assisted",
      missionKind: "COORDINATE",
      contextHints: hints,
      correlationId: "t13-force",
      forceExecute: true,
    });
    expect(forced.decision).toBe("EXECUTE");
    expect(forced.reason).toBe("force_execute_override");

    await bundle.gate.bindExecute({
      admit: forced,
      request: {
        workspaceId: "nexo",
        objective: techObjective,
        source: "assisted",
        missionKind: "COORDINATE",
        contextHints: hints,
        correlationId: "t13-force",
        forceExecute: true,
      },
      missionId: "root-forced-new",
    });

    const override = await bundle.ledger.findByCorrelationId("t13-force");
    expect(override?.forceExecute).toBe(true);
    expect(override?.reason).toBe("force_execute_override");
  });
});
