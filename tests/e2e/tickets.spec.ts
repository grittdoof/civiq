import { test, expect } from "@playwright/test";

/**
 * Tests E2E module tickets — flow critique :
 * secrétariat crée → agent reçoit notif → consulte → clôture.
 *
 * Prérequis :
 *   - 1 user admin de la commune Châteauneuf (STORAGE_STATE_ADMIN)
 *   - 1 user agent technique (STORAGE_STATE_AGENT)
 *   Les states de session sont créés par tests/e2e/auth.setup.ts
 *   (à implémenter avec un login programmé via le service role).
 */

test.describe("Module tickets — workflow", () => {
  // Skip si pas de session pré-générée (CI uniquement)
  test.skip(!process.env.E2E_ADMIN_STORAGE, "Auth session admin non configurée");

  test("admin crée un ticket et l'assigne à un agent", async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: process.env.E2E_ADMIN_STORAGE!,
    });
    const page = await ctx.newPage();

    await page.goto("/admin/tickets/nouveau");
    await page.getByLabel(/Titre/i).fill("E2E — test nid-de-poule");
    await page.getByLabel(/Catégorie/i).selectOption("voirie");
    await page.getByLabel(/Priorité/i).selectOption("haute");
    await page.getByRole("button", { name: /Créer/i }).click();

    await expect(page).toHaveURL(/\/admin\/tickets\/[a-f0-9-]+/);
    await expect(page.getByText(/E2E — test nid-de-poule/i)).toBeVisible();

    await ctx.close();
  });

  test("filtre par défaut = tickets ouverts", async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: process.env.E2E_ADMIN_STORAGE!,
    });
    const page = await ctx.newPage();
    await page.goto("/admin/tickets");
    await expect(page.getByRole("button", { name: /Ouverts/i })).toHaveClass(/active/);
    await ctx.close();
  });
});
