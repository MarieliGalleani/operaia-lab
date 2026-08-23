import { describe, expect, it } from "vitest";
import { BriefingBuilder, Specialization } from "@operaia/employee-framework";
import { ToolErrorCode, ToolId } from "@operaia/tool-runtime";
import {
  BRIEFING_TOOL_CONTEXT_KEY,
  buildToolsForEmployee,
  EmployeeRunner,
  getToolContextFromBriefing,
} from "../index.js";

const workspace = {
  workspaceId: "nexo",
  name: "NEXO",
  objective: "x",
  tasks: [] as const,
};

describe("Employee Runtime × ToolContext", () => {
  it("propaga workspaceId quando informado na composicao", () => {
    const tools = buildToolsForEmployee("aurora", {
      workspaceId: "operaia-lab",
    });
    expect(tools.workspaceId).toBe("operaia-lab");
  });

  it("injeta ToolContext permitido no briefing durante run", async () => {
    const runner = new EmployeeRunner();
    const tools = buildToolsForEmployee("cto-mag");

    const fakeEmployee = {
      profile: {
        id: "cto-mag",
        name: "Mag",
        role: "CTO",
        specialization: Specialization.SOFTWARE_ENGINEERING,
        responsibilities: [],
        limits: [],
        qualityRules: [],
      },
      async work({ briefing }: { briefing: ReturnType<BriefingBuilder["build"]> }) {
        const ctx = getToolContextFromBriefing(briefing);
        expect(ctx).not.toBeNull();
        expect(ctx?.canUse(ToolId.readFile)).toBe(true);
        expect(briefing.additional[BRIEFING_TOOL_CONTEXT_KEY]).toBe(ctx);
        expect(briefing.additional.toolIds).toEqual(
          expect.arrayContaining([ToolId.readFile, ToolId.readCommit]),
        );

        const denied = await ctx!.readLogs({ source: "api" });
        expect(denied.ok).toBe(false);
        if (!denied.ok) {
          expect(denied.error.code).toBe(ToolErrorCode.PERMISSION_DENIED);
        }

        return {
          decision: {
            analyzed: "ok",
            decision: "ok",
            reasoning: "ok",
            recommendations: [],
            delegations: [],
            risks: [],
            nextActions: [],
          },
          report: {
            summary: "ok",
            analysis: "ok",
            plan: [],
            recommendations: [],
            risks: [],
            nextActions: [],
          },
          quality: { passed: true, issues: [] },
        };
      },
    };

    const result = await runner.run(fakeEmployee as never, {
      workspace: workspace as never,
      objective: "Analisar diff",
      tools,
    });

    expect(result.employeeId).toBe("cto-mag");
    expect(getToolContextFromBriefing(result.briefing)?.employeeId).toBe(
      "cto-mag",
    );
  });

  it("preenche workspaceId ausente no ToolContext a partir do WorkspaceSnapshot", async () => {
    const runner = new EmployeeRunner();
    const tools = buildToolsForEmployee("aurora");

    const fakeEmployee = {
      profile: {
        id: "aurora",
        name: "Aurora",
        role: "Finance",
        specialization: Specialization.FINANCE,
        responsibilities: [],
        limits: [],
        qualityRules: [],
      },
      async work({ briefing }: { briefing: ReturnType<BriefingBuilder["build"]> }) {
        const ctx = getToolContextFromBriefing(briefing);
        expect(ctx?.workspaceId).toBe("operaia-lab");
        return {
          decision: {
            analyzed: "ok",
            decision: "ok",
            reasoning: "ok",
            recommendations: [],
            delegations: [],
            risks: [],
            nextActions: [],
          },
          report: {
            summary: "ok",
            analysis: "ok",
            plan: [],
            recommendations: [],
            risks: [],
            nextActions: [],
          },
          quality: { passed: true, issues: [] },
        };
      },
    };

    const result = await runner.run(fakeEmployee as never, {
      workspace: {
        workspaceId: "operaia-lab",
        name: "OperaIA.lab",
        objective: "x",
        tasks: [],
      },
      objective: "Finance proof",
      tools,
    });

    expect(getToolContextFromBriefing(result.briefing)?.workspaceId).toBe(
      "operaia-lab",
    );
  });

  it("isola Atlas: sem readFile; com readLogs", async () => {
    const atlas = buildToolsForEmployee("atlas");
    expect(atlas.canUse(ToolId.readLogs)).toBe(true);
    expect(atlas.canUse(ToolId.readFile)).toBe(false);

    const file = await atlas.readFile({
      repository: "acme/lab",
      path: "a.ts",
    });
    expect(file.ok).toBe(false);
    if (!file.ok) {
      expect(file.error.code).toBe(ToolErrorCode.PERMISSION_DENIED);
    }
  });
});
