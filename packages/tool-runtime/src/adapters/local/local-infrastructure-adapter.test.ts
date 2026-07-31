import { describe, expect, it } from "vitest";
import {
  createToolContext,
  MAX_LOG_LINES,
  MemoryInfrastructureFileSystem,
  MemoryInfrastructureLogSource,
  MapWorkspaceInfrastructureResolver,
  LocalInfrastructureAdapter,
  ToolErrorCode,
  ToolId,
  ToolCapabilityGroup,
  defaultToolPermissionPolicy,
  createLocalInfrastructureToolPorts,
} from "../../index.js";

const LAB_ROOT = "/workspaces/operaia-lab";
const NEXO_ROOT = "/workspaces/nexo";

const COMPOSE = `
services:
  api:
    image: operaia-api
  db:
    image: postgres:16
`;

function createLabFs() {
  return new MemoryInfrastructureFileSystem({
    [`${LAB_ROOT}/docker-compose.yml`]: {
      content: COMPOSE,
      mtimeMs: Date.parse("2026-07-30T10:00:00.000Z"),
    },
    [`${LAB_ROOT}/infra/docker-compose.prod.yml`]: {
      content: "services:\n  caddy:\n    image: caddy\n",
      mtimeMs: Date.parse("2026-07-30T11:00:00.000Z"),
    },
    [`${LAB_ROOT}/Dockerfile`]: {
      content: "FROM node:22\n",
      mtimeMs: Date.parse("2026-07-30T09:00:00.000Z"),
    },
    [`${LAB_ROOT}/Dockerfile.api`]: {
      content: "FROM node:22-alpine\n",
      mtimeMs: Date.parse("2026-07-30T09:30:00.000Z"),
    },
    [`${LAB_ROOT}/infra/caddy/Caddyfile`]: {
      content: "operaia.lab {\n  reverse_proxy api:3000\n}\n",
      mtimeMs: Date.parse("2026-07-29T12:00:00.000Z"),
    },
    [`${LAB_ROOT}/.github/workflows/ci.yml`]: {
      content: "name: CI\non: push\n",
      mtimeMs: Date.parse("2026-07-28T08:00:00.000Z"),
    },
    [`${LAB_ROOT}/var/log/app.log`]: {
      content: Array.from({ length: 600 }, (_, i) => `line-${i + 1}`).join(
        "\n",
      ),
      mtimeMs: Date.parse("2026-07-30T12:00:00.000Z"),
    },
    [`${LAB_ROOT}/secrets/token.txt`]: {
      content: "SECRET",
      mtimeMs: 1,
    },
    [`${LAB_ROOT}/src/main.ts`]: {
      content: " consoles.log('nope')",
      mtimeMs: 1,
    },
  });
}

function createLabAdapter(
  fs = createLabFs(),
  journal: { timestamp: string | null; level: string | null; message: string }[] = [
    {
      timestamp: "2026-07-30T12:00:00.000Z",
      level: "info",
      message: "api started",
    },
  ],
) {
  return new LocalInfrastructureAdapter({
    workspaceId: "operaia-lab",
    resolver: new MapWorkspaceInfrastructureResolver({
      "operaia-lab": LAB_ROOT,
      nexo: NEXO_ROOT,
    }),
    fs,
    logs: new MemoryInfrastructureLogSource(fs, journal),
    employeeId: "atlas",
  });
}

