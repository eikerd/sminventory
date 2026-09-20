import { test, expect } from "@playwright/test";

test("Check console errors on home page http://localhost:6660/", async ({ page }) => {
  const errors: Array<{ type: string; text: string; location: string; line: number }> = [];
  const warnings: string[] = [];
  const logs: string[] = [];

  // Capture ALL console messages with full details
  page.on("console", (msg) => {
    const entry = {
      type: msg.type(),
      text: msg.text(),
      location: msg.location().url,
      line: msg.location().lineNumber,
    };

    console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    console.log(`  → ${msg.location().url}:${msg.location().lineNumber}`);

    if (msg.type() === "error") {
      errors.push(entry);
    } else if (msg.type() === "warning") {
      warnings.push(msg.text());
    } else if (msg.type() === "log") {
      logs.push(msg.text());
    }
  });

  // Also capture uncaught exceptions
  page.on("pageerror", (error) => {
    console.log(`\n🔴 PAGE ERROR (UNCAUGHT): ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
    errors.push({
      type: "uncaught",
      text: error.message,
      location: "uncaught exception",
      line: 0,
    });
  });

  console.log("\n========== LOADING HOME PAGE ==========");
  console.log("URL: http://localhost:6660/\n");

  // Navigate to home page
  await page.goto("/", { waitUntil: "commit" });
  console.log("✓ Page navigated (commit)");

  // Wait for network to settle
  await page.waitForTimeout(2000);
  console.log("✓ Waited 2 seconds for async operations");

  // Wait for any pending requests
  try {
    await page.waitForLoadState("networkidle", { timeout: 5000 });
    console.log("✓ Network idle");
  } catch (e) {
    console.log("⚠ Network still busy after 5s (timeout)");
  }

  // Check page content
  const bodyText = await page.locator("body").textContent();
  console.log(`✓ Page has content (${bodyText?.length || 0} chars)`);

  // Try to interact with the page
  const buttons = await page.locator("button").count();
  const links = await page.locator("a").count();
  console.log(`✓ Found ${buttons} buttons and ${links} links`);

  // Click first button if available
  if (buttons > 0) {
    try {
      await page.locator("button").first().click();
      await page.waitForTimeout(500);
      console.log("✓ Clicked first button");
    } catch (e) {
      console.log(`⚠ Could not click button: ${e}`);
    }
  }

  // REPORT
  console.log("\n\n========== CONSOLE ERROR REPORT ==========\n");
  console.log(`📊 Statistics:`);
  console.log(`   Errors: ${errors.length}`);
  console.log(`   Warnings: ${warnings.length}`);
  console.log(`   Logs: ${logs.length}`);

  if (errors.length > 0) {
    console.log("\n🔴 CRITICAL ERRORS FOUND:\n");
    errors.forEach((err, i) => {
      console.log(`${i + 1}. ${err.text}`);
      console.log(`   File: ${err.location}:${err.line}`);
      console.log(`   Type: ${err.type}\n`);
    });

    expect(errors).toHaveLength(0);
  } else {
    console.log("\n✅ No console errors on home page!");
  }

  if (warnings.length > 0) {
    console.log("\n⚠️  Warnings detected:");
    warnings.forEach((w) => console.log(`  - ${w}`));
  }
});
