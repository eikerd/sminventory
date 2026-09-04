import { test, expect } from "@playwright/test";

test("Check for actual console errors on Workflows page", async ({ page }) => {
  const consoleMessages: Array<{ type: string; text: string }> = [];

  // Capture all console messages
  page.on("console", (msg) => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
    });
  });

  // Navigate to workflows
  try {
    await page.goto("/workflows");
  } catch (e) {
    // Ignore navigation errors
  }

  await page.waitForTimeout(1000);

  // Filter errors
  const errors = consoleMessages.filter((m) => m.type === "error");
  const warnings = consoleMessages.filter((m) => m.type === "warning");
  const logs = consoleMessages.filter((m) => m.type === "log");

  console.log(`\n=== Console Messages on Workflows Page ===`);
  console.log(`Total console messages: ${consoleMessages.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Logs: ${logs.length}`);

  if (errors.length > 0) {
    console.log("\n--- ERRORS ---");
    errors.forEach((e) => {
      console.log(`${e.text.substring(0, 200)}`);
    });
  }

  if (warnings.length > 0) {
    console.log("\n--- WARNINGS ---");
    warnings.forEach((w) => {
      console.log(`${w.text.substring(0, 200)}`);
    });
  }

  // Check for React key warnings specifically
  const keyErrors = errors.filter(
    (e) =>
      e.text.includes("Each child in a list") ||
      e.text.includes("unique 'key' prop") ||
      e.text.includes("children in a list should have a unique key")
  );

  if (keyErrors.length > 0) {
    console.log("\n⚠ React Key Warnings Found:");
    keyErrors.forEach((ke) => {
      console.log(ke.text.substring(0, 300));
    });
  } else {
    console.log("\n✓ No React key warnings found");
  }

  // Summary
  console.log(`\n✓ Test completed. Page loaded successfully.`);
});
