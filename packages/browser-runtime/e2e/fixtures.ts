import { test as base, expect, type Page, type ConsoleMessage } from "@playwright/test";
import { resolve } from "node:path";
import { assertAllowedBrowserUrl, isAllowedBrowserUrl } from "../src/allowlist.js";
import {
  writeBrowserEvidence,
  type BrowserCheckResult,
  type BrowserEvidence,
} from "../src/evidence.js";
import {
  sanitizeConsoleText,
  summarizeNetworkFailure,
} from "../src/sanitize.js";

type BrowserFixture = {
  readonly safePage: Page;
  readonly collectEvidence: (input: {
    readonly name: string;
    readonly checks: readonly BrowserCheckResult[];
    readonly screenshotName?: string;
  }) => Promise<BrowserEvidence>;
  readonly measureHorizontalOverflow: () => Promise<boolean>;
};

export const test = base.extend<BrowserFixture>({
  safePage: async ({ page }, use) => {
    page.on("framenavigated", (frame) => {
      if (frame !== page.mainFrame()) {
        return;
      }
      const url = frame.url();
      if (url === "about:blank" || url.startsWith("data:")) {
        return;
      }
      assertAllowedBrowserUrl(url);
    });
    await use(page);
  },

  measureHorizontalOverflow: async ({ page }, use) => {
    await use(async () => {
      return page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth > window.innerWidth + 1;
      });
    });
  },

  collectEvidence: async ({ page }, use, testInfo) => {
    const consoleSafe: string[] = [];
    const networkFailures: BrowserEvidence["networkFailures"][number][] = [];
    const errors: string[] = [];

    const onConsole = (msg: ConsoleMessage) => {
      if (msg.type() !== "error" && msg.type() !== "warning") {
        return;
      }
      const safe = sanitizeConsoleText(msg.text());
      if (safe) {
        consoleSafe.push(`[${msg.type()}] ${safe}`);
      }
    };
    const onPageError = (err: Error) => {
      const safe = sanitizeConsoleText(err.message);
      if (safe && safe !== "[redacted-sensitive]") {
        errors.push(safe);
      }
    };
    page.on("console", onConsole);
    page.on("pageerror", onPageError);
    page.on("response", (response) => {
      const status = response.status();
      if (status < 400) {
        return;
      }
      // 401 em /api/auth/me sem sessao e esperado — nao e falha de rede.
      try {
        const path = new URL(response.url()).pathname;
        if (path === "/api/auth/me" && status === 401) {
          return;
        }
      } catch {
        // continue
      }
      const url = response.url();
      if (!isAllowedBrowserUrl(url) && !url.includes("operaia.com.br")) {
        return;
      }
      const summary = summarizeNetworkFailure({
        url,
        status,
        statusText: response.statusText(),
      });
      if (summary) {
        networkFailures.push(summary);
      }
    });

    await use(async (input) => {
      let screenshotPath: string | null = null;
      if (input.screenshotName) {
        screenshotPath = resolve(
          testInfo.project.outputDir,
          "..",
          "screenshots",
          `${input.screenshotName}-${testInfo.project.name}.png`,
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });
      }

      const viewport = page.viewportSize() ?? { width: 0, height: 0 };
      const evidence: BrowserEvidence = {
        url: page.url(),
        timestamp: new Date().toISOString(),
        viewport,
        checks: input.checks,
        screenshotPath,
        errors: [...errors],
        consoleSafe: consoleSafe.slice(-40),
        networkFailures: networkFailures.slice(-40),
      };

      const evidenceFile = resolve(
        testInfo.project.outputDir,
        "..",
        "json",
        `${input.name}-${testInfo.project.name}.json`,
      );
      writeBrowserEvidence(evidenceFile, evidence);
      return evidence;
    });

    page.off("console", onConsole);
    page.off("pageerror", onPageError);
  },
});

export { expect };
