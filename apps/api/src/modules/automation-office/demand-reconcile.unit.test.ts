import { beforeEach, describe, expect, it, vi } from "vitest";
import { MissionStatus } from "@operaia/database";

const prismaMock = vi.hoisted(() => ({
  officeDemand: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  mission: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@operaia/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@operaia/database")>();
  return {
    ...actual,
    prisma: prismaMock,
  };
});

function baseDemand(overrides: Record<string, unknown> = {}) {
  return {
    id: "demand-1",
    workspaceId: "operaia-lab",
    status: "EXECUTING",
    objective: "Smoke",
    context: "",
    expectedOutcome: "",
    constraintsJson: [],
    priority: "MEDIUM",
    risk: "LOW",
    autonomy: "CONTROLLED",
    planJson: null,
    missionId: "mission-1",
    createdAt: new Date("2026-08-25T10:00:00.000Z"),
    updatedAt: new Date("2026-08-25T10:00:00.000Z"),
    resolvedAt: null,
    ...overrides,
  };
}

describe("reconcileDemandFromMission (lazy sync Opção A)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("COMPLETED → COMPLETED + resolvedAt", async () => {
    const demand = baseDemand();
    prismaMock.mission.findUnique.mockResolvedValue({
      id: "mission-1",
      status: MissionStatus.COMPLETED,
    });
    prismaMock.officeDemand.updateMany.mockResolvedValue({ count: 1 });
    const resolved = baseDemand({
      status: "COMPLETED",
      resolvedAt: new Date("2026-08-25T12:00:00.000Z"),
    });
    prismaMock.officeDemand.findFirst.mockResolvedValue(resolved);

    const { reconcileDemandFromMission } = await import("./demand.service.js");
    const result = await reconcileDemandFromMission(demand as never);

    expect(result.changed).toBe(true);
    expect(result.reason).toBe("updated");
    expect(result.demand.status).toBe("COMPLETED");
    expect(result.demand.resolvedAt).toBeTruthy();
    expect(prismaMock.officeDemand.updateMany).toHaveBeenCalledWith({
      where: {
        id: "demand-1",
        status: "EXECUTING",
        missionId: "mission-1",
      },
      data: {
        status: "COMPLETED",
        resolvedAt: expect.any(Date),
      },
    });
  });

  it("FAILED → FAILED", async () => {
    const demand = baseDemand();
    prismaMock.mission.findUnique.mockResolvedValue({
      id: "mission-1",
      status: MissionStatus.FAILED,
    });
    prismaMock.officeDemand.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.officeDemand.findFirst.mockResolvedValue(
      baseDemand({ status: "FAILED", resolvedAt: new Date() }),
    );

    const { reconcileDemandFromMission } = await import("./demand.service.js");
    const result = await reconcileDemandFromMission(demand as never);

    expect(result.changed).toBe(true);
    expect(result.demand.status).toBe("FAILED");
    expect(prismaMock.officeDemand.updateMany.mock.calls[0]?.[0]?.data.status).toBe(
      "FAILED",
    );
  });

  it("CANCELLED → CANCELLED", async () => {
    const demand = baseDemand();
    prismaMock.mission.findUnique.mockResolvedValue({
      id: "mission-1",
      status: MissionStatus.CANCELLED,
    });
    prismaMock.officeDemand.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.officeDemand.findFirst.mockResolvedValue(
      baseDemand({ status: "CANCELLED", resolvedAt: new Date() }),
    );

    const { reconcileDemandFromMission } = await import("./demand.service.js");
    const result = await reconcileDemandFromMission(demand as never);

    expect(result.demand.status).toBe("CANCELLED");
    expect(prismaMock.officeDemand.updateMany.mock.calls[0]?.[0]?.data.status).toBe(
      "CANCELLED",
    );
  });

  it("RUNNING → permanece EXECUTING", async () => {
    const demand = baseDemand();
    prismaMock.mission.findUnique.mockResolvedValue({
      id: "mission-1",
      status: MissionStatus.RUNNING,
    });

    const { reconcileDemandFromMission } = await import("./demand.service.js");
    const result = await reconcileDemandFromMission(demand as never);

    expect(result.changed).toBe(false);
    expect(result.reason).toBe("mission_not_terminal");
    expect(result.demand.status).toBe("EXECUTING");
    expect(prismaMock.officeDemand.updateMany).not.toHaveBeenCalled();
  });

  it("QUEUED → permanece EXECUTING", async () => {
    const demand = baseDemand();
    prismaMock.mission.findUnique.mockResolvedValue({
      id: "mission-1",
      status: MissionStatus.QUEUED,
    });

    const { reconcileDemandFromMission } = await import("./demand.service.js");
    const result = await reconcileDemandFromMission(demand as never);

    expect(result.reason).toBe("mission_not_terminal");
    expect(prismaMock.officeDemand.updateMany).not.toHaveBeenCalled();
  });

  it("sem missionId → no-op", async () => {
    const demand = baseDemand({ missionId: null });

    const { reconcileDemandFromMission } = await import("./demand.service.js");
    const result = await reconcileDemandFromMission(demand as never);

    expect(result.reason).toBe("missing_mission_id");
    expect(prismaMock.mission.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.officeDemand.updateMany).not.toHaveBeenCalled();
  });

  it("demand não EXECUTING → no-op", async () => {
    for (const status of ["PAUSED", "READY", "PLANNED", "COMPLETED"] as const) {
      vi.clearAllMocks();
      const demand = baseDemand({ status, missionId: "mission-1" });

      const { reconcileDemandFromMission } = await import("./demand.service.js");
      const result = await reconcileDemandFromMission(demand as never);

      expect(result.reason).toBe("not_executing");
      expect(result.demand.status).toBe(status);
      expect(prismaMock.mission.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.officeDemand.updateMany).not.toHaveBeenCalled();
    }
  });

  it("Mission inexistente → no-op seguro", async () => {
    const demand = baseDemand();
    prismaMock.mission.findUnique.mockResolvedValue(null);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const { reconcileDemandFromMission } = await import("./demand.service.js");
    const result = await reconcileDemandFromMission(demand as never);

    expect(result.reason).toBe("mission_not_found");
    expect(result.changed).toBe(false);
    expect(result.demand.status).toBe("EXECUTING");
    expect(prismaMock.officeDemand.updateMany).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("reconcile duas vezes → idempotente", async () => {
    const demand = baseDemand();
    prismaMock.mission.findUnique.mockResolvedValue({
      id: "mission-1",
      status: MissionStatus.COMPLETED,
    });
    prismaMock.officeDemand.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const completed = baseDemand({
      status: "COMPLETED",
      resolvedAt: new Date("2026-08-25T12:00:00.000Z"),
    });
    prismaMock.officeDemand.findFirst.mockResolvedValue(completed);

    const { reconcileDemandFromMission } = await import("./demand.service.js");
    const first = await reconcileDemandFromMission(demand as never);
    expect(first.changed).toBe(true);
    expect(first.reason).toBe("updated");

    const second = await reconcileDemandFromMission(completed as never);
    expect(second.changed).toBe(false);
    expect(second.reason).toBe("not_executing");
    expect(prismaMock.officeDemand.updateMany).toHaveBeenCalledTimes(1);
  });

  it("getDemandById aplica reconcile no read-path", async () => {
    const executing = baseDemand();
    prismaMock.officeDemand.findFirst
      .mockResolvedValueOnce(executing)
      .mockResolvedValueOnce(
        baseDemand({
          status: "COMPLETED",
          resolvedAt: new Date("2026-08-25T12:00:00.000Z"),
        }),
      );
    prismaMock.mission.findUnique.mockResolvedValue({
      id: "mission-1",
      status: MissionStatus.COMPLETED,
    });
    prismaMock.officeDemand.updateMany.mockResolvedValue({ count: 1 });

    const { getDemandById } = await import("./demand.service.js");
    const demand = await getDemandById("demand-1");

    expect(demand.status).toBe("COMPLETED");
    expect(prismaMock.officeDemand.updateMany).toHaveBeenCalledOnce();
  });
});

describe("execution projection permanece Mission-based", () => {
  it("mapMissionStatusToExecution não depende de OfficeDemand", async () => {
    const { mapMissionStatusToExecution } = await import(
      "./execution-projection.service.js"
    );
    expect(mapMissionStatusToExecution(MissionStatus.COMPLETED)).toBe("SUCCESS");
    expect(mapMissionStatusToExecution(MissionStatus.FAILED)).toBe("FAILED");
    expect(mapMissionStatusToExecution(MissionStatus.CANCELLED)).toBe("CANCELLED");
  });
});
