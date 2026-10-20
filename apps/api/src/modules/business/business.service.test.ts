import { describe, expect, it } from "vitest";
import { dayInSaoPaulo } from "./business.service.js";

describe("dayInSaoPaulo", () => {
  it("pagamento às 22h de São Paulo continua no mesmo dia (UTC já virou)", () => {
    expect(dayInSaoPaulo(new Date("2026-10-21T01:30:00.000Z"))).toBe("2026-10-20");
  });

  it("meio-dia UTC é o mesmo dia em São Paulo", () => {
    expect(dayInSaoPaulo(new Date("2026-03-05T12:00:00.000Z"))).toBe("2026-03-05");
  });
});
