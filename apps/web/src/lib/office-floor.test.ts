import { describe, expect, it } from "vitest";
import { employeesForFloor, specializationToFloor } from "./office-floor";

describe("specializationToFloor (P1.21-FIX)", () => {
  it.each([
    ["SOFTWARE_ENGINEERING", "dev"],
    ["PRODUCT_DESIGN", "dev"],
    ["PRODUCT_MANAGEMENT", "dev"],
    ["AUTOMATION", "automation"],
    ["MARKETING", "marketing"],
  ] as const)("%s -> %s", (specialization, floorId) => {
    expect(specializationToFloor(specialization)).toBe(floorId);
  });

  it("MANAGEMENT nao resolve por essa funcao (papel transversal, ver employeesForFloor)", () => {
    expect(specializationToFloor("MANAGEMENT")).toBeNull();
  });

  it.each(["FINANCE", "LEGAL", "OPERATIONS", "UX_DESIGN", "PRODUCT", "COMMERCIAL"])(
    "%s vira null: nao existe andar pra essa especialidade ainda",
    (specialization) => {
      expect(specializationToFloor(specialization)).toBeNull();
    },
  );
});

describe("employeesForFloor (P1.21-FIX)", () => {
  const roster = [
    { id: "opera", specialization: "MANAGEMENT" },
    { id: "mag", specialization: "SOFTWARE_ENGINEERING" },
    { id: "atlas", specialization: "AUTOMATION" },
    { id: "mercurio", specialization: "MARKETING" },
    { id: "aurora", specialization: "FINANCE" },
  ];

  it("andar de dev traz o especialista de dev + o CEO, nao os outros andares", () => {
    expect(employeesForFloor(roster, "dev").map((e) => e.id)).toEqual(["opera", "mag"]);
  });

  it("andar de automacao traz o especialista de automacao + o CEO", () => {
    expect(employeesForFloor(roster, "automation").map((e) => e.id)).toEqual([
      "opera",
      "atlas",
    ]);
  });

  it("andar de marketing traz o especialista de marketing + o CEO, nunca o de dev/automacao", () => {
    expect(employeesForFloor(roster, "marketing").map((e) => e.id)).toEqual([
      "opera",
      "mercurio",
    ]);
  });

  it("especialidade sem andar (ex.: FINANCE) nao aparece em nenhum andar", () => {
    const allFloors = ["dev", "automation", "marketing"] as const;
    for (const floorId of allFloors) {
      expect(employeesForFloor(roster, floorId).some((e) => e.id === "aurora")).toBe(false);
    }
  });
});
