import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@operaia/shared";

const prismaMock = vi.hoisted(() => ({
  scheduleRule: {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@operaia/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@operaia/database")>();
  return {
    ...actual,
    prisma: prismaMock,
  };
});

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "rule-1",
    workspaceId: "operaia-lab",
    intervalSec: 1800,
    enabled: true,
    lastEnqueuedAt: null,
    configJson: { objective: "Revisar pendências" },
    createdAt: new Date("2026-08-27T10:00:00.000Z"),
    updatedAt: new Date("2026-08-27T10:00:00.000Z"),
    ...overrides,
  };
}

describe("schedule-rules.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lista regras convertendo configJson.objective", async () => {
    const { listScheduleRules } = await import("./schedule-rules.service.js");
    prismaMock.scheduleRule.findMany.mockResolvedValue([baseRow()]);

    const result = await listScheduleRules();

    expect(result).toHaveLength(1);
    expect(result[0].objective).toBe("Revisar pendências");
    expect(result[0].workspaceName).toBe("OperaIA.lab");
  });

  it("cria regra apenas em workspace oficial", async () => {
    const { createScheduleRule } = await import("./schedule-rules.service.js");

    await expect(
      createScheduleRule({
        workspaceId: "nao-oficial",
        objective: "x",
        intervalSec: 60,
      }),
    ).rejects.toThrow();
  });

  it("cria regra e grava objective em configJson", async () => {
    const { createScheduleRule } = await import("./schedule-rules.service.js");
    prismaMock.scheduleRule.create.mockResolvedValue(baseRow());

    await createScheduleRule({
      workspaceId: "operaia-lab",
      objective: "Revisar pendências",
      intervalSec: 1800,
    });

    expect(prismaMock.scheduleRule.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "operaia-lab",
        intervalSec: 1800,
        enabled: true,
        configJson: { objective: "Revisar pendências" },
      },
    });
  });

  it("update lança NotFoundError quando a regra não existe", async () => {
    const { updateScheduleRule } = await import("./schedule-rules.service.js");
    prismaMock.scheduleRule.findUnique.mockResolvedValue(null);

    await expect(
      updateScheduleRule("missing", { enabled: false }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("update preserva objective existente ao alternar enabled", async () => {
    const { updateScheduleRule } = await import("./schedule-rules.service.js");
    prismaMock.scheduleRule.findUnique.mockResolvedValue(baseRow());
    prismaMock.scheduleRule.update.mockResolvedValue(
      baseRow({ enabled: false }),
    );

    await updateScheduleRule("rule-1", { enabled: false });

    expect(prismaMock.scheduleRule.update).toHaveBeenCalledWith({
      where: { id: "rule-1" },
      data: { enabled: false },
    });
  });

  it("delete remove a regra existente", async () => {
    const { deleteScheduleRule } = await import("./schedule-rules.service.js");
    prismaMock.scheduleRule.findUnique.mockResolvedValue(baseRow());
    prismaMock.scheduleRule.delete.mockResolvedValue(baseRow());

    await deleteScheduleRule("rule-1");

    expect(prismaMock.scheduleRule.delete).toHaveBeenCalledWith({
      where: { id: "rule-1" },
    });
  });
});
