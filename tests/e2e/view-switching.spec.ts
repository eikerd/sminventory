import { test, expect } from "@playwright/test";

test.describe("View Switching", () => {
  test("Default view is table (no ?view param shows table)", async ({ page }) => {
    await page.goto("http://localhost:6660/models");

    // Check that DataTable is rendered
    const table = page.locator("table");
    await expect(table).toBeVisible();

    // Check that URL doesn't have view param
    expect(page.url()).not.toContain("?view=");
  });

  test("View switcher updates URL when toggling to cards", async ({ page }) => {
    await page.goto("http://localhost:6660/models");

    // Click Cards button
    const cardsButton = page.locator("button:has-text('Cards')");
    await cardsButton.click();

    // Check URL updated
    await expect(page).toHaveURL(/\?view=cards/);
  });

  test("URL persists on refresh - view preference retained", async ({ page }) => {
    await page.goto("http://localhost:6660/models?view=cards");

    // Should see cards view
    const scrollArea = page.locator("[role='region']");
    await expect(scrollArea).toBeVisible();

    // Refresh page
    await page.reload();

    // Should still see cards view
    await expect(scrollArea).toBeVisible();
    await expect(page).toHaveURL(/\?view=cards/);
  });

  test("View switcher works on all pages", async ({ page }) => {
    const pages = ["/models", "/workflows"];

    for (const pagePath of pages) {
      await page.goto(`http://localhost:6660${pagePath}`);

      // Find view switcher
      const viewSwitcher = page.locator("div.flex.gap-1.border.rounded-md");
      await expect(viewSwitcher).toBeVisible();

      // Click Cards button
      const cardsButton = viewSwitcher.locator("button:has-text('Cards')");
      if (await cardsButton.isVisible()) {
        await cardsButton.click();
        await expect(page).toHaveURL(/\?view=cards/);
      }
    }
  });
});
