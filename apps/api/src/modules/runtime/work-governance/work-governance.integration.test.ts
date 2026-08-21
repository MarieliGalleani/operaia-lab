/**
 * Integração Assisted + Signal converter com AlreadyDoneGate (sem Prisma).
 */
import { describe, expect, it, vi } from "vitest";
import { Specialization } from "@operaia/employee-framework";
import { createLabRuntime } from "../../operations/lab-runtime.js";
import type { AssistedMissionQueuePort } from "../../operations/operational-mission-service.js";
import type { QueueMissionNode } from "../../operations/operational-run-from-queue.js";
import { CEO_EMPLOYEE_ID } from "../mission-states.js";
import { enqueueSignalCoordinateMission } from "../signal-mission-converter.js";
import { AlreadyDoneGate } from "./already-done-gate.js";
import { InMemoryWorkGovernanceLedger } from "./decision-ledger.js";
import { InMemoryPriorMissionLookup } from "./prior-mission-lookup.js";
import type { DomainSignalRecord } from "@operaia/domain-signals";

function ceoCompleted(id: string, objective: string): QueueMissionNode {
  const stored = {
    employeeId: CEO_EMPLOYEE_ID,
    output: {
      decision: {
        analyzed: "a",
        decision: "d",
        reasoning: "r",
        recommendations: [],
        risks: [],
        nextActions: [],
        delegations: [
          {
            specialization: Specialization.SOFTWARE_ENGINEERING,
            reason: "tech",
            task: "t",
          },
        ],
      },
      report: {
        summary: "ok",
        analysis: "a",
        plan: [],
        recommendations: [],
        risks: [],
        nextActions: [],
      },
      quality: { passed: true, issues: [] },
    },
  };
  return {
    id,
    workspaceId: "nexo",
    objective,
    missionKind: "COORDINATE",
    status: "COMPLETED",
    ownerEmployeeId: CEO_EMPLOYEE_ID,
    requiredSpecialization: null,
    parentMissionId: null,
    startedAt: new Date(),
    finishedAt: new Date(),
    resultJson: {
      phase: "consolidated",
      initial: stored,
      usableResult: "ok",
      final: stored,
      timing: { ceoMs: 1, specialistMs: 1, consolidationMs: 1, totalMs: 3 },
    },
  };
}

