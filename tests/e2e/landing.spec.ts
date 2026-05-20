import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("hero affiche la promesse principale + CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/GoCiviq/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Au moins un CTA "Réserver une démo" dans le hero/nav
    const demos = page.getByRole("link", { name: /Réserver une démo/i });
    await expect(demos.first()).toBeVisible();
  });

  test("navigation vers /auth/login fonctionne", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Connexion/i }).first().click();
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByRole("heading", { name: /Connexion/i })).toBeVisible();
  });

  test("manifest est accessible et bien formé", async ({ request }) => {
    const r = await request.get("/manifest.webmanifest");
    expect(r.status()).toBe(200);
    const json = await r.json();
    expect(json.name).toContain("GoCiviq");
    expect(json.icons.length).toBeGreaterThan(0);
    expect(json.shortcuts.length).toBeGreaterThanOrEqual(2);
  });

  test("service worker est servi avec les bons headers", async ({ request }) => {
    const r = await request.get("/sw.js");
    expect(r.status()).toBe(200);
    expect(r.headers()["cache-control"]).toContain("max-age=0");
    expect(r.headers()["service-worker-allowed"]).toBe("/");
  });
});
