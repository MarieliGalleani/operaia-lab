import { describe, expect, it } from "vitest";
import {
  assertAllowedBrowserUrl,
  isAllowedBrowserUrl,
} from "./allowlist.js";
import { sanitizeConsoleText } from "./sanitize.js";
import { BrowserMode, resolveBrowserMode } from "./modes.js";

describe("browser allowlist", () => {
  it("permite lab e api", () => {
    expect(isAllowedBrowserUrl("https://lab.operaia.com.br/login")).toBe(true);
    expect(isAllowedBrowserUrl("https://api.operaia.com.br/health")).toBe(true);
  });

  it("bloqueia hosts externos", () => {
    expect(isAllowedBrowserUrl("https://evil.example/x")).toBe(false);
    expect(() => assertAllowedBrowserUrl("https://evil.example")).toThrow(
      /allowlist/,
    );
  });
});

describe("sanitizeConsoleText", () => {
  it("redige senha/token", () => {
    expect(sanitizeConsoleText("password=secret")).toBe("[redacted-sensitive]");
    expect(sanitizeConsoleText("Bearer abc.def")).toBe("[redacted-sensitive]");
  });

  it("mantem mensagem comum", () => {
    expect(sanitizeConsoleText("Route GET /health ok")).toContain("health");
  });
});

describe("browser modes", () => {
  it("default e HEADLESS_READONLY", () => {
    delete process.env.OPERAIA_BROWSER_MANUAL;
    expect(resolveBrowserMode()).toBe(BrowserMode.HEADLESS_READONLY);
  });

  it("OPERAIA_BROWSER_MANUAL=1 e MANUAL_AUTH", () => {
    process.env.OPERAIA_BROWSER_MANUAL = "1";
    expect(resolveBrowserMode()).toBe(BrowserMode.MANUAL_AUTH);
    delete process.env.OPERAIA_BROWSER_MANUAL;
  });
});
