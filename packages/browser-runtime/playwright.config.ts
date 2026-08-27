import { defineConfig, devices } from "@playwright/test";
import { BROWSER_ALLOWED_HOSTS } from "./src/allowlist.js";
import { resolveBrowserMode } from "./src/modes.js";

const BASE = "https://lab.operaia.com.br";
const mode = resolveBrowserMode();
const isManual = mode === "MANUAL_AUTH";

/**
 * Playwright oficial OperaIA.lab.
 *
 * HEADLESS_READONLY (default / VM): headless, sem senha.
 * MANUAL_AUTH (OPERAIA_BROWSER_MANUAL=1): headed, so desktop — exige GUI.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: isManual ? 300_000 : 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  outputDir: "./evidence/test-output",
  use: {
    baseURL: BASE,
    headless: !isManual,
    trace: "off",
    video: "off",
    screenshot: "off",
    ignoreHTTPSErrors: false,
    extraHTTPHeaders: {},
  },
  grepInvert: isManual ? undefined : /@manual/,
  projects: isManual
    ? [
        {
          name: "desktop-chromium",
          use: {
            ...devices["Desktop Chrome"],
            headless: false,
            viewport: { width: 1280, height: 800 },
          },
        },
      ]
    : [
        {
          name: "desktop",
          use: {
            ...devices["Desktop Chrome"],
            viewport: { width: 1280, height: 800 },
          },
        },
        {
          name: "tablet",
          use: {
            ...devices["Desktop Chrome"],
            viewport: { width: 768, height: 1024 },
            isMobile: true,
            hasTouch: true,
          },
        },
        {
          name: "mobile",
          use: {
            ...devices["Pixel 7"],
            viewport: { width: 390, height: 844 },
            isMobile: true,
            hasTouch: true,
          },
        },
      ],
  metadata: {
    mode,
    allowedHosts: BROWSER_ALLOWED_HOSTS,
  },
});
