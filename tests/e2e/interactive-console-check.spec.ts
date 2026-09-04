import { test, expect } from "@playwright/test";

test("Check console errors during interactive actions", async ({ page }) => {
  const errors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(`${msg.text()} [${msg.location().url}:${msg.location().lineNumber}]`);
      console.log(`🔴 ERROR: ${msg.text()}`);
    }
  });

  // Test Workflows page with clicks
  console.log("\n📍 Testing /workflows...");
  await page.goto("/workflows", { waitUntil: "commit" });
  await page.waitForTimeout(500);

  // Click rescan button
  const rescanBtn = page.locator('button:has-text("Scan")');
  if (await rescanBtn.count() > 0) {
    console.log("  Clicking Scan button...");
    await rescanBtn.first().click();
    await page.waitForTimeout(1000);
  }

  // Click on a workflow item if available
  const workflowLinks = page.locator("a, [role='button']");
  if (await workflowLinks.count() > 0) {
    console.log("  Clicking workflow item...");
    try {
      await workflowLinks.first().click();
      await page.waitForTimeout(1000);
    } catch (e) {
      // Might fail, that's ok
    }
  }

  // Test Models page
  console.log("\n📍 Testing /models...");
  await page.goto("/models", { waitUntil: "commit" });
  await page.waitForTimeout(500);

  // Test Downloads page
  console.log("\n📍 Testing /downloads...");
  await page.goto("/downloads", { waitUntil: "commit" });
  await page.waitForTimeout(500);

  // Test Tasks page
  console.log("\n📍 Testing /tasks...");
  await page.goto("/tasks", { waitUntil: "commit" });
  await page.waitForTimeout(500);

  // Test Settings page
  console.log("\n📍 Testing /settings...");
  await page.goto("/settings", { waitUntil: "commit" });
  await page.waitForTimeout(500);

  // Report
  console.log(`\n\n=== CONSOLE ERROR REPORT ===`);
  console.log(`Errors found: ${errors.length}`);

  if (errors.length > 0) {
    console.log("\n🔴 CRITICAL ERRORS DETECTED:");
    errors.forEach((err, i) => {
      console.log(`${i + 1}. ${err}`);
    });
    expect(errors).toHaveLength(0);
  } else {
    console.log("✅ No console errors during interactions!");
  }
});
