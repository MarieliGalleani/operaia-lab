import { beforeEach, describe, expect, it, vi } from "vitest";
import { MissionKind, MissionStatus } from "@operaia/database";

const prismaMock = vi.hoisted(() => ({
  officeDemand: {
    findFirst: vi.fn(),
  },
  workGovernanceDecision: {
    findFirst: vi.fn(),
  },
  mission: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  missionEvent: {
    findMany: vi.fn(),
  },
}));

vi.mock("@operaia/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@operaia/database")>();
  return {
    ...actual,
    prisma: prismaMock,
  };
});

vi.mock("./demand.service.js", () => ({
  reconcileDemandFromMission: vi.fn(async (demand: { id: string }) => ({
    demand,
    changed: false,
    reason: "already_synced",
  })),
}));

vi.mock("./workspace-catalog.js", () => ({
  assertOfficialWorkspace: vi.fn(),
  officialWorkspaceFilter: vi.fn(() => ({})),
  resolveWorkspaceName: vi.fn((id: string) => id),
}));

describe("buildAutonomyLoopEvidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prova Delegation via parentMissionId/children EXECUTE", async () => {
    prismaMock.officeDemand.findFirst.mockResolvedValue({
      id: "demand-1",
      workspaceId: "operaia-lab",
      status: "EXECUTING",
      objective: "Automação Cliente X",
      planJson: { demandId: "demand-1", steps: [{ id: "s1" }] },
      missionId: "root-1",
      approvals: [],
    });
    prismaMock.workGovernanceDecision.findFirst.mockResolvedValue({
      decision: "EXECUTE",
      reason: "no prior",
      resultingMissionId: "root-1",
      createdAt: new Date(),
    });
    prismaMock.mission.findUnique.mockResolvedValue({
      id: "root-1",
      workspaceId: "operaia-lab",
      status: MissionStatus.WAITING,
      missionKind: MissionKind.COORDINATE,
      resultJson: null,
      parentMissionId: null,
      objective: "Automação Cliente X",
    });
    prismaMock.mission.findMany.mockResolvedValue([
      {
        id: "child-1",
        workspaceId: "operaia-lab",
        status: MissionStatus.COMPLETED,
        missionKind: MissionKind.EXECUTE,
        resultJson: {
          delivery: {
            type: "technical_analysis",
            status: "DELIVERED",
            evidence: [{ kind: "note", data: {} }],
          },
        },
        parentMissionId: "root-1",
        objective: "exec",
      },
    ]);
    prismaMock.missionEvent.findMany.mockResolvedValue([
      {
        id: "ev-1",
        missionId: "child-1",
        type: "delivery_created",
        createdAt: new Date(),
      },
      {
        id: "ev-2",
        missionId: "child-1",
        type: "tool_used",
        createdAt: new Date(),
      },
    ]);

    const { buildAutonomyLoopEvidence } = await import(
      "./autonomy-loop-evidence.js"
    );
    const evidence = await buildAutonomyLoopEvidence("demand-1");

    expect(evidence.correlationId).toBe("demand-1");
    expect(evidence.missionId).toBe("root-1");
    expect(evidence.gateDecision).toBe("EXECUTE");

    const byStage = Object.fromEntries(
      evidence.stages.map((s) => [s.stage, s]),
    );
    expect(byStage.intake?.present).toBe(true);
    expect(byStage.planning?.present).toBe(true);
    expect(byStage.delegation?.present).toBe(true);
    expect(byStage.mission?.present).toBe(true);
    expect(byStage.execution?.present).toBe(true);
    expect(byStage.delivery?.present).toBe(true);
    expect(byStage.validation?.present).toBe(true);
    expect(evidence.loopEvidenceComplete).toBe(true);

    expect(byStage.delegation?.details).toMatchObject({
      parentMissionId: "root-1",
    });
  });

  it("documenta ausência de Delegation quando COORDINATE completa sem children", async () => {
    prismaMock.officeDemand.findFirst.mockResolvedValue({
      id: "demand-2",
      workspaceId: "operaia-lab",
      status: "COMPLETED",
      objective: "Só plano",
      planJson: { demandId: "demand-2", steps: [] },
      missionId: "root-2",
      approvals: [],
    });
    prismaMock.workGovernanceDecision.findFirst.mockResolvedValue(null);
    prismaMock.mission.findUnique.mockResolvedValue({
      id: "root-2",
      workspaceId: "operaia-lab",
      status: MissionStatus.COMPLETED,
      missionKind: MissionKind.COORDINATE,
      resultJson: {
        delivery: {
          type: "technical_analysis",
          status: "DELIVERED",
          evidence: [{ kind: "note", data: {} }],
        },
      },
      parentMissionId: null,
      objective: "Só plano",
    });
    prismaMock.mission.findMany.mockResolvedValue([]);
    prismaMock.missionEvent.findMany.mockResolvedValue([
      {
        id: "ev-d",
        missionId: "root-2",
        type: "delivery_created",
        createdAt: new Date(),
      },
    ]);

    const { buildAutonomyLoopEvidence } = await import(
      "./autonomy-loop-evidence.js"
    );
    const evidence = await buildAutonomyLoopEvidence("demand-2");
    const delegation = evidence.stages.find((s) => s.stage === "delegation");
    expect(delegation?.present).toBe(true);
    expect(delegation?.details.delegationAbsentDocumented).toBe(true);
  });

  it("NÃO declara validation PASS sem ValidResult/delivery válida", async () => {
    prismaMock.officeDemand.findFirst.mockResolvedValue({
      id: "demand-3",
      workspaceId: "operaia-lab",
      status: "EXECUTING",
      objective: "Sem delivery",
      planJson: { demandId: "demand-3", steps: [{ id: "s1" }] },
      missionId: "root-3",
      approvals: [],
    });
    prismaMock.workGovernanceDecision.findFirst.mockResolvedValue({
      decision: "EXECUTE",
      reason: "x",
      resultingMissionId: "root-3",
      createdAt: new Date(),
    });
    prismaMock.mission.findUnique.mockResolvedValue({
      id: "root-3",
      workspaceId: "operaia-lab",
      status: MissionStatus.RUNNING,
      missionKind: MissionKind.COORDINATE,
      resultJson: null,
      parentMissionId: null,
      objective: "Sem delivery",
    });
    prismaMock.mission.findMany.mockResolvedValue([]);
    prismaMock.missionEvent.findMany.mockResolvedValue([
      {
        id: "ev-t",
        missionId: "root-3",
        type: "enqueued",
        createdAt: new Date(),
      },
    ]);

    const { buildAutonomyLoopEvidence } = await import(
      "./autonomy-loop-evidence.js"
    );
    const evidence = await buildAutonomyLoopEvidence("demand-3");
    const validation = evidence.stages.find((s) => s.stage === "validation");
    const delivery = evidence.stages.find((s) => s.stage === "delivery");
    expect(validation?.present).toBe(false);
    expect(delivery?.present).toBe(false);
    expect(evidence.loopEvidenceComplete).toBe(false);
  });
});