describe("LocalInfrastructureAdapter", () => {
  it("readDockerCompose retorna content, path e lastModified", async () => {
    const adapter = createLabAdapter();
    const result = await adapter.readDockerCompose({});
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.path).toBe("docker-compose.yml");
    expect(result.data.content).toContain("services:");
    expect(result.data.raw).toBe(result.data.content);
    expect(result.data.lastModified).toBe("2026-07-30T10:00:00.000Z");
    expect(result.data.services).toEqual(["api", "db"]);
  });

  it("readDockerCompose aceita docker-compose.*.yml", async () => {
    const adapter = createLabAdapter();
    const result = await adapter.readDockerCompose({
      path: "infra/docker-compose.prod.yml",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.services).toContain("caddy");
    }
  });

  it("readDockerfile le Dockerfile e Dockerfile.*", async () => {
    const adapter = createLabAdapter();
    const base = await adapter.readDockerfile({});
    expect(base.ok).toBe(true);
    if (base.ok) {
      expect(base.data.path).toBe("Dockerfile");
      expect(base.data.content).toContain("FROM node:22");
    }

    const variant = await adapter.readDockerfile({ path: "Dockerfile.api" });
    expect(variant.ok).toBe(true);
    if (variant.ok) {
      expect(variant.data.path).toBe("Dockerfile.api");
    }
  });

  it("readCaddy le Caddyfile", async () => {
    const adapter = createLabAdapter();
    const result = await adapter.readCaddy({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.path).toBe("infra/caddy/Caddyfile");
      expect(result.data.content).toContain("reverse_proxy");
      expect(result.data.lastModified).toBe("2026-07-29T12:00:00.000Z");
    }
  });

  it("readWorkflow le .github/workflows", async () => {
    const adapter = createLabAdapter();
    const result = await adapter.readWorkflow({
      workflowIdOrPath: "ci.yml",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.path).toBe(".github/workflows/ci.yml");
      expect(result.data.content).toContain("name: CI");
    }
  });

  it("readLogs limita a 500 linhas e nunca retorna log inteiro", async () => {
    const adapter = createLabAdapter();
    const result = await adapter.readLogs({
      source: "var/log/app.log",
      limit: 10_000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.entries.length).toBeLessThanOrEqual(MAX_LOG_LINES);
    expect(result.data.entries.length).toBe(MAX_LOG_LINES);
    expect(result.data.entries[0]?.message).toBe("line-101");
    expect(result.data.entries.at(-1)?.message).toBe("line-600");
  });

  it("readLogs journal via mock (sem FS real / sem journalctl)", async () => {
    const adapter = createLabAdapter();
    const result = await adapter.readLogs({ source: "journal" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.entries).toHaveLength(1);
      expect(result.data.entries[0]?.message).toBe("api started");
    }
  });

  it("listInfrastructure lista artefatos do workspace", async () => {
    const adapter = createLabAdapter();
    const result = await adapter.listInfrastructure({});
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.workspaceId).toBe("operaia-lab");
    expect(result.data.dockerfiles).toEqual(["Dockerfile", "Dockerfile.api"]);
    expect(result.data.dockerComposes).toEqual([
      "docker-compose.yml",
      "infra/docker-compose.prod.yml",
    ]);
    expect(result.data.workflows).toEqual([".github/workflows/ci.yml"]);
    expect(result.data.caddyfiles).toEqual(["infra/caddy/Caddyfile"]);
  });

  it("whitelist: PATH_FORBIDDEN fora dos padroes", async () => {
    const adapter = createLabAdapter();
    const secret = await adapter.readDockerCompose({
      path: "secrets/token.txt",
    });
    expect(secret.ok).toBe(false);
    if (!secret.ok) {
      expect(secret.error.code).toBe(ToolErrorCode.PATH_FORBIDDEN);
    }

    const src = await adapter.readLogs({ source: "src/main.ts" });
    expect(src.ok).toBe(false);
    if (!src.ok) {
      expect(src.error.code).toBe(ToolErrorCode.PATH_FORBIDDEN);
    }

    const escape = await adapter.readDockerfile({ path: "../nexo/Dockerfile" });
    expect(escape.ok).toBe(false);
    if (!escape.ok) {
      expect(escape.error.code).toBe(ToolErrorCode.PATH_FORBIDDEN);
    }
  });

  it("isolamento: operaia-lab nao le arquivos do nexo", async () => {
    const fs = new MemoryInfrastructureFileSystem({
      [`${LAB_ROOT}/docker-compose.yml`]: COMPOSE,
      [`${NEXO_ROOT}/docker-compose.yml`]:
        "services:\n  nexo:\n    image: nexo\n",
      [`${NEXO_ROOT}/Dockerfile`]: "FROM golang:1.22\n",
    });
    const resolver = new MapWorkspaceInfrastructureResolver({
      "operaia-lab": LAB_ROOT,
      nexo: NEXO_ROOT,
    });

    const lab = new LocalInfrastructureAdapter({
      workspaceId: "operaia-lab",
      resolver,
      fs,
      logs: new MemoryInfrastructureLogSource(fs),
    });

    const labList = await lab.listInfrastructure({});
    expect(labList.ok).toBe(true);
    if (labList.ok) {
      expect(labList.data.dockerComposes).toEqual(["docker-compose.yml"]);
      expect(labList.data.dockerfiles).toEqual([]);
    }

    const nexo = new LocalInfrastructureAdapter({
      workspaceId: "nexo",
      resolver,
      fs,
      logs: new MemoryInfrastructureLogSource(fs),
    });
    const nexoList = await nexo.listInfrastructure({});
    expect(nexoList.ok).toBe(true);
    if (nexoList.ok) {
      expect(nexoList.data.dockerfiles).toEqual(["Dockerfile"]);
      expect(nexoList.data.dockerComposes).toEqual(["docker-compose.yml"]);
    }
  });

  it("nunca lanca exception — IO_ERROR / NOT_FOUND / UNKNOWN via ToolResult", async () => {
    const fs = new MemoryInfrastructureFileSystem({});
    const adapter = createLabAdapter(fs);
    const missing = await adapter.readCaddy({});
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.code).toBe(ToolErrorCode.NOT_FOUND);
    }
  });

  it("integra ToolContext + permission policy (Atlas)", async () => {
    const fs = createLabFs();
    const ports = createLocalInfrastructureToolPorts({
      workspaceId: "operaia-lab",
      resolver: new MapWorkspaceInfrastructureResolver({
        "operaia-lab": LAB_ROOT,
      }),
      fs,
      logs: new MemoryInfrastructureLogSource(fs),
      employeeId: "atlas",
    });
    const atlas = createToolContext({ employeeId: "atlas", ports });
    const compose = await atlas.readDockerCompose({});
    expect(compose.ok).toBe(true);

    const mag = createToolContext({ employeeId: "cto-mag", ports });
    const denied = await mag.readDockerCompose({});
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.code).toBe(ToolErrorCode.PERMISSION_DENIED);
    }
  });
});

