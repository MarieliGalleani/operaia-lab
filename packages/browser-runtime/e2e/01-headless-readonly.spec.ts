import { test, expect } from "./fixtures.js";

/**
 * @headless HEADLESS_READONLY — producao real, sem senha, sem sessao.
 */
test.describe("HEADLESS_READONLY production @headless @smoke", () => {
  test("lab root carrega", async ({
    safePage,
    collectEvidence,
    measureHorizontalOverflow,
  }) => {
    const page = safePage;
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    const status = response?.status() ?? 0;
    // Sem sessao: / → /app → /login
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    const overflow = await measureHorizontalOverflow();
    const main = page.locator("#login-title, .login-card, main");
    await expect(main.first()).toBeVisible();

    const evidence = await collectEvidence({
      name: "lab-root",
      checks: [
        {
          name: "http_ok",
          ok: status >= 200 && status < 400,
          detail: `status=${status}`,
        },
        { name: "redirect_login", ok: /\/login/.test(page.url()), detail: page.url() },
        { name: "main_visible", ok: true },
        { name: "no_h_overflow", ok: !overflow, detail: `overflow=${overflow}` },
      ],
      screenshotName: "lab-root",
    });
    expect(evidence.checks.every((c) => c.ok)).toBe(true);
  });

  test("login: formulario + API DNS/TLS sem submit", async ({
    safePage,
    collectEvidence,
    measureHorizontalOverflow,
  }) => {
    const page = safePage;
    let sawApiHost = false;
    page.on("request", (req) => {
      try {
        if (new URL(req.url()).hostname === "api.operaia.com.br") {
          sawApiHost = true;
        }
      } catch {
        // ignore
      }
    });

    const response = await page.goto("/login", { waitUntil: "networkidle" });
    const status = response?.status() ?? 0;

    await expect(page.locator("#login-title")).toBeVisible();
    await expect(page.locator("#admin-login")).toBeVisible();
    await expect(page.locator("#admin-password")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    const passwordValue = await page.locator("#admin-password").inputValue();
    expect(passwordValue).toBe("");

    const health = await page.request.get("https://api.operaia.com.br/health");
    const healthStatus = health.status();
    const me = await page.request.get("https://api.operaia.com.br/api/auth/me");
    const meStatus = me.status();

    const overflow = await measureHorizontalOverflow();

    const evidence = await collectEvidence({
      name: "login-form",
      checks: [
        {
          name: "login_http",
          ok: status >= 200 && status < 400,
          detail: `status=${status}`,
        },
        { name: "form_fields", ok: true },
        { name: "credential_field_empty", ok: passwordValue === "" },
        {
          name: "api_health",
          ok: healthStatus === 200,
          detail: `status=${healthStatus}`,
        },
        {
          name: "api_me_unauth",
          ok: meStatus === 401,
          detail: `status=${meStatus}`,
        },
        {
          name: "api_host_resolved",
          ok: sawApiHost || healthStatus === 200,
          detail: `pageHitApi=${sawApiHost}`,
        },
        { name: "no_h_overflow", ok: !overflow, detail: `overflow=${overflow}` },
      ],
      screenshotName: "login-form",
    });
    expect(evidence.checks.every((c) => c.ok)).toBe(true);
  });

  test("api.operaia.com.br/health", async ({ safePage, collectEvidence }) => {
    const page = safePage;
    const response = await page.request.get("https://api.operaia.com.br/health");
    const status = response.status();
    let bodyStatus: string | null = null;
    try {
      const json = (await response.json()) as { status?: string };
      bodyStatus = typeof json.status === "string" ? json.status : null;
    } catch {
      bodyStatus = null;
    }

    // Navegacao allowlist: abrir health no browser tambem.
    const nav = await page.goto("https://api.operaia.com.br/health", {
      waitUntil: "domcontentloaded",
    });

    const evidence = await collectEvidence({
      name: "api-health",
      checks: [
        { name: "health_http", ok: status === 200, detail: `status=${status}` },
        {
          name: "health_body",
          ok: bodyStatus === "ok",
          detail: `statusField=${bodyStatus}`,
        },
        {
          name: "health_nav",
          ok: (nav?.status() ?? 0) === 200,
          detail: `nav=${nav?.status() ?? "n/a"}`,
        },
      ],
      screenshotName: "api-health",
    });
    expect(evidence.checks.every((c) => c.ok)).toBe(true);
  });

  test("/app sem sessao redireciona para /login", async ({
    safePage,
    collectEvidence,
  }) => {
    const page = safePage;
    await page.goto("/app", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });

    const evidence = await collectEvidence({
      name: "app-unauth-redirect",
      checks: [
        {
          name: "redirect_login",
          ok: /\/login/.test(page.url()),
          detail: page.url(),
        },
      ],
      screenshotName: "app-unauth-redirect",
    });
    expect(evidence.checks[0]?.ok).toBe(true);
  });

  test("/app/office/status sem sessao redireciona para /login", async ({
    safePage,
    collectEvidence,
  }) => {
    const page = safePage;
    await page.goto("/app/office/status", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });

    // Endpoint protegido: 401 sem cookie (status-only).
    const office = await page.request.get(
      "https://api.operaia.com.br/api/v1/office/status",
    );
    const officeStatus = office.status();

    const evidence = await collectEvidence({
      name: "office-unauth-redirect",
      checks: [
        {
          name: "redirect_login",
          ok: /\/login/.test(page.url()),
          detail: page.url(),
        },
        {
          name: "office_api_protected",
          ok: officeStatus === 401,
          detail: `status=${officeStatus}`,
        },
      ],
      screenshotName: "office-unauth-redirect",
    });
    expect(evidence.checks.every((c) => c.ok)).toBe(true);
  });
});
