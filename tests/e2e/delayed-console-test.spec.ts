import { test, expect } from "@playwright/test";

/**
 * Test that waits longer for async operations and user interactions
 * to catch delayed errors that might not appear immediately
 */
test("Catch DELAYED console errors with extended wait", async ({ page }) => {
  const errors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(`${msg.text()} [${msg.location().url}:${msg.location().lineNumber}]`);
      console.log(`🔴 ERROR DETECTED: ${msg.text()}`);
    }
  });

  page.on("pageerror", (err) => {
    errors.push(`UNCAUGHT: ${err.message}`);
    console.log(`🔴 UNCAUGHT ERROR: ${err.message}`);
  });

  console.log("Loading dashboard...");
  await page.goto("/", { waitUntil: "commit" });

  // Wait for initial render
  await page.waitForTimeout(1000);

  // Trigger refetch/polling by waiting
  console.log("Waiting 5 seconds for polling/async operations...");
  await page.waitForTimeout(5000);

  // Try to trigger network
  console.log("Waiting for network...");
  try {
    await page.waitForLoadState("networkidle", { timeout: 8000 });
  } catch {
    // Ok if timeout
  }

  // Click buttons to trigger potential errors
  console.log("Clicking buttons to trigger interactions...");
  const buttons = await page.locator("button").count();
  console.log(`Found ${buttons} buttons`);

  if (buttons > 0) {
    try {
      await page.locator("button").first().click();
      await page.waitForTimeout(500);
      console.log("Clicked first button");
    } catch (e) {
      // Ok if fails
    }
  }

  // Wait for callbacks
  console.log("Waiting 3 more seconds for callbacks...");
  await page.waitForTimeout(3000);

  // Final check
  console.log(`\n========== FINAL RESULT ==========`);
  console.log(`Errors found: ${errors.length}`);

  if (errors.length > 0) {
    console.log(`\n🔴 CRITICAL ERRORS:\n`);
    errors.forEach((err, i) => {
      console.log(`${i + 1}. ${err}`);
    });
    expect(errors.length).toBe(0);
  } else {
    console.log(`✅ No errors after extended wait + interactions`);
  }
});
