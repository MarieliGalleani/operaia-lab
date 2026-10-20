import { describe, expect, it } from "vitest";

import { ELEVATOR_ORDER, OFFICE_FLOORS, findFloor, floorIdFromPath } from "@/data/office-floors";
import { OFFICE_3D_FLOORS, CAST, floorCastIds } from "@/modules/office-3d/floors-3d";
import { brl, dateBr, pct, TEMPLATE_CSV } from "@/modules/business/business-api";

describe("5º andar Negócio", () => {
  it("está na barra de andares como 05, no topo do elevador", () => {
    const floor = findFloor("negocio");
    expect(floor.code).toBe("05");
    expect(floor.name).toBe("Negócio");
    expect(OFFICE_FLOORS.map((f) => f.code)).toEqual(["01", "02", "03", "04", "05"]);
    expect(ELEVATOR_ORDER[0]?.id).toBe("negocio");
  });

  it("rotas do andar resolvem para ele", () => {
    for (const path of ["/app/floor/negocio/command", "/app/floor/negocio/work", "/app/floor/negocio/office"]) {
      expect(floorIdFromPath(path)).toBe("negocio");
    }
  });

  it("Aurora (Finanças) trabalha no andar 05 e não aparece duas vezes no prédio", () => {
    expect(floorCastIds(OFFICE_3D_FLOORS.negocio)).toEqual(["aurora"]);
    expect(CAST.aurora?.role).toBe("Finanças");
    const everywhere = Object.values(OFFICE_3D_FLOORS).flatMap(floorCastIds);
    expect(everywhere.filter((id) => id === "aurora")).toHaveLength(1);
  });
});

describe("formatação do andar Negócio", () => {
  it("formata real, porcentagem e data em português", () => {
    expect(brl(1234.4).replace(/\s/g, " ")).toBe("R$ 1.234");
    expect(pct(12.34)).toBe("12,3%");
    expect(pct(null)).toBe("—");
    expect(dateBr("2026-03-05")).toBe("05/03/2026");
  });

  it("o modelo de planilha tem o cabeçalho que a API entende", () => {
    expect(TEMPLATE_CSV.split("\n")[0]).toBe("data;cliente;produto;valor;custo");
  });
});
