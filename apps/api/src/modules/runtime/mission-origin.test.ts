import { describe, expect, it } from "vitest";
import { originToFloor } from "./mission-origin.js";

describe("originToFloor (P1.2B)", () => {
  it.each([
    ["HUMAN_DEMAND", "DEVELOPMENT"],
    ["HUMAN_ADVANCED", "DEVELOPMENT"],
    ["CEO_SALA", "DEVELOPMENT"],
    ["SUPERVISOR_AUTO", "DEVELOPMENT"],
    ["SIGNAL_GITHUB", "DEVELOPMENT"],
    ["SCHEDULE_RULE", "AUTOMATION"],
  ] as const)("%s -> %s", (origin, floor) => {
    expect(originToFloor(origin)).toBe(floor);
  });

  it("origin null vira UNKNOWN, nunca DEVELOPMENT por padrao", () => {
    expect(originToFloor(null)).toBe("UNKNOWN");
  });

  it("origin undefined vira UNKNOWN, nunca DEVELOPMENT por padrao", () => {
    expect(originToFloor(undefined)).toBe("UNKNOWN");
  });
});