describe("Work Governance integration", () => {
  it("Assisted: Gate SKIP nao chama enqueue", async () => {
    const ledger = new InMemoryWorkGovernanceLedger();
    const missions = new InMemoryPriorMissionLookup();
    const gate = new AlreadyDoneGate({ ledger, missions });

    const objective =
      "[MISSION_INTENT] TECH_IMPLEMENTATION|employee:cto-mag|confidence:0.90\n\nimplementar autenticacao nexo";
    const hints = { commitSha: "abc1234", files: ["a.ts"] };

    const admit = await gate.admit({
      workspaceId: "nexo",
      objective,
      source: "assisted",
      missionKind: "COORDINATE",
      contextHints: hints,
      correlationId: "int-a1",
    });
    await gate.bindExecute({
      admit,
      request: {
        workspaceId: "nexo",
        objective,
        source: "assisted",
        missionKind: "COORDINATE",
        contextHints: hints,
        correlationId: "int-a1",
      },
      missionId: "mission-prior",
    });
    missions.seed({
      id: "mission-prior",
      workspaceId: "nexo",
      status: "COMPLETED",
      missionKind: "COORDINATE",
      objective,
      parentMissionId: null,
      resultJson: {},
    });
    missions.seed({
      id: "mission-prior-exec",
      workspaceId: "nexo",
      status: "COMPLETED",
      missionKind: "EXECUTE",
      objective: "t",
      parentMissionId: "mission-prior",
      resultJson: {
        delivery: {
          type: "technical_analysis",
          status: "DELIVERED",
          evidence: [{ source: "t", data: {} }],
        },
      },
    });

    const enqueue = vi.fn(async () => ({
      mission: { id: "should-not-create" },
      created: true,
    }));
    const queue: AssistedMissionQueuePort = {
      enqueue,
      async get(id) {
        return ceoCompleted(id, objective);
      },
      async listChildren() {
        return [];
      },
    };

    const lab = createLabRuntime({
      deterministic: true,
      preferQueue: true,
      missionQueue: queue,
      workGovernanceGate: gate,
      missionWait: { timeoutMs: 50, pollIntervalMs: 10 },
    });

    const run = await lab.operations.service.runViaQueue({
      workspaceId: "nexo",
      objective,
      contextHints: hints,
      correlationId: "int-a2",
    });

    expect(enqueue).not.toHaveBeenCalled();
    expect(run.id).toBe("mission-prior");
    expect(run.status).toBe("completed");
  });

  it("Signal: Gate SKIP retorna missionId existente", async () => {
    const ledger = new InMemoryWorkGovernanceLedger();
    const missions = new InMemoryPriorMissionLookup();
    const gate = new AlreadyDoneGate({ ledger, missions });

    const signal = {
      id: "signal-new",
      workspaceId: "nexo",
      sourceType: "github",
      sourceId: "abc1234deadbeef",
      type: "github.repo.snapshot.changed",
      status: "EVALUATED",
      deliveryId: "d-new",
      correlationId: "corr-new",
      payloadJson: {
        repository: "acme/nexo",
        lastCommitSha: "abc1234deadbeef",
        affectedFiles: ["apps/api/src/foo.ts"],
        changeFields: ["lastCommitSha"],
      },
      evaluationDecision: "CONVERT_CANDIDATE",
      evaluationReason: "technical_file_change",
      evaluationPolicy: "github-default@2",
      evaluationJson: null,
      missionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as DomainSignalRecord;

    const objectiveStub =
      "[COORDINATE/SIGNAL] github.repo.snapshot.changed · workspace=nexo · " +
      "repository=acme/nexo · mudanca=lastCommitSha · " +
      "arquivos=apps/api/src/foo.ts · motivo=technical_file_change · " +
      "source=abc1234deadbeef · sha=abc1234deadbeef · correlation=c · delivery=d";

    const firstAdmit = await gate.admit({
      workspaceId: "nexo",
      objective: objectiveStub,
      source: "signal",
      missionKind: "COORDINATE",
      contextHints: {
        commitSha: "abc1234deadbeef",
        files: ["apps/api/src/foo.ts"],
        repository: "acme/nexo",
      },
      correlationId: "signal-prior",
    });
    await gate.bindExecute({
      admit: firstAdmit,
      request: {
        workspaceId: "nexo",
        objective: objectiveStub,
        source: "signal",
        missionKind: "COORDINATE",
        contextHints: {
          commitSha: "abc1234deadbeef",
          files: ["apps/api/src/foo.ts"],
          repository: "acme/nexo",
        },
        correlationId: "signal-prior",
      },
      missionId: "mission-sig-prior",
    });
    missions.seed({
      id: "mission-sig-prior",
      workspaceId: "nexo",
      status: "COMPLETED",
      missionKind: "COORDINATE",
      objective: objectiveStub,
      parentMissionId: null,
      resultJson: {},
    });
    missions.seed({
      id: "mission-sig-exec",
      workspaceId: "nexo",
      status: "COMPLETED",
      missionKind: "EXECUTE",
      objective: "t",
      parentMissionId: "mission-sig-prior",
      resultJson: {
        delivery: {
          type: "technical_analysis",
          status: "DELIVERED",
          evidence: [{ source: "t", data: {} }],
        },
      },
    });

    const enqueue = vi.fn();
    const missionId = await enqueueSignalCoordinateMission({
      queue: { enqueue } as never,
      signal,
      gate,
    });

    expect(enqueue).not.toHaveBeenCalled();
    expect(missionId).toBe("mission-sig-prior");
  });
});
