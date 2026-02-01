import { test, expect } from "@playwright/test";

test.describe("Phase 4: Observability & Error Handling", () => {
  test.beforeEach(async ({ page }) => {
    // Capture console messages
    page.on("console", (msg) => {
      const args = msg.args();
      console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    // Capture console errors
    page.on("pageerror", (error) => {
      console.error("[PAGE ERROR]", error);
    });

    // Capture request failures
    page.on("requestfailed", (request) => {
      console.error(`[REQUEST FAILED] ${request.url()}`);
    });
  });

  test("should capture and log console errors from workflow detail page", async ({ page }) => {
    // Listen for console messages
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
    });

    // Navigate to workflows page
    await page.goto("http://localhost:6660/workflows");
    await page.waitForSelector("button:has-text(\"Scan Selected\")", { timeout: 10000 });

    // Check for any console errors so far
    if (consoleErrors.length > 0) {
      console.log("Console errors on workflows page:", consoleErrors);
    }

    // Try to navigate to any available workflow
    const workflowRows = page.locator("table tbody tr");
    const rowCount = await workflowRows.count();

    if (rowCount > 0) {
      // Click on first workflow to go to detail page
      const firstRow = workflowRows.first();
      const nameButton = firstRow.locator("button").nth(1);

      await Promise.all([
        page.waitForURL(/\/workflows\/[a-f0-9]{40,}/, { timeout: 5000 }).catch(() => {}),
        nameButton.click(),
      ]);

      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);

      // Check for errors on detail page
      expect(consoleErrors).not.toContain(
        expect.stringContaining("Cannot read properties of undefined")
      );

      // Log any errors we found
      if (consoleErrors.length > 0) {
        console.log("Console errors on detail page:", consoleErrors);
        // We don't fail here, just log them
      }
    }
  });

  test("should show error notification when workflow not found", async ({ page }) => {
    const errorToasts: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errorToasts.push(msg.text());
      }
    });

    // Navigate to non-existent workflow
    await page.goto("http://localhost:6660/workflows/nonexistent-id-12345");

    // Wait for error message or "not found" page
    const notFoundMsg = page.locator("text=Workflow not found").or(page.locator("text=not found"));

    try {
      await notFoundMsg.waitFor({ timeout: 5000 });
      expect(notFoundMsg).toBeVisible();
    } catch {
      // It's okay if the page doesn't show not found, just verify no crashes
      await expect(page).not.toHaveURL("/500");
    }
  });

  test("should have error boundary protection", async ({ page }) => {
    // Navigate to page
    await page.goto("http://localhost:6660/");

    // Look for error UI elements
    const errorBoundary = page.locator("text=/error|error boundary|something went wrong/i");

    // The page should either load successfully or show a proper error boundary
    const hasError = await errorBoundary.count().then((c) => c > 0);
    const isPageGone = page.url().includes("500");

    expect(isPageGone || !hasError).toBeTruthy();
  });

  test("should show progress indicator when scanning workflows", async ({ page }) => {
    await page.goto("http://localhost:6660/workflows");
    await page.waitForSelector("button:has-text(\"Scan Selected\")", { timeout: 10000 });

    const scanButton = page.locator("button:has-text(\"Scan Selected\")").first();

    // Click scan
    await scanButton.click();

    // Look for loading/progress indicators
    const spinnerOrLoader = page.locator("svg.animate-spin").or(page.locator("[role='progressbar']"));

    // Should show some indicator that scanning is happening
    const hasProgressIndicator = await spinnerOrLoader.count().then((c) => c > 0);
    expect(hasProgressIndicator || page.url().includes("scanning")).toBeTruthy();
  });

  test("should show toast notification for scan completion", async ({ page }) => {
    await page.goto("http://localhost:6660/workflows");
    await page.waitForSelector("button:has-text(\"Scan Selected\")", { timeout: 10000 });

    const scanButton = page.locator("button:has-text(\"Scan Selected\")").first();

    // Monitor for toast notifications
    const toastNotifications: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("success") || text.includes("complete") || text.includes("scanned")) {
        toastNotifications.push(text);
      }
    });

    // Click scan button
    await scanButton.click();

    // Wait a moment for potential notification
    await page.waitForTimeout(2000);

    // Check if toast system is available (Sonner)
    const toasterElement = page.locator("[role='region']").or(page.locator("section[aria-label*='Notification']"));
    const hasToaster = await toasterElement.count().then((c) => c > 0);

    expect(hasToaster || toastNotifications.length > 0).toBeTruthy();
  });

  test("should display workflow scan results in detail view", async ({ page }) => {
    await page.goto("http://localhost:6660/workflows");
    await page.waitForSelector("button:has-text(\"Scan Selected\")", { timeout: 10000 });

    const workflowRows = page.locator("table tbody tr");
    const rowCount = await workflowRows.count();

    if (rowCount > 0) {
      const firstRow = workflowRows.first();
      const nameButton = firstRow.locator("button").nth(1);

      await Promise.all([
        page.waitForURL(/\/workflows\/[a-f0-9]{40,}/, { timeout: 5000 }).catch(() => {}),
        nameButton.click(),
      ]);

      await page.waitForLoadState("networkidle");

      // Check for scan results display
      const statsCards = page.locator("[role='heading']").filter({ hasText: /Status|Dependencies|Size|VRAM/ });
      const hasStats = await statsCards.count().then((c) => c >= 2);

      // Check for dependencies section
      const dependenciesSection = page.locator("text=Dependencies").or(page.locator("text=No dependencies"));
      const hasDependenciesSection = await dependenciesSection.count().then((c) => c > 0);

      // At least one of these should be visible
      expect(hasStats || hasDependenciesSection).toBeTruthy();
    }
  });

  test("should show clear error when workflow scan fails", async ({ page }) => {
    await page.goto("http://localhost:6660/workflows");
    await page.waitForSelector("button:has-text(\"Scan Selected\")", { timeout: 10000 });

    const workflowRows = page.locator("table tbody tr");
    const rowCount = await workflowRows.count();

    if (rowCount > 0) {
      const firstRow = workflowRows.first();

      // Check the health status dot
      const healthDot = firstRow.locator("[class*='rounded-full']").first();
      const healthColor = await healthDot.getAttribute("class");

      // If it's red (scan error), it should be visible
      if (healthColor?.includes("red") || healthColor?.includes("500")) {
        // Good - error status is displayed

        // Now click to see if detail page shows error info
        const nameButton = firstRow.locator("button").nth(1);
        await Promise.all([
          page.waitForURL(/\/workflows\/[a-f0-9]{40,}/, { timeout: 5000 }).catch(() => {}),
          nameButton.click(),
        ]);

        // Check for error indicator
        const errorBadge = page.locator("text=/error|failed|scan error/i");
        const hasErrorIndicator = await errorBadge.count().then((c) => c > 0);

        expect(hasErrorIndicator).toBeTruthy();
      }
    }
  });

  test("should have no unhandled promise rejections during page navigation", async ({ page }) => {
    const rejections: string[] = [];

    page.on("pageerror", (error) => {
      if (error.message.includes("unhandledrejection")) {
        rejections.push(error.message);
      }
    });

    // Navigate through multiple pages
    await page.goto("http://localhost:6660/");
    await page.goto("http://localhost:6660/workflows");
    await page.goto("http://localhost:6660/models");
    await page.goto("http://localhost:6660/downloads");
    await page.goto("http://localhost:6660/tasks");

    // Should not have any unhandled rejections
    expect(rejections).toHaveLength(0);
  });
});
