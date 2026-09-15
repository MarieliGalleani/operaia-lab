import { describe, expect, it } from "vitest";
import { computeStaleClients } from "./niche-client.service.js";

describe("computeStaleClients", () => {
  const now = new Date("2026-09-15T12:00:00.000Z");

  it("nao marca cliente com atividade recente", () => {
    const signals = [
      { clientId: "1", clientName: "Padaria Sol", lastActivityAt: "2026-09-14T12:00:00.000Z" },
    ];
    expect(computeStaleClients(signals, now)).toHaveLength(0);
  });

  it("marca cliente parado ha mais que o limite de dias", () => {
    const signals = [
      { clientId: "1", clientName: "Padaria Sol", lastActivityAt: "2026-08-01T12:00:00.000Z" },
    ];
    const result = computeStaleClients(signals, now, 14);
    expect(result).toHaveLength(1);
    expect(result[0]!.clientId).toBe("1");
    expect(result[0]!.daysSinceActivity).toBeGreaterThanOrEqual(14);
  });

  it("nao marca cliente exatamente um dia abaixo do limite", () => {
    const signals = [
      { clientId: "1", clientName: "Padaria Sol", lastActivityAt: "2026-09-02T12:00:00.000Z" },
    ];
    expect(computeStaleClients(signals, now, 14)).toHaveLength(0);
  });

  it("ordena do mais parado pro menos parado", () => {
    const signals = [
      { clientId: "pouco-parado", clientName: "A", lastActivityAt: "2026-08-20T12:00:00.000Z" },
      { clientId: "muito-parado", clientName: "B", lastActivityAt: "2026-06-01T12:00:00.000Z" },
    ];
    const result = computeStaleClients(signals, now, 14);
    expect(result.map((r) => r.clientId)).toEqual(["muito-parado", "pouco-parado"]);
  });

  it("lida com lista vazia sem lancar erro", () => {
    expect(computeStaleClients([], now)).toEqual([]);
  });
});
