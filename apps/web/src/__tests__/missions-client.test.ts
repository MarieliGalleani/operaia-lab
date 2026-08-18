import { describe, expect, it, vi } from "vitest";
import { createMissionsClient } from "@/data/adapters/missions-client";
import type { HttpClient } from "@/data/adapters/http-client";

describe("MissionsClient — contrato HTTP real", () => {
  it("lista arvores via GET /missions?format=tree", async () => {
    const get = vi.fn(async () => ({
      tree: [
        {
          id: "root-1",
          workspaceId: "operaia-lab",
          objective: "Analisar producao",
          missionKind: "COORDINATE",
          status: "COMPLETED",
          ownerEmployeeId: "operaia-ceo",
          requiredSpecialization: null,
          parentMissionId: null,
          startedAt: null,
          finishedAt: "2026-08-15T17:55:00.000Z",
          createdAt: "2026-08-15T17:54:54.000Z",
          children: [],
        },
      ],
    }));
    const client = createMissionsClient({ get, post: vi.fn() } as unknown as HttpClient);
    const tree = await client.listTree(50);
    expect(get).toHaveBeenCalledWith("/missions?format=tree&take=50");
    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe("root-1");
  });

  it("busca detalhe persistido via GET /missions/:id", async () => {
    const get = vi.fn(async () => ({
      id: "m-1",
      status: "COMPLETED",
      objective: "Fazer analise",
      workspaceId: "operaia-lab",
      missionKind: "COORDINATE",
      usableResult: "Entrega consolidada",
      reply: { employeeId: "operaia-ceo", content: "Entrega consolidada" },
      specialists: [{ matched: true, employeeId: "cto-mag", specialization: "SOFTWARE_ENGINEERING" }],
      children: [],
      events: [],
    }));
    const client = createMissionsClient({ get, post: vi.fn() } as unknown as HttpClient);
    const detail = await client.getById("m-1");
    expect(get).toHaveBeenCalledWith("/missions/m-1");
    expect(detail.usableResult).toBe("Entrega consolidada");
  });

  it("cria missao via POST /missions sem marker extra", async () => {
    const post = vi.fn(async () => ({
      created: true,
      mission: { id: "new-1", status: "QUEUED" },
    }));
    const client = createMissionsClient({ get: vi.fn(), post } as unknown as HttpClient);
    const result = await client.create({
      workspaceId: "operaia-lab",
      objective: "Revisar o estado de producao do lab",
    });
    expect(post).toHaveBeenCalledWith("/missions", {
      workspaceId: "operaia-lab",
      objective: "Revisar o estado de producao do lab",
    });
    expect(result.mission.id).toBe("new-1");
  });
});
