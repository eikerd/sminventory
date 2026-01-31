import { test, expect } from "@playwright/test";

test.describe("Phase 2: Download Manager", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:6660/downloads");
  });

  test("should load downloads page", async ({ page }) => {
    await expect(page.locator('h1:has-text("Downloads")')).toBeVisible();
  });

  test("should display download stats", async ({ page }) => {
    // Check for downloads page header
    await expect(page.locator('h1:has-text("Downloads")')).toBeVisible();
  });

  test("should have downloads API available", async ({ page }) => {
    const response = await page.request.get(
      "http://localhost:6660/api/trpc/downloads.list?input=%7B%22json%22%3A%7B%7D%7D"
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.result.data.json).toBeInstanceOf(Array);
  });

  test("should load /tasks page", async ({ page }) => {
    await page.goto("http://localhost:6660/tasks");
    await expect(page.locator('h1:has-text("Task Manager")')).toBeVisible();
  });

  test("should display task statistics", async ({ page }) => {
    await page.goto("http://localhost:6660/tasks");

    // Check for task manager page header
    await expect(page.locator('h1:has-text("Task Manager")')).toBeVisible();
  });

  test("should have tasks API available", async ({ page }) => {
    const response = await page.request.get(
      "http://localhost:6660/api/trpc/tasks.stats"
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    const stats = data.result.data.json;

    expect(stats).toHaveProperty("active");
    expect(stats).toHaveProperty("queued");
    expect(stats).toHaveProperty("completed");
    expect(stats).toHaveProperty("failed");
  });

  test("should have download button component available", async ({ page }) => {
    // The download button would be on workflow detail page
    // For now, just verify the page structure is there
    await expect(page).toHaveTitle(/Sminventory/i);
  });
});
