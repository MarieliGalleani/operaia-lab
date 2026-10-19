import { describe, expect, it } from "vitest";
import { CAST, OFFICE_3D_FLOORS, floorCastIds } from "@/modules/office-3d/floors-3d";
import { OFFICE_FLOORS } from "@/data/office-floors";

describe("Escritório 3D — plantas dos andares", () => {
  it("tem um escritório para cada andar do elevador e para a Portaria", () => {
    for (const f of OFFICE_FLOORS) {
      expect(OFFICE_3D_FLOORS[f.id], f.id).toBeDefined();
      expect(f.officeRoute).toBe(`/app/floor/${f.id}/office`);
    }
    expect(OFFICE_3D_FLOORS.portaria.ceo).toBe("operaia-ceo");
  });

  it("todo ocupante existe no elenco e cada pessoa sentada tem mesa", () => {
    for (const floor of Object.values(OFFICE_3D_FLOORS)) {
      for (const id of floorCastIds(floor)) expect(CAST[id], `${floor.id}:${id}`).toBeDefined();
      const seated = floor.cast.filter((id) => !CAST[id]?.robot);
      expect(floor.desks.length, floor.id).toBeGreaterThanOrEqual(seated.length);
      expect(floor.hangouts.length, floor.id).toBeGreaterThan(0);
    }
  });

  it("cada pessoa aparece em um único andar", () => {
    const seen = new Map<string, string>();
    for (const floor of Object.values(OFFICE_3D_FLOORS)) {
      for (const id of floorCastIds(floor)) {
        expect(seen.has(id), `${id} em ${seen.get(id)} e ${floor.id}`).toBe(false);
        seen.set(id, floor.id);
      }
    }
    expect(seen.size).toBe(Object.keys(CAST).length);
  });

  it("só o elenco do Store Flow fica sem status ao vivo", () => {
    const offline = Object.values(CAST).filter((c) => !c.live).map((c) => c.id).sort();
    expect(offline).toEqual(["sf-driele", "sf-flow"]);
  });
});
