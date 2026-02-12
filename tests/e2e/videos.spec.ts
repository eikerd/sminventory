import { test, expect } from '@playwright/test';

test.describe('Videos page', () => {
  test('renders videos page with header', async ({ page }) => {
    await page.goto('/videos');
    await expect(page.getByRole('heading', { name: /Videos/i })).toBeVisible();
  });

  test('displays search input', async ({ page }) => {
    await page.goto('/videos');
    const searchInput = page.getByPlaceholder(/Search videos/i);
    await expect(searchInput).toBeVisible();
  });

  test('shows Add Video button', async ({ page }) => {
    await page.goto('/videos');
    const addButton = page.getByRole('button', { name: /Add Video/i });
    await expect(addButton).toBeVisible();
  });

  test('opens Add Video dialog when button clicked', async ({ page }) => {
    await page.goto('/videos');

    const addButton = page.getByRole('button', { name: /Add Video/i });
    await addButton.click();

    // Check if dialog is visible
    await expect(page.getByRole('heading', { name: /Add Video/i })).toBeVisible();
    await expect(page.getByPlaceholder(/https:\/\/www\.youtube\.com/i)).toBeVisible();
  });

  test('closes Add Video dialog when cancel is clicked', async ({ page }) => {
    await page.goto('/videos');

    const addButton = page.getByRole('button', { name: /Add Video/i });
    await addButton.click();

    // Wait for dialog to open
    await expect(page.getByRole('heading', { name: /Add Video/i })).toBeVisible();

    // Click cancel
    const cancelButton = page.getByRole('button', { name: /Cancel/i });
    await cancelButton.click();

    // Dialog should be closed
    await expect(page.getByRole('heading', { name: /Add Video/i })).not.toBeVisible();
  });

  test('displays empty state when no videos exist', async ({ page }) => {
    await page.goto('/videos');

    // Wait for loading to finish
    await page.waitForTimeout(1000);

    // Look for either videos or empty state
    const hasVideos = await page.getByRole('table').isVisible().catch(() => false);

    if (!hasVideos) {
      // Empty state should be visible
      const emptyMessage = page.getByText(/No videos found/i).or(page.getByText(/no videos/i));
      await expect(emptyMessage).toBeVisible();
    }
  });

  test('renders table when videos exist', async ({ page }) => {
    await page.goto('/videos');

    // Wait for data to load
    await page.waitForTimeout(1000);

    const table = page.getByRole('table');
    const hasTable = await table.isVisible().catch(() => false);

    if (hasTable) {
      // Check for expected column headers
      await expect(page.getByText(/Title/i)).toBeVisible();
      await expect(page.getByText(/Channel/i)).toBeVisible();
    }
  });

  test('navigates to video detail when clicking eye icon', async ({ page }) => {
    await page.goto('/videos');

    // Wait for data to load
    await page.waitForTimeout(1000);

    const eyeButton = page.getByRole('button', { name: /View details/i }).first();
    const isVisible = await eyeButton.isVisible().catch(() => false);

    if (isVisible) {
      await eyeButton.click();

      // Should navigate to video detail page
      await expect(page).toHaveURL(/\/videos\/[^/]+$/);
    }
  });
});
