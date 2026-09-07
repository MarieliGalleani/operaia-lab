/**
 * Integration — aprovacao retrospectiva originada de missao real
 * (createApprovalForMission / hasApprovalForMission), mesmo caminho que
 * queued-mission-executor.ts aciona quando o objetivo de uma missao
 * EXECUTE bate risco CRITICAL.
 */
import "../operations/ensure-database-url.js";
import { prisma } from "@operaia/database";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createApprovalForMission,
  getApprovalById,
  hasApprovalForMission,
} from "./approval.service.js";

const PREFIX = `am-${Date.now()}`;

async function cleanup(): Promise<void> {
  await prisma.officeApprovalRequest.deleteMany({
    where: { missionId: { startsWith: PREFIX } },
  });
}

describe("createApprovalForMission / hasApprovalForMission — OfficeApprovalRequest real", () => {
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("cria uma aprovacao retrospectiva vinculada a missionId, sem demandId", async () => {
    const missionId = `${PREFIX}-mission-1`;
    expect(await hasApprovalForMission(missionId)).toBe(false);

    const created = await createApprovalForMission({
      missionId,
      workspaceId: "operaia-lab",
      action: "Fazer deploy em produção",
      risk: "CRITICAL",
      impact: "Ação já executada pelo pipeline.",
      reason: "Objetivo contém termo de alto risco.",
      validated: [],
      approveEffect: "Marca como revisada.",
      rejectEffect: "Sinaliza para investigação.",
      officeDecision: "Executado automaticamente; aprovação retrospectiva.",
    });

    expect(created.missionId).toBe(missionId);
    expect(created.demandId).toBeNull();
    expect(created.status).toBe("PENDING");
    expect(created.risk).toBe("CRITICAL");

    expect(await hasApprovalForMission(missionId)).toBe(true);

    const fetched = await getApprovalById(created.id);
    expect(fetched.workspaceId).toBe("operaia-lab");
    expect(fetched.action).toBe("Fazer deploy em produção");
  });

  it("nao deixa criar aprovacao pra workspace nao oficial", async () => {
    const missionId = `${PREFIX}-mission-bad-ws`;
    await expect(
      createApprovalForMission({
        missionId,
        workspaceId: "workspace-inexistente",
        action: "x",
        risk: "CRITICAL",
        impact: "x",
        reason: "x",
        validated: [],
        approveEffect: "x",
        rejectEffect: "x",
        officeDecision: "x",
      }),
    ).rejects.toThrow();
  });
});
