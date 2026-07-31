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
