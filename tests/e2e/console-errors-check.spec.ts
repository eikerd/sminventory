import { test, expect } from "@playwright/test";

test("Capture all console errors on all pages", async ({ page }) => {
  const consoleMessages: Array<{ type: string; text: string; location?: string }> = [];
  const consoleErrors: typeof consoleMessages = [];

  // Capture console messages
  page.on("console", (msg) => {
    const entry = {
      type: msg.type(),
      text: msg.text(),
      location: msg.location().url,
    };
    consoleMessages.push(entry);

    if (msg.type() === "error") {
      consoleErrors.push(entry);
      console.log(`\n🔴 CONSOLE ERROR: ${msg.text()}`);
      console.log(`   Location: ${msg.location().url}:${msg.location().lineNumber}`);
    }
  });

  // Test each major page
  const pages = ["/", "/workflows", "/models", "/downloads", "/tasks", "/settings"];

  for (const pageUrl of pages) {
    console.log(`\nChecking ${pageUrl}...`);
    try {
      await page.goto(pageUrl, { waitUntil: "commit" });
      await page.waitForTimeout(1000);
    } catch (e) {
      // Ignore navigation errors
    }
  }

  // Report
  console.log(`\n\n=== FINAL REPORT ===`);
  console.log(`Total console messages: ${consoleMessages.length}`);
  console.log(`Console errors: ${consoleErrors.length}`);

  if (consoleErrors.length > 0) {
    console.log("\n🔴 ERRORS FOUND:");
    consoleErrors.forEach((err, i) => {
      console.log(`\n${i + 1}. ${err.text.substring(0, 200)}`);
      console.log(`   File: ${err.location}`);
    });

    // Fail the test if there are console errors
    expect(consoleErrors).toHaveLength(0);
  } else {
    console.log("\n✅ No console errors detected!");
  }
});
