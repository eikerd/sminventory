import { test, expect } from "@playwright/test";

test.describe("Filtering with Table View", () => {
  test("Apply search filter updates table", async ({ page }) => {
    await page.goto("http://localhost:6660/models");

    // Get initial row count
    const rowsBefore = await page.locator("table tbody tr").count();

    // Apply search
    const searchInput = page.locator("input[placeholder*='Search']").first();
    await searchInput.fill("test");

    // Wait for results to update
    await page.waitForTimeout(500);

    // Verify table is still visible and filtered
    const table = page.locator("table");
    await expect(table).toBeVisible();

    // Results should be filtered (fewer or equal rows)
    const rowsAfter = await page.locator("table tbody tr").count();
    expect(rowsAfter).toBeLessThanOrEqual(rowsBefore);
  });

  test("Apply type filter updates table", async ({ page }) => {
    await page.goto("http://localhost:6660/models");

    // Find type filter dropdown
    const typeFilterButton = page.locator("button:has-text('All Types')");
    await typeFilterButton.click();

    // Select a type (assuming "checkpoint" exists)
    const checkpointOption = page.locator("text='checkpoint'").first();
    if (await checkpointOption.isVisible()) {
      await checkpointOption.click();

      // Wait for results
      await page.waitForTimeout(500);

      // Verify table updates
      const table = page.locator("table");
      await expect(table).toBeVisible();
    }
  });

  test("View mode persists during filtering", async ({ page }) => {
    await page.goto("http://localhost:6660/models");

    // Switch to cards view
    const cardsButton = page.locator("button:has-text('Cards')");
    await cardsButton.click();

    await expect(page).toHaveURL(/\?view=cards/);

    // Apply search filter
    const searchInput = page.locator("input[placeholder*='Search']").first();
    await searchInput.fill("test");

    await page.waitForTimeout(500);

    // View mode should still be cards
    await expect(page).toHaveURL(/\?view=cards/);

    // Switch back to table
    const tableButton = page.locator("button:has-text('Table')");
    await tableButton.click();

    // View param should update
    await expect(page).not.toHaveURL(/\?view=cards/);
  });

  test("Workflows page filters preserve table state", async ({ page }) => {
    await page.goto("http://localhost:6660/workflows");

    // Click "Missing Models" filter
    const missingButton = page.locator("button:has-text('Missing Models')");
    await missingButton.click();

    // Wait for results
    await page.waitForTimeout(500);

    // Table should still be visible
    const table = page.locator("table");
    await expect(table).toBeVisible();

    // Table header should be present
    const tableHeader = page.locator("table thead");
    await expect(tableHeader).toBeVisible();
  });
});
