import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { test, expect } from "./fixtures.js";

const STORAGE = resolve(
  process.cwd(),
  "evidence/storage/lab-admin.storage.json",
);

/**
 * @office — Office Status.
 * HEADLESS_READONLY: redirect sem sessao + API 401.
 * Autenticado: so se existir storage de MANUAL_AUTH (GUI previa).
 */
test.describe("Office Status unauth @office @headless", () => {
  test("sem sessao: redirect + API 401", async ({
    safePage,
    collectEvidence,
  }) => {
    const page = safePage;
    await page.goto("/app/office/status", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/);

    const api = await page.request.get(
      "https://api.operaia.com.br/api/v1/office/status",
    );

    const evidence = await collectEvidence({
      name: "office-status-unauth",
      checks: [
        {
          name: "redirect_login",
          ok: /\/login/.test(page.url()),
          detail: page.url(),
        },
        {
          name: "api_401",
          ok: api.status() === 401,
          detail: `status=${api.status()}`,
        },
      ],
      screenshotName: "office-status-unauth",
    });
    expect(evidence.checks.every((c) => c.ok)).toBe(true);
  });
});

test.describe("Office Status autenticado @office", () => {
  test.skip(
    !existsSync(STORAGE),
    "Sem storage MANUAL_AUTH — pule autenticado no headless",
  );

  test.use({ storageState: STORAGE });

  test("secoes autenticadas", async ({ safePage, collectEvidence }) => {
    const page = safePage;
    await page.goto("/app/office/status", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/app\/office\/status/);
    await expect(page.locator(".office-status__hero")).toBeVisible({
      timeout: 30_000,
    });

    const level =
      (await page.locator(".office-status__level").textContent()) ?? "";
    const levelOk = /OPERANDO|ATENÇÃO|ATENCAO|PROBLEMA/i.test(level);

    await expect(page.getByText("Agora", { exact: true })).toBeVisible();
    await expect(page.getByText("Atenção", { exact: true })).toBeVisible();
    await expect(page.locator("#office-decisions")).toBeVisible();
    await expect(page.getByText(/Concluído/i).first()).toBeVisible();
    await expect(
      page.getByText(/Precisa de você|não precisa de você/i).first(),
    ).toBeVisible();

    const evidence = await collectEvidence({
      name: "office-status-auth",
      checks: [
        { name: "hero_level", ok: levelOk, detail: level.trim().slice(0, 40) },
        { name: "sections", ok: true },
      ],
      screenshotName: "office-status-auth",
    });
    expect(evidence.checks.every((c) => c.ok)).toBe(true);
  });
});