describe("Permission Policy A.3", () => {
  const policy = defaultToolPermissionPolicy;

  it("Atlas: Infra + Docker + Logs + Caddy", () => {
    expect(policy.groupsFor("atlas")).toEqual([
      ToolCapabilityGroup.Infra,
      ToolCapabilityGroup.Docker,
      ToolCapabilityGroup.Logs,
      ToolCapabilityGroup.Caddy,
    ]);
    expect(policy.isAllowed("atlas", ToolId.readDockerfile)).toBe(true);
    expect(policy.isAllowed("atlas", ToolId.listInfrastructure)).toBe(true);
    expect(policy.isAllowed("atlas", ToolId.readLogs)).toBe(true);
  });

  it("Orion: Runtime + Logs; Mag/Luna sem Logs; Mercurio/Themis sem Infra", () => {
    expect(policy.isAllowed("orion", ToolId.readWorkflow)).toBe(true);
    expect(policy.isAllowed("orion", ToolId.readLogs)).toBe(true);
    expect(policy.isAllowed("orion", ToolId.readDockerCompose)).toBe(false);

    expect(policy.isAllowed("cto-mag", ToolId.readLogs)).toBe(false);
    expect(policy.isAllowed("luna", ToolId.readLogs)).toBe(false);

    expect(policy.isAllowed("mercurio", ToolId.readDockerCompose)).toBe(false);
    expect(policy.isAllowed("themis", ToolId.readCaddy)).toBe(false);
    expect(policy.isAllowed("themis", ToolId.listInfrastructure)).toBe(false);
  });
});
