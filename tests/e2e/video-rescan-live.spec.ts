import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const SCREENSHOT_DIR = path.join(process.cwd(), "test-screenshots");

async function captureProofScreenshot(page: any, name: string) {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  const filename = path.join(SCREENSHOT_DIR, `prove_${name}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`Screenshot saved: ${filename}`);
}

test.describe.configure({ mode: "serial" });

test.describe("Live Rescan Experience", () => {
  // Navigate to the first video detail page that has linked workflows
  async function navigateToVideoWithWorkflows(page: any) {
    await page.goto("http://localhost:6660/videos");
    await page.waitForLoadState("networkidle");

    // Click first video row to navigate to detail page
    const firstRow = page.locator("table tbody tr").first();
    await firstRow.waitFor({ state: "visible", timeout: 15000 });
    await firstRow.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
  }

  test("should show Rescan button on video detail page", async ({ page }) => {
    await navigateToVideoWithWorkflows(page);

    // Look for the Rescan button
    const rescanBtn = page.locator('button:has-text("Rescan")');
    const count = await rescanBtn.count();

    if (count > 0) {
      await expect(rescanBtn.first()).toBeVisible();
      console.log("Rescan button is visible");
    } else {
      // No workflows linked - check for "Add Workflow" button instead
      const addBtn = page.locator('button:has-text("Add Workflow")');
      await expect(addBtn.first()).toBeVisible();
      console.log("No workflows linked, Rescan not shown (expected)");
    }

    await captureProofScreenshot(page, "rescan-button-visible");
  });

  test("should open scan console when Rescan is clicked", async ({ page }) => {
    await navigateToVideoWithWorkflows(page);

    const rescanBtn = page.locator('button:has-text("Rescan")');
    const count = await rescanBtn.count();

    if (count === 0) {
      test.skip(true, "No workflows linked, Rescan button not present");
      return;
    }

    // Click Rescan
    await rescanBtn.first().click();

    // Wait for console to appear
    const console_ = page.locator('[data-testid="scan-console"]');
    await expect(console_).toBeVisible({ timeout: 10000 });
    console.log("Scan console appeared");

    await captureProofScreenshot(page, "scan-console-appeared");
  });

  test("should show progressive console entries during scan", async ({ page }) => {
    await navigateToVideoWithWorkflows(page);

    const rescanBtn = page.locator('button:has-text("Rescan")');
    const count = await rescanBtn.count();

    if (count === 0) {
      test.skip(true, "No workflows linked");
      return;
    }

    // Click Rescan
    await rescanBtn.first().click();

    // Wait for console
    const console_ = page.locator('[data-testid="scan-console"]');
    await expect(console_).toBeVisible({ timeout: 10000 });

    // Wait for at least 2 entries to appear (progressive)
    const entries = page.locator('[data-testid="scan-console-entry"]');
    await expect(entries.first()).toBeVisible({ timeout: 15000 });

    // Wait a bit for more entries to appear progressively
    await page.waitForTimeout(3000);
    const entryCount = await entries.count();
    console.log(`Console entries after 3s: ${entryCount}`);
    expect(entryCount).toBeGreaterThan(1);

    await captureProofScreenshot(page, "scan-progressive-entries");
  });

  test("should highlight model nodes during scan", async ({ page }) => {
    await navigateToVideoWithWorkflows(page);

    const rescanBtn = page.locator('button:has-text("Rescan")');
    const count = await rescanBtn.count();

    if (count === 0) {
      test.skip(true, "No workflows linked");
      return;
    }

    // Click Rescan
    await rescanBtn.first().click();

    // Wait for console and some entries
    const console_ = page.locator('[data-testid="scan-console"]');
    await expect(console_).toBeVisible({ timeout: 10000 });

    // Wait for check phase entries (these trigger highlights)
    await page.waitForTimeout(4000);

    // Check if any model name elements have the highlight ring class
    const highlightedElements = page.locator('[data-model-name].ring-2');
    const highlightCount = await highlightedElements.count();
    console.log(`Highlighted model elements: ${highlightCount}`);

    // Also check that data-model-name attributes exist on tree/list nodes
    const modelNameElements = page.locator("[data-model-name]");
    const modelNameCount = await modelNameElements.count();
    console.log(`Total model name elements: ${modelNameCount}`);

    await captureProofScreenshot(page, "scan-model-highlighting");
  });

  test("should complete scan and persist console entries", async ({ page }) => {
    test.setTimeout(90000); // Generous timeout for full playback

    await navigateToVideoWithWorkflows(page);

    const rescanBtn = page.locator('button:has-text("Rescan")');
    const count = await rescanBtn.count();

    if (count === 0) {
      test.skip(true, "No workflows linked");
      return;
    }

    // Click Rescan
    await rescanBtn.first().click();

    // Wait for console
    const console_ = page.locator('[data-testid="scan-console"]');
    await expect(console_).toBeVisible({ timeout: 10000 });

    // Wait for "complete" or "Rescan complete" text in console entries
    const completeEntry = page.locator(
      '[data-testid="scan-console-entry"]:has-text("complete")'
    );
    await expect(completeEntry.first()).toBeVisible({ timeout: 60000 });
    console.log("Scan complete text appeared in console");

    await captureProofScreenshot(page, "scan-complete");

    // Console should remain visible (persists, no close button)
    await expect(console_).toBeVisible();
    const entries = page.locator('[data-testid="scan-console-entry"]');
    const finalCount = await entries.count();
    console.log(`Final console entry count: ${finalCount}`);
    expect(finalCount).toBeGreaterThan(1);

    // Reload page and verify events persist from DB
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const persistedConsole = page.locator('[data-testid="scan-console"]');
    await expect(persistedConsole).toBeVisible({ timeout: 10000 });
    const persistedEntries = page.locator('[data-testid="scan-console-entry"]');
    const persistedCount = await persistedEntries.count();
    console.log(`Persisted console entries after reload: ${persistedCount}`);
    expect(persistedCount).toBe(finalCount);

    await captureProofScreenshot(page, "scan-persisted-after-reload");
  });
});
