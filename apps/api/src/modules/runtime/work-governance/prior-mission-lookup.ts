/**
 * Lookup de missões via MissionQueue / Prisma para o Gate.
 */
import { prisma } from "@operaia/database";
import type { PriorMissionLookupPort } from "./already-done-gate.js";
import type { GovernanceMissionSnapshot } from "./types.js";

export class PrismaPriorMissionLookup implements PriorMissionLookupPort {
  async getMission(id: string): Promise<GovernanceMissionSnapshot | null> {
    const row = await prisma.mission.findUnique({ where: { id } });
    return row ? toSnapshot(row) : null;
  }

  async listChildren(
    parentMissionId: string,
  ): Promise<readonly GovernanceMissionSnapshot[]> {
    const rows = await prisma.mission.findMany({
      where: { parentMissionId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toSnapshot);
  }
}

export class InMemoryPriorMissionLookup implements PriorMissionLookupPort {
  private readonly byId = new Map<string, GovernanceMissionSnapshot>();

  seed(mission: GovernanceMissionSnapshot): void {
    this.byId.set(mission.id, mission);
  }

  async getMission(id: string): Promise<GovernanceMissionSnapshot | null> {
    return this.byId.get(id) ?? null;
  }

  async listChildren(
    parentMissionId: string,
  ): Promise<readonly GovernanceMissionSnapshot[]> {
    return [...this.byId.values()].filter(
      (mission) => mission.parentMissionId === parentMissionId,
    );
  }
}

function toSnapshot(row: {
  id: string;
  workspaceId: string;
  status: string;
  missionKind: string;
  objective: string;
  resultJson: unknown;
  parentMissionId: string | null;
}): GovernanceMissionSnapshot {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    status: row.status,
    missionKind: row.missionKind,
    objective: row.objective,
    resultJson: row.resultJson,
    parentMissionId: row.parentMissionId,
  };
}
