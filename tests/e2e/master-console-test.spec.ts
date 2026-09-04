import { test, expect } from "@playwright/test";

/**
 * MASTER CONSOLE ERROR TEST
 * Runs on every page and FAILS if any console errors are detected
 * This is a critical test that blocks testing of other features
 */
test.describe("Master Console Error Test - CRITICAL", () => {
  const pages = ["/", "/workflows", "/models", "/downloads", "/tasks", "/settings"];

  pages.forEach((pageUrl) => {
    test(`No console errors on ${pageUrl}`, async ({ page }) => {
      const errors: Array<{ text: string; location: string; line: number }> = [];

      // Capture errors
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          errors.push({
            text: msg.text(),
            location: msg.location().url,
            line: msg.location().lineNumber,
          });
          console.log(`🔴 ERROR on ${pageUrl}: ${msg.text()}`);
        }
      });

      // Capture uncaught exceptions
      page.on("pageerror", (error) => {
        errors.push({
          text: `Uncaught: ${error.message}`,
          location: "page error",
          line: 0,
        });
        console.log(`🔴 UNCAUGHT ERROR on ${pageUrl}: ${error.message}`);
      });

      // Navigate
      await page.goto(pageUrl, { waitUntil: "commit" });
      await page.waitForTimeout(2000);

      // Try to wait for network
      try {
        await page.waitForLoadState("networkidle", { timeout: 5000 });
      } catch {
        // Network still busy, that's ok
      }

      // Report
      if (errors.length > 0) {
        console.log(`\n🔴 CRITICAL FAILURE on ${pageUrl}:`);
        errors.forEach((err, i) => {
          console.log(`  ${i + 1}. ${err.text}`);
          console.log(`     File: ${err.location}:${err.line}`);
        });
        expect(errors).toHaveLength(
          0,
          `Page ${pageUrl} has console errors that must be fixed`
        );
      } else {
        console.log(`✅ ${pageUrl} - No console errors`);
      }
    });
  });
});
