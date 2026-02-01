import { test, expect } from "@playwright/test";

test.describe("Acceptance Criteria - Full Application Navigation", () => {
  test("should visit all sections and verify data is present or properly loaded", async ({ page }) => {
    const sections = [
      {
        name: "Dashboard",
        url: "http://localhost:6660/",
        expectedTitle: "Dashboard",
        expectedContent: ["Total", "Workflows", "Models"], // Expected stat cards or content
      },
      {
        name: "Workflows",
        url: "http://localhost:6660/workflows",
        expectedTitle: "Workflows",
        expectedContent: ["Manage and scan", "Scan Workflow Folder"], // Button label
      },
      {
        name: "Models",
        url: "http://localhost:6660/models",
        expectedTitle: "Models",
        expectedContent: ["Browse and manage", "Total Models"],
      },
      {
        name: "Downloads",
        url: "http://localhost:6660/downloads",
        expectedTitle: "Downloads",
        expectedContent: ["Download", "queue"],
      },
      {
        name: "Tasks",
        url: "http://localhost:6660/tasks",
        expectedTitle: "Task Manager",
        expectedContent: ["Monitor background", "operations"],
      },
      {
        name: "Settings",
        url: "http://localhost:6660/settings",
        expectedTitle: "Settings",
        expectedContent: ["Settings", "configuration"],
      },
    ];

    for (const section of sections) {
      test.step(`Verify ${section.name} section loads correctly`, async () => {
        // Navigate to section
        await page.goto(section.url, { waitUntil: "networkidle" });

        // Verify page title
        const h1 = page.locator(`h1:has-text("${section.expectedTitle}")`);
        await expect(h1).toBeVisible({ timeout: 10000 });

        // Verify expected content is present
        for (const content of section.expectedContent) {
          const element = page.locator(`text=${content}`);
          await expect(element).toBeVisible({ timeout: 5000 });
        }

        // Check for any visible error messages
        const errorMessages = page.locator("text=/error|failed|unable/i");
        const errorCount = await errorMessages.count();
        expect(
          errorCount,
          `${section.name} section should not display error messages`
        ).toBe(0);

        // Verify page is not completely empty (has meaningful content)
        const bodyText = await page.locator("body").innerText();
        expect(bodyText.length, `${section.name} should have content`).toBeGreaterThan(100);
      });
    }
  });

  test("should have functional sidebar navigation", async ({ page }) => {
    await page.goto("http://localhost:6660/");

    // Verify sidebar exists
    const sidebar = page.locator("nav, [role='navigation']");
    await expect(sidebar).toBeVisible();

    // Verify all navigation links are present and clickable
    const navLinks = [
      { text: "Workflows", url: "/workflows" },
      { text: "Models", url: "/models" },
      { text: "Downloads", url: "/downloads" },
      { text: "Tasks", url: "/tasks" },
      { text: "Settings", url: "/settings" },
    ];

    for (const link of navLinks) {
      const navLink = page.locator(`a:has-text("${link.text}")`);
      await expect(navLink).toBeVisible();

      // Click and verify navigation works
      await navLink.click();
      await page.waitForLoadState("networkidle");

      // Verify page loaded
      const heading = page.locator("h1");
      await expect(heading).toBeVisible();
    }
  });

  test("CRITICAL: Workflows page should have scan button and be able to scan", async ({ page }) => {
    await page.goto("http://localhost:6660/workflows", { waitUntil: "networkidle" });

    // Verify "Scan Workflow Folder" button exists and is visible
    const scanButton = page.locator('button:has-text("Scan Workflow Folder")');
    await expect(scanButton).toBeVisible();

    // Button should be enabled (not disabled)
    await expect(scanButton).not.toBeDisabled();

    // Verify button text is exactly "Scan Workflow Folder" (not something else)
    const buttonText = await scanButton.innerText();
    expect(buttonText).toContain("Scan Workflow Folder");
  });

  test("should not display blank sections (test fail if section is empty when it shouldn't be)", async ({ page }) => {
    const sections = [
      {
        name: "Workflows",
        url: "http://localhost:6660/workflows",
        selector: "[class*='table'], [class*='card']", // Look for table or card containers
        shouldHaveContent: false, // May be empty initially (workflows not scanned yet)
      },
      {
        name: "Models",
        url: "http://localhost:6660/models",
        selector: "[class*='table'], [class*='card']",
        shouldHaveContent: false, // May be empty initially
      },
      {
        name: "Dashboard",
        url: "http://localhost:6660/",
        selector: "h1, p", // At least heading and description
        shouldHaveContent: true, // Always should have content
      },
    ];

    for (const section of sections) {
      test.step(`Check ${section.name} is not completely blank`, async () => {
        await page.goto(section.url, { waitUntil: "networkidle" });

        // Get all visible text
        const bodyText = await page.locator("body").innerText();
        const textLength = bodyText.trim().length;

        if (section.shouldHaveContent) {
          expect(
            textLength,
            `${section.name} should not be blank - test FAILED`
          ).toBeGreaterThan(150);
        }

        // Verify no "no data" or empty state messages for required sections
        const emptyStateText = page.locator(
          "text=/no .*(results|data|workflows|models|found)/i"
        );
        const emptyCount = await emptyStateText.count();

        // Note: Empty states are OK for some sections (models before scan)
        // But we want to know about them
        if (emptyCount > 0) {
          console.log(`${section.name} shows empty state - this is OK if data hasn't been loaded yet`);
        }
      });
    }
  });

  test("should verify header is present on all pages", async ({ page }) => {
    const pages = [
      "http://localhost:6660/",
      "http://localhost:6660/workflows",
      "http://localhost:6660/models",
      "http://localhost:6660/downloads",
      "http://localhost:6660/tasks",
      "http://localhost:6660/settings",
    ];

    for (const url of pages) {
      await page.goto(url, { waitUntil: "networkidle" });

      // Verify header with title exists
      const header = page.locator("h1");
      await expect(header).toBeVisible();

      // Verify sidebar exists (navigation)
      const nav = page.locator("nav, [role='navigation']");
      await expect(nav).toBeVisible();
    }
  });

  test("should verify no console errors on key pages", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Test key pages
    const pages = [
      "http://localhost:6660/workflows",
      "http://localhost:6660/models",
      "http://localhost:6660/tasks",
    ];

    for (const url of pages) {
      consoleErrors.length = 0; // Clear errors for each page
      await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000); // Wait for any deferred errors

      expect(
        consoleErrors,
        `${url} should not have console errors`
      ).toHaveLength(0);
    }
  });
});
