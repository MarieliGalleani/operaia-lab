import { describe, expect, it } from "vitest";
import { resolveWebhookSecret } from "./secret-resolver.js";

describe("resolveWebhookSecret", () => {
  it("usa GITHUB_WEBHOOK_SECRET quando secretRef ausente", () => {
    expect(
      resolveWebhookSecret(null, { GITHUB_WEBHOOK_SECRET: "sec-default" }),
    ).toBe("sec-default");
  });

  it("resolve env:VAR", () => {
    expect(
      resolveWebhookSecret("env:MY_GH_SECRET", {
        MY_GH_SECRET: "from-env",
        GITHUB_WEBHOOK_SECRET: "ignored",
      }),
    ).toBe("from-env");
  });

  it("retorna null se env ausente", () => {
    expect(resolveWebhookSecret("env:MISSING", {})).toBeNull();
  });
});
