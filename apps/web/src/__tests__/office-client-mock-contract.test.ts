import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOfficeCommandClient,
  isOfficeCommandMockEnabled,
} from "@/data/adapters/office-client";
import { HttpError, type HttpClient } from "@/data/adapters/http-client";

function httpStub(overrides: {
  get?: (path: string) => Promise<unknown>;
  post?: (path: string, body: unknown) => Promise<unknown>;
} = {}): HttpClient {
  return {
    get: (overrides.get ??
      (async () => {
        throw new Error("get not stubbed");
      })) as HttpClient["get"],
    post: (overrides.post ??
      (async () => {
        throw new Error("post not stubbed");
      })) as HttpClient["post"],
  };
}

describe("isOfficeCommandMockEnabled", () => {
  it("só habilita mock quando flag === 'true'", () => {
    expect(isOfficeCommandMockEnabled({ VITE_OFFICE_COMMAND_MOCK: "true" })).toBe(
      true,
    );
    expect(isOfficeCommandMockEnabled({ VITE_OFFICE_COMMAND_MOCK: "false" })).toBe(
      false,
    );
    expect(isOfficeCommandMockEnabled({})).toBe(false);
    expect(isOfficeCommandMockEnabled({ VITE_OFFICE_COMMAND_MOCK: "1" })).toBe(
      false,
    );
  });
});

describe("office-client mock contract (P0.3C-7)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("MOCK ON → usa mock sem chamar HTTP", async () => {
    const get = vi.fn(async () => {
      throw new Error("should not call get");
    });
    const post = vi.fn(async () => {
      throw new Error("should not call post");
    });
    const client = createOfficeCommandClient(httpStub({ get, post }), {
      preferMock: true,
    });

    const command = await client.getCommandCenter();
    const interpret = await client.interpretDemand("x", "operaia-lab", "Lab");
    const execute = await client.executeDemand("d-1", "CONTROLLED");

    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    expect(command.source).toBe("mock-temporary");
    expect(interpret.source).toBe("mock-temporary");
    expect(execute.source).toBe("mock-temporary");
  });

  it("MOCK OFF + API OK → source=api sem mock", async () => {
    const get = vi.fn(async () => ({
      generatedAt: "2026-08-25T00:00:00.000Z",
      source: "api" as const,
      backendDependency: false as const,
      status: { level: "OPERATING", label: "OK", summary: "ok" },
      attention: [],
      pendingApprovals: 0,
      inProgress: [],
      decisions: [],
      completed: [],
      idle: true,
      zeroMessage: "",
    }));
    const post = vi.fn(async (path: string) => {
      if (path === "/office/demands") {
        return {
          source: "api" as const,
          backendDependency: false as const,
          brief: {
            demandId: "d-1",
            workspaceId: "operaia-lab",
            workspaceName: "Lab",
            objective: "x",
            context: "",
            expectedOutcome: "",
            constraints: [],
            priority: "MEDIUM" as const,
            risk: "LOW" as const,
            autonomy: "CONTROLLED" as const,
            dependencies: [],
          },
          plan: { demandId: "d-1", steps: [] },
        };
      }
      return {
        source: "api" as const,
        backendDependency: false as const,
        accepted: true,
        message: "ok",
        demandId: "d-1",
        missionId: "m-1",
      };
    });

    const client = createOfficeCommandClient(httpStub({ get, post }), {
      preferMock: false,
    });

    const command = await client.getCommandCenter();
    const interpret = await client.interpretDemand("x", "operaia-lab", "Lab");
    const execute = await client.executeDemand("d-1", "CONTROLLED");

    expect(command.source).toBe("api");
    expect(command.backendDependency).toBe(false);
    expect(interpret.source).toBe("api");
    expect(execute.source).toBe("api");
    expect(execute.missionId).toBe("m-1");
    expect(get).toHaveBeenCalledWith("/office/command");
  });

  it.each([
    { status: 403, label: "MOCK OFF + HTTP 403" },
    { status: 409, label: "MOCK OFF + HTTP 409" },
    { status: 503, label: "MOCK OFF + HTTP 503" },
  ])("$label → erro preservado", async ({ status }) => {
    const get = vi.fn(async () => {
      throw new HttpError(status, "/office/command");
    });
    const post = vi.fn(async () => {
      throw new HttpError(status, "/office/demands");
    });
    const client = createOfficeCommandClient(httpStub({ get, post }), {
      preferMock: false,
    });

    await expect(client.getCommandCenter()).rejects.toMatchObject({ status });
    await expect(
      client.interpretDemand("x", "operaia-lab", "Lab"),
    ).rejects.toMatchObject({ status });
    await expect(
      client.executeDemand("d-1", "CONTROLLED"),
    ).rejects.toMatchObject({ status });
  });

  it("MOCK OFF + network failure → erro de rede preservado", async () => {
    const networkError = new TypeError("Failed to fetch");
    const get = vi.fn(async () => {
      throw networkError;
    });
    const post = vi.fn(async () => {
      throw networkError;
    });
    const client = createOfficeCommandClient(httpStub({ get, post }), {
      preferMock: false,
    });

    await expect(client.getCommandCenter()).rejects.toBe(networkError);
    await expect(
      client.interpretDemand("x", "operaia-lab", "Lab"),
    ).rejects.toBe(networkError);
    await expect(client.executeDemand("d-1", "CONTROLLED")).rejects.toBe(
      networkError,
    );
  });

  it("EXECUTE com MOCK OFF nunca cai no mock silenciosamente", async () => {
    const post = vi.fn(async () => {
      throw new HttpError(500, "/office/demands/d-1/execute");
    });
    const client = createOfficeCommandClient(httpStub({ post }), {
      preferMock: false,
    });

    await expect(
      client.executeDemand("d-1", "CONTROLLED"),
    ).rejects.toMatchObject({ status: 500 });
    expect(post).toHaveBeenCalledOnce();
  });
});
