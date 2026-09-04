import { test, expect } from "@playwright/test";

test("AGGRESSIVE: Capture ALL console errors including pre-load", async ({ page, context }) => {
  const allMessages: Array<{ type: string; text: string; time: number }> = [];
  const errors: Array<{ text: string; time: number }> = [];
  let startTime = Date.now();

  // Attach BEFORE navigation
  page.on("console", (msg) => {
    const time = Date.now() - startTime;
    const entry = { type: msg.type(), text: msg.text(), time };
    allMessages.push(entry);

    if (msg.type() === "error") {
      errors.push({ text: msg.text(), time });
      console.log(`[${time}ms] 🔴 ERROR: ${msg.text()}`);
    } else {
      console.log(`[${time}ms] [${msg.type().toUpperCase()}] ${msg.text()}`);
    }
  });

  page.on("pageerror", (err) => {
    const time = Date.now() - startTime;
    errors.push({ text: `UNCAUGHT: ${err.message}`, time });
    console.log(`[${time}ms] 🔴 PAGE ERROR: ${err.message}\n${err.stack}`);
  });

  console.log("Navigation starting...");
  startTime = Date.now();

  // Navigate to dashboard
  await page.goto("/", { waitUntil: "commit" });
  console.log("Page navigated");

  // Wait for hydration and async operations
  await page.waitForTimeout(3000);
  console.log("Waited 3 seconds");

  // Try network idle
  try {
    await page.waitForLoadState("networkidle", { timeout: 5000 });
    console.log("Network idle");
  } catch {
    console.log("Network still busy");
  }

  // Get all visible text to ensure page fully loaded
  const bodyText = await page.locator("body").textContent();
  console.log(`Page has ${bodyText?.length || 0} chars of content`);

  console.log(`\n\n========== RESULTS ==========`);
  console.log(`Total messages: ${allMessages.length}`);
  console.log(`Errors: ${errors.length}`);

  console.log(`\nAll messages in order:`);
  allMessages.forEach((msg, i) => {
    console.log(`  ${i + 1}. [${msg.time}ms] [${msg.type}] ${msg.text.substring(0, 100)}`);
  });

  if (errors.length > 0) {
    console.log(`\n🔴 CRITICAL: ${errors.length} ERROR(S) FOUND:`);
    errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.text}`);
    });

    expect(errors.length).toBe(0);
  } else {
    console.log(`\n✅ No errors detected`);
  }
});
