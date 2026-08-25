import { describe, expect, it, vi, beforeEach } from "vitest";
import { interpretDemandText } from "./demand-interpreter.js";
import { mapMissionStatusToExecution } from "./execution-projection.service.js";
import { MissionStatus } from "@operaia/database";

describe("interpretDemandText", () => {
  it("marca risco CRITICAL e exige aprovação humana", () => {
    const result = interpretDemandText({
      text: "Fazer deploy em produção agora",
      workspaceId: "operaia-lab",
      demandId: "d-1",
    });
    expect(result.brief.risk).toBe("CRITICAL");
    expect(result.brief.autonomy).toBe("HUMAN_APPROVAL");
    expect(result.targetStatus).toBe("AWAITING_APPROVAL");
    expect(result.approvalNeeded).toBe(true);
    expect(result.plan.steps.length).toBeGreaterThan(0);
  });

  it("não inclui campos de reasoning interno", () => {
    const result = interpretDemandText({
      text: "Organizar backlog do workspace",
      workspaceId: "nexo",
      demandId: "d-2",
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/prompt|token|chain-of-thought|hidden/i);
  });
});

describe("mapMissionStatusToExecution", () => {
  it("mapeia status Core para projeção Office", () => {
    expect(mapMissionStatusToExecution(MissionStatus.CREATED)).toBe("PENDING");
    expect(mapMissionStatusToExecution(MissionStatus.RUNNING)).toBe("RUNNING");
    expect(mapMissionStatusToExecution(MissionStatus.WAITING)).toBe(
      "WAITING_APPROVAL",
    );
    expect(mapMissionStatusToExecution(MissionStatus.COMPLETED)).toBe("SUCCESS");
    expect(mapMissionStatusToExecution(MissionStatus.FAILED)).toBe("FAILED");
  });
});

describe("submitDemandToCore delegation (Opção A — mirror async)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function queuePort(enqueue: ReturnType<typeof vi.fn>) {
    return { enqueue, get: vi.fn(), listChildren: vi.fn() };
  }

  it("ACCEPT/EXECUTE → enqueue + bindExecute na mesma queue", async () => {
    const enqueue = vi.fn(async () => ({
      mission: { id: "mission-abc" },
      created: true,
    }));
    const admit = vi.fn(async () => ({
      decision: "EXECUTE",
      reason: "ok",
      resultingMissionId: null,
      workIdentity: "wi",
      contextFingerprint: null,
      ledgerId: "led-1",
      evidences: [],
    }));
    const bindExecute = vi.fn(async () => undefined);

    const { submitDemandToCore } = await import("./submit-demand-to-core.js");
    const result = await submitDemandToCore(
      queuePort(enqueue),
      { admit, bindExecute } as never,
      {
        workspaceId: "operaia-lab",
        objective: "Testar demanda",
        correlationId: "demand-1",
      },
    );

    expect(admit).toHaveBeenCalledOnce();
    expect(enqueue).toHaveBeenCalledOnce();
    expect(bindExecute).toHaveBeenCalledOnce();
    expect(bindExecute.mock.calls[0]?.[0]?.missionId).toBe("mission-abc");
    expect(result.missionId).toBe("mission-abc");
    expect(result.accepted).toBe(true);
    expect(result.gateDecision).toBe("EXECUTE");
  });

  it("SKIP/REUSE com resultingMissionId → reutiliza sem enqueue", async () => {
    const enqueue = vi.fn();
    const admit = vi.fn(async () => ({
      decision: "REUSE",
      reason: "prior_valid",
      resultingMissionId: "mission-prior",
      workIdentity: "wi",
      contextFingerprint: "fp",
      ledgerId: "led-2",
      evidences: [],
    }));
    const bindExecute = vi.fn();

    const { submitDemandToCore } = await import("./submit-demand-to-core.js");
    const result = await submitDemandToCore(
      queuePort(enqueue),
      { admit, bindExecute } as never,
      {
        workspaceId: "operaia-lab",
        objective: "Já feito",
        correlationId: "demand-reuse",
      },
    );

    expect(enqueue).not.toHaveBeenCalled();
    expect(bindExecute).not.toHaveBeenCalled();
    expect(result.missionId).toBe("mission-prior");
    expect(result.gateDecision).toBe("REUSE");
    expect(result.accepted).toBe(true);
  });

  it("SKIP sem resultingMissionId → enqueue + bindExecute (padrão Signal)", async () => {
    const enqueue = vi.fn(async () => ({
      mission: { id: "mission-new" },
      created: true,
    }));
    const admit = vi.fn(async () => ({
      decision: "SKIP",
      reason: "skip_without_mission",
      resultingMissionId: null,
      workIdentity: "wi",
      contextFingerprint: null,
      ledgerId: "led-3",
      evidences: [],
    }));
    const bindExecute = vi.fn(async () => undefined);

    const { submitDemandToCore } = await import("./submit-demand-to-core.js");
    const result = await submitDemandToCore(
      queuePort(enqueue),
      { admit, bindExecute } as never,
      {
        workspaceId: "operaia-lab",
        objective: "Skip sem id",
        correlationId: "demand-skip",
      },
    );

    expect(enqueue).toHaveBeenCalledOnce();
    expect(bindExecute).toHaveBeenCalledOnce();
    expect(result.missionId).toBe("mission-new");
    expect(result.gateDecision).toBe("SKIP");
  });

  it("propaga correlationId e contextHints integrais no admit", async () => {
    const enqueue = vi.fn(async () => ({
      mission: { id: "m-1" },
      created: true,
    }));
    const admit = vi.fn(async () => ({
      decision: "EXECUTE",
      reason: "ok",
      resultingMissionId: null,
      workIdentity: "wi",
      contextFingerprint: null,
      ledgerId: "led-4",
      evidences: [],
    }));
    const bindExecute = vi.fn(async () => undefined);

    const { submitDemandToCore } = await import("./submit-demand-to-core.js");
    await submitDemandToCore(queuePort(enqueue), { admit, bindExecute } as never, {
      workspaceId: "operaia-lab",
      objective: "Com hints",
      correlationId: "demand-hints",
      contextHints: {
        commitSha: "abc123",
        pullRequest: "42",
        repository: "operaia-lab",
        files: ["a.ts"],
        correlationId: "demand-hints",
      },
    });

    expect(admit).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: "demand-hints",
        contextHints: expect.objectContaining({
          commitSha: "abc123",
          pullRequest: "42",
          repository: "operaia-lab",
          files: ["a.ts"],
          correlationId: "demand-hints",
        }),
      }),
    );
  });

  it("preenche correlationId em contextHints quando ausente nos hints", async () => {
    const enqueue = vi.fn(async () => ({
      mission: { id: "m-2" },
      created: true,
    }));
    const admit = vi.fn(async () => ({
      decision: "EXECUTE",
      reason: "ok",
      resultingMissionId: null,
      workIdentity: "wi",
      contextFingerprint: null,
      ledgerId: "led-5",
      evidences: [],
    }));
    const bindExecute = vi.fn(async () => undefined);

    const { submitDemandToCore } = await import("./submit-demand-to-core.js");
    await submitDemandToCore(queuePort(enqueue), { admit, bindExecute } as never, {
      workspaceId: "nexo",
      objective: "hints parciais",
      correlationId: "demand-fill",
      contextHints: { issue: "99" },
    });

    expect(admit.mock.calls[0]?.[0]?.contextHints).toEqual({
      issue: "99",
      correlationId: "demand-fill",
    });
  });

  it("não faz double enqueue em SKIP/REUSE com missionId", async () => {
    const enqueue = vi.fn(async () => ({
      mission: { id: "should-not" },
      created: true,
    }));
    const admit = vi.fn(async () => ({
      decision: "SKIP",
      reason: "already_done",
      resultingMissionId: "mission-existing",
      workIdentity: "wi",
      contextFingerprint: "fp",
      ledgerId: "led-6",
      evidences: [],
    }));
    const bindExecute = vi.fn();

    const { submitDemandToCore } = await import("./submit-demand-to-core.js");
    await submitDemandToCore(queuePort(enqueue), { admit, bindExecute } as never, {
      workspaceId: "operaia-lab",
      objective: "dup",
      correlationId: "demand-dup",
    });
    await submitDemandToCore(queuePort(enqueue), { admit, bindExecute } as never, {
      workspaceId: "operaia-lab",
      objective: "dup",
      correlationId: "demand-dup",
    });

    expect(enqueue).not.toHaveBeenCalled();
    expect(bindExecute).not.toHaveBeenCalled();
  });

  it("propaga erro do gate sem enfileirar", async () => {
    const enqueue = vi.fn();
    const admit = vi.fn(async () => {
      throw new Error("gate_unavailable");
    });
    const bindExecute = vi.fn();

    const { submitDemandToCore } = await import("./submit-demand-to-core.js");
    await expect(
      submitDemandToCore(queuePort(enqueue), { admit, bindExecute } as never, {
        workspaceId: "operaia-lab",
        objective: "falha gate",
        correlationId: "demand-err",
      }),
    ).rejects.toThrow(/gate_unavailable/);

    expect(enqueue).not.toHaveBeenCalled();
    expect(bindExecute).not.toHaveBeenCalled();
  });
});

describe("DecisionTrace separation", () => {
  it("não confunde gate SKIP/REUSE/REOPEN/EXECUTE com DecisionTrace", () => {
    const gateDecisions = ["SKIP", "REUSE", "REOPEN", "EXECUTE"];
    const trace = interpretDemandText({
      text: "Revisar entregas",
      workspaceId: "operaia-lab",
      demandId: "d-3",
    });
    expect(trace.brief.objective).toBeTruthy();
    for (const gate of gateDecisions) {
      expect(trace.brief.objective).not.toBe(gate);
    }
  });
});
