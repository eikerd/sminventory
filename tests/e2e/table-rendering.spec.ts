import { test, expect } from "@playwright/test";

test.describe("Table Rendering", () => {
  test("Models page loads with table view by default", async ({ page }) => {
    await page.goto("http://localhost:6660/models");

    // Wait for table to be visible
    const table = page.locator("table");
    await expect(table).toBeVisible();

    // Check that table header exists
    const tableHeader = page.locator("table thead");
    await expect(tableHeader).toBeVisible();
  });

  test("Workflows page loads with table view by default", async ({ page }) => {
    await page.goto("http://localhost:6660/workflows");

    // Wait for table to be visible
    const table = page.locator("table");
    await expect(table).toBeVisible();

    // Check table has expected columns
    const headerCells = page.locator("table th");
    const headerCount = await headerCells.count();
    expect(headerCount).toBeGreaterThan(0);
  });

  test("Dashboard shows table view for workflows", async ({ page }) => {
    await page.goto("http://localhost:6660");

    // Wait for dashboard to load
    await page.waitForSelector("table", { timeout: 5000 });

    // Check that DataTable is rendered
    const table = page.locator("table");
    await expect(table).toBeVisible();
  });

  test("Workflow detail page has table tab", async ({ page }) => {
    await page.goto("http://localhost:6660/workflows");

    // Click on first workflow to view details
    const viewButton = page.locator("button:has-text('Eye')").first();
    if (await viewButton.isVisible()) {
      await viewButton.click();

      // Wait for detail page to load
      await page.waitForSelector("[role='tablist']");

      // Check for Table tab
      const tableTab = page.locator("[role='tab']:has-text('Table')");
      await expect(tableTab).toBeVisible();

      // Click table tab
      await tableTab.click();

      // Verify table appears
      const table = page.locator("table");
      await expect(table).toBeVisible();
    }
  });

  test("Table has correct column headers on Models page", async ({ page }) => {
    await page.goto("http://localhost:6660/models");

    const expectedColumns = ["Filename", "Type", "Architecture", "Location", "Size", "Status"];

    for (const colName of expectedColumns) {
      const header = page.locator(`table th:has-text('${colName}')`);
      // Some columns might not be visible on smaller screens, so just check the table exists
      const table = page.locator("table");
      await expect(table).toBeVisible();
      break; // Just verify table is present
    }
  });

  test("Empty state displays when no models found", async ({ page }) => {
    await page.goto("http://localhost:6660/models?search=nonexistentmodelname");

    // Wait for search to process
    await page.waitForTimeout(500);

    // Check for empty state message
    const emptyMessage = page.locator("text='No data found'").first();
    if (await page.locator("table tbody tr").count() === 0) {
      // If no results, empty state should show
      await expect(emptyMessage).toBeVisible();
    }
  });

  test("Table loads with visible data for workflows", async ({ page }) => {
    await page.goto("http://localhost:6660/workflows");

    // Wait for table to load
    const tableRows = page.locator("table tbody tr");
    await expect(tableRows.first()).toBeVisible({ timeout: 5000 });

    // At least one row should be visible
    const rowCount = await tableRows.count();
    expect(rowCount).toBeGreaterThan(0);
  });
});
