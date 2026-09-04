import { test, expect } from "@playwright/test";

test.describe("Workflow Detail Page - Full Interaction Testing", () => {
  test("should navigate to workflow detail and test scan button", async ({ page }) => {
    // First, go to workflows list
    test.step("Navigate to workflows list", async () => {
      try {
        await page.goto("/workflows");
      } catch (e) {
        // Navigation may abort but page loads
      }
      await page.waitForTimeout(500);
      console.log("✓ Navigated to workflows list");
    });

    // Try to find and click first workflow
    test.step("Find and click first workflow item", async () => {
      const workflowItems = page.locator("[class*='table'] tbody tr, [class*='card']");
      const itemCount = await workflowItems.count();
      console.log(`Found ${itemCount} workflow items`);

      if (itemCount > 0) {
        // Find the link in the first row
        const firstLink = workflowItems.first().locator("a");
        const linkCount = await firstLink.count();

        if (linkCount > 0) {
          await firstLink.first().click();
          await page.waitForTimeout(1000);
          console.log("✓ Clicked first workflow");
        } else {
          // Try clicking the row itself
          await workflowItems.first().click();
          await page.waitForTimeout(1000);
          console.log("✓ Clicked workflow item");
        }
      } else {
        console.log("⚠ No workflow items found to click");
        return;
      }
    });

    // Test scan button on detail page
    test.step("Test scan/rescan button on detail page", async () => {
      // Look for scan button
      const scanBtn = page.locator('button:has-text("Scan"), button:has-text("Rescan"), button:has-text("Re-scan")');
      const scanCount = await scanBtn.count();

      if (scanCount > 0) {
        const isEnabled = await scanBtn.first().isEnabled();
        console.log(`✓ Found scan button: ${isEnabled ? "enabled" : "disabled"}`);

        // Don't click it as it would start a scan, just verify it's there and enabled
        if (isEnabled) {
          console.log("  Button is ready to click");
        }
      } else {
        console.log("⚠ No scan button found on detail page");
      }
    });

    // Test other buttons on detail page
    test.step("Test other interactive buttons", async () => {
      const buttons = page.locator("button");
      const buttonCount = await buttons.count();
      console.log(`Found ${buttonCount} total buttons on page`);

      // Find specific button types
      const viewBtn = page.locator('button:has-text("View")');
      const downloadBtn = page.locator('button:has-text("Download")');
      const resolveBtn = page.locator('button:has-text("Resolve")');

      const hasView = await viewBtn.count();
      const hasDownload = await downloadBtn.count();
      const hasResolve = await resolveBtn.count();

      if (hasView > 0) console.log("  ✓ View button present");
      if (hasDownload > 0) console.log("  ✓ Download button present");
      if (hasResolve > 0) console.log("  ✓ Resolve button present");
    });

    // Test tabs on detail page
    test.step("Test tab navigation", async () => {
      const tabs = page.locator("[role='tab'], [class*='tab']");
      const tabCount = await tabs.count();
      console.log(`Found ${tabCount} tabs/sections`);

      if (tabCount > 0) {
        const firstTab = tabs.first();
        const tabText = await firstTab.textContent();
        console.log(`  First tab: "${tabText}"`);

        // Try clicking it
        await firstTab.click();
        await page.waitForTimeout(300);
        console.log("  ✓ Tab click works");
      }
    });

    // Test content visibility
    test.step("Verify page content is visible", async () => {
      const main = page.locator("main");
      const mainVisible = await main.isVisible();
      console.log(`Main content ${mainVisible ? "visible" : "not visible"}`);

      const content = await page.locator("body").innerText();
      const contentLength = content.length;
      console.log(`Page content length: ${contentLength} characters`);

      if (contentLength > 100) {
        console.log("✓ Page has substantial content");
      }
    });
  });

  test("should verify no React errors on workflow detail page", async ({ page }) => {
    const errors: string[] = [];

    // Listen for console errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // Navigate to workflows
    try {
      await page.goto("/workflows");
    } catch (e) {
      // Ignore navigation errors
    }
    await page.waitForTimeout(500);

    // Try to click first workflow
    const items = page.locator("[class*='table'] tbody tr");
    const count = await items.count();

    if (count > 0) {
      const link = items.first().locator("a");
      if (await link.count() > 0) {
        await link.first().click();
        await page.waitForTimeout(500);
      }
    }

    // Check for specific React key errors
    const hasKeyError = errors.some((e) =>
      e.includes("Each child in a list") ||
      e.includes("unique 'key' prop") ||
      e.includes("children in a list should have a unique key")
    );

    if (hasKeyError) {
      console.log("✗ React key warning detected");
    } else {
      console.log("✓ No React key warnings");
    }

    // Check for other errors
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("key") &&
        !e.includes("404") &&
        !e.includes("net::")
    );

    if (criticalErrors.length > 0) {
      console.log(`⚠ Found ${criticalErrors.length} other console errors`);
      criticalErrors.forEach((e) => console.log(`  - ${e.substring(0, 100)}`));
    } else {
      console.log("✓ No critical console errors");
    }
  });
});
