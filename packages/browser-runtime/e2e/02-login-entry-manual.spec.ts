import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test, expect } from "./fixtures.js";

const STORAGE = resolve(
  process.cwd(),
  "evidence/storage/lab-admin.storage.json",
);

/**
 * @manual — fluxo de entrada REAL.
 * Nao preenche senha. Espera a usuaria autenticar no browser headed.
 *
 * Uso:
 *   OPERAIA_BROWSER_MANUAL=1 pnpm --filter @operaia/browser-runtime e2e:manual -- --headed --project=desktop-chromium
 */
test.describe("Login entry manual @manual", () => {
  test.skip(
    process.env.OPERAIA_BROWSER_MANUAL !== "1",
    "Defina OPERAIA_BROWSER_MANUAL=1 e rode headed para login manual",
  );

  test("entrada lab → login manual → /app → office/status", async ({
    safePage,
    collectEvidence,
  }) => {
    const page = safePage;
    const waitMs = Number(process.env.OPERAIA_BROWSER_MANUAL_TIMEOUT_MS ?? 300_000);

    let loginStatus: number | null = null;
    let meStatus: number | null = null;
    let officeApiStatus: number | null = null;

    page.on("response", (response) => {
      const url = response.url();
      const status = response.status();
      try {
        const path = new URL(url).pathname;
        if (path === "/api/auth/login" && response.request().method() === "POST") {
          loginStatus = status;
        }
        if (path === "/api/auth/me" && response.request().method() === "GET") {
          meStatus = status;
        }
        if (
          path === "/api/v1/office/status" &&
          response.request().method() === "GET"
        ) {
          officeApiStatus = status;
        }
      } catch {
        // ignore parse
      }
    });

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#admin-login")).toBeVisible();
    await expect(page.locator("#admin-password")).toBeVisible();

    // Marca campo — senha permanece manual (nao preenchida pelo teste).
    await page.locator("#admin-password").evaluate((el) => {
      el.setAttribute("data-operaia-manual-only", "1");
    });

    console.log(
      `[browser-runtime] Autentique MANUALMENTE em ${page.url()} (timeout ${waitMs}ms). Nao automatizamos a senha.`,
    );

    await page.waitForURL(/\/app(\/|$)/, { timeout: waitMs });
    const afterLogin = page.url();
    expect(afterLogin).toMatch(/lab\.operaia\.com\.br\/app/);

    // Garante /me 200 apos sessao (sem ler body).
    const meResponse = await page.request.get(
      "https://api.operaia.com.br/api/auth/me",
    );
    meStatus = meResponse.status();

    mkdirSync(dirname(STORAGE), { recursive: true });
    await page.context().storageState({ path: STORAGE });

    await page.goto("/app/office/status", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/app\/office\/status/);

    const hero = page.locator(".office-status__hero, .office-status__level");
    await expect(hero.first()).toBeVisible({ timeout: 30_000 });

    const levelText = await page.locator(".office-status__level").textContent();
    const hasLevel =
      /OPERANDO|ATENÇÃO|ATENCAO|PROBLEMA/i.test(levelText ?? "");

    const checks = [
      {
        name: "post_login_status",
        ok: loginStatus === 200,
        detail: `status=${loginStatus ?? "n/a"}`,
      },
      {
        name: "get_me_status",
        ok: meStatus === 200,
        detail: `status=${meStatus ?? "n/a"}`,
      },
      { name: "redirect_app", ok: /\/app/.test(afterLogin), detail: afterLogin },
      {
        name: "office_status_url",
        ok: /\/app\/office\/status/.test(page.url()),
        detail: page.url(),
      },
      {
        name: "office_level_chip",
        ok: hasLevel,
        detail: (levelText ?? "").trim().slice(0, 80),
      },
      {
        name: "office_api_status",
        ok: officeApiStatus == null || officeApiStatus === 200,
        detail: `status=${officeApiStatus ?? "pending-or-cached"}`,
      },
      {
        name: "storage_saved",
        ok: true,
        detail: "evidence/storage (gitignored)",
      },
    ];

    const evidence = await collectEvidence({
      name: "login-entry-manual",
      checks,
      screenshotName: "office-status-after-login",
    });

    expect(evidence.checks.every((c) => c.ok)).toBe(true);
  });
});
