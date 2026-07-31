import { describe, expect, it } from "vitest";
import {
  createToolContext,
  DEFAULT_EMPLOYEE_TOOL_GROUPS,
  ToolCapabilityGroup,
  ToolErrorCode,
  ToolId,
  ToolPermissionPolicy,
  defaultToolPermissionPolicy,
} from "./index.js";

describe("ToolPermissionPolicy", () => {
  const policy = defaultToolPermissionPolicy;

  it("Mag tem Repository, Search, Commit, PullRequest, Issue", () => {
    expect(policy.groupsFor("cto-mag")).toEqual([
      ToolCapabilityGroup.Repository,
      ToolCapabilityGroup.Search,
      ToolCapabilityGroup.Commit,
      ToolCapabilityGroup.PullRequest,
      ToolCapabilityGroup.Issue,
    ]);
    expect(policy.isAllowed("cto-mag", ToolId.readFile)).toBe(true);
    expect(policy.isAllowed("cto-mag", ToolId.readCommit)).toBe(true);
    expect(policy.isAllowed("cto-mag", ToolId.readPullRequest)).toBe(true);
    expect(policy.isAllowed("cto-mag", ToolId.readIssue)).toBe(true);
    expect(policy.isAllowed("cto-mag", ToolId.readDockerCompose)).toBe(false);
    expect(policy.isAllowed("cto-mag", ToolId.readLogs)).toBe(false);
  });

  it("Luna tem Repository + Search; sem Commit/Infra", () => {
    expect(policy.isAllowed("luna", ToolId.readRepository)).toBe(true);
    expect(policy.isAllowed("luna", ToolId.searchFiles)).toBe(true);
    expect(policy.isAllowed("luna", ToolId.readCommit)).toBe(false);
    expect(policy.isAllowed("luna", ToolId.readCaddy)).toBe(false);
  });

  it("Atlas tem Infra + Docker + Logs + Caddy", () => {
    expect(policy.groupsFor("atlas")).toEqual([
      ToolCapabilityGroup.Infra,
      ToolCapabilityGroup.Docker,
      ToolCapabilityGroup.Logs,
      ToolCapabilityGroup.Caddy,
    ]);
    expect(policy.isAllowed("atlas", ToolId.readDockerCompose)).toBe(true);
    expect(policy.isAllowed("atlas", ToolId.readCaddy)).toBe(true);
    expect(policy.isAllowed("atlas", ToolId.readDockerfile)).toBe(true);
    expect(policy.isAllowed("atlas", ToolId.listInfrastructure)).toBe(true);
    expect(policy.isAllowed("atlas", ToolId.readLogs)).toBe(true);
    expect(policy.isAllowed("atlas", ToolId.readFile)).toBe(false);
  });

  it("Orion tem Runtime + Logs", () => {
    expect(policy.isAllowed("orion", ToolId.readWorkflow)).toBe(true);
    expect(policy.isAllowed("orion", ToolId.readLogs)).toBe(true);
    expect(policy.isAllowed("orion", ToolId.readDockerCompose)).toBe(false);
  });

  it("Aurora Finance e placeholder (sem tools ainda)", () => {
    expect(policy.groupsFor("aurora")).toEqual([ToolCapabilityGroup.Finance]);
    expect(policy.allowedTools("aurora")).toEqual([]);
  });

  it("Themis Documents; Mercurio RepositoryDocs; Nexus RoadmapDocs", () => {
    expect(policy.isAllowed("themis", ToolId.readFile)).toBe(true);
    expect(policy.isAllowed("mercurio", ToolId.readRepository)).toBe(true);
    expect(policy.isAllowed("nexus", ToolId.listDirectory)).toBe(true);
    expect(policy.isAllowed("nexus", ToolId.readCommit)).toBe(false);
  });

  it("Opera e desconhecido nao recebem tools", () => {
    expect(policy.allowedTools("operaia-ceo")).toEqual([]);
    expect(policy.allowedTools("unknown-employee")).toEqual([]);
  });

  it("matriz default cobre o roster esperado", () => {
    expect(Object.keys(DEFAULT_EMPLOYEE_TOOL_GROUPS).sort()).toEqual(
      [
        "atlas",
        "aurora",
        "cto-mag",
        "luna",
        "mercurio",
        "nexus",
        "operaia-ceo",
        "orion",
        "themis",
      ].sort(),
    );
  });
});

describe("ToolContext", () => {
  it("cria contexto com tools permitidas", () => {
    const ctx = createToolContext({ employeeId: "cto-mag" });
    expect(ctx.employeeId).toBe("cto-mag");
    expect(ctx.canUse(ToolId.readFile)).toBe(true);
    expect(ctx.listAllowedTools()).toContain(ToolId.readCommit);
  });

  it("autorizacao: Mag pode readFile; Atlas nao", async () => {
    const mag = createToolContext({ employeeId: "cto-mag" });
    const atlas = createToolContext({ employeeId: "atlas" });

    const magDeniedInfra = await mag.readDockerCompose();
    expect(magDeniedInfra.ok).toBe(false);
    if (!magDeniedInfra.ok) {
      expect(magDeniedInfra.error.code).toBe(ToolErrorCode.PERMISSION_DENIED);
    }

    const atlasFile = await atlas.readFile({
      repository: "acme/lab",
      path: "README.md",
    });
    expect(atlasFile.ok).toBe(false);
    if (!atlasFile.ok) {
      expect(atlasFile.error.code).toBe(ToolErrorCode.PERMISSION_DENIED);
    }
  });

  it("isolamento: Luna nao acessa logs do Atlas", async () => {
    const luna = createToolContext({ employeeId: "luna" });
    const result = await luna.readLogs({ source: "api" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ToolErrorCode.PERMISSION_DENIED);
      expect(result.error.employeeId).toBe("luna");
    }
  });

  it("A.1: tool permitida sem adapter → NOT_IMPLEMENTED", async () => {
    const mag = createToolContext({ employeeId: "cto-mag" });
    const result = await mag.readFile({
      repository: "acme/lab",
      path: "src/a.ts",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ToolErrorCode.NOT_IMPLEMENTED);
    }
  });

  it("politica customizada sobrescreve matriz", () => {
    const policy = new ToolPermissionPolicy({
      employeeGroups: {
        luna: [ToolCapabilityGroup.Logs],
      },
    });
    const ctx = createToolContext({ employeeId: "luna", policy });
    expect(ctx.canUse(ToolId.readLogs)).toBe(true);
    expect(ctx.canUse(ToolId.readFile)).toBe(false);
  });
});
