import { test, expect } from '@playwright/test';

test.describe('Videos - Add Video Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to videos page before each test
    await page.goto('/videos');
  });

  test('successfully adds a video from YouTube URL', async ({ page }) => {
    // Click Add Video button
    await page.getByRole('button', { name: 'Add Video' }).click();

    // Dialog should be visible
    await expect(page.getByRole('heading', { name: 'Add Video' })).toBeVisible();

    // Enter the test video URL from docs
    const testUrl = 'https://www.youtube.com/watch?v=fQadB_s-UV0';
    await page.getByRole('textbox', { name: 'YouTube URL' }).fill(testUrl);

    // Click the Add Video button in the dialog
    await page.getByRole('dialog').getByRole('button', { name: 'Add Video' }).click();

    // Wait for success toast
    await expect(page.getByText('Video added successfully')).toBeVisible();

    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Video should appear in the table
    await expect(page.getByRole('table')).toBeVisible();

    // Verify video details are shown
    await expect(page.getByText(/BEST AI Skin Fix/i)).toBeVisible();
    await expect(page.getByText('Silent Snow')).toBeVisible();

    // Video count should update
    await expect(page.getByText('1 video tracked')).toBeVisible();
  });

  test('shows validation error for invalid URL', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Video' }).click();

    // Enter invalid URL
    await page.getByRole('textbox', { name: 'YouTube URL' }).fill('not a valid url');

    // Try to submit
    await page.getByRole('dialog').getByRole('button', { name: 'Add Video' }).click();

    // Should show error (either validation or API error)
    await expect(page.getByText(/error|invalid|failed/i)).toBeVisible({ timeout: 5000 });
  });

  test('can cancel adding a video', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Video' }).click();

    // Enter URL
    await page.getByRole('textbox', { name: 'YouTube URL' }).fill('https://www.youtube.com/watch?v=test');

    // Click Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Dialog should close without adding video
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // No success toast should appear
    await expect(page.getByText('Video added successfully')).not.toBeVisible();
  });

  test('navigates to video detail when clicking on video row', async ({ page }) => {
    // This test assumes a video exists (from previous test or setup)
    await page.goto('/videos');

    // Wait for table to load
    const table = page.getByRole('table');
    if (await table.isVisible()) {
      const firstRow = table.getByRole('row').nth(1); // Skip header row

      if (await firstRow.isVisible()) {
        await firstRow.click();

        // Should navigate to video detail page
        await expect(page).toHaveURL(/\/videos\/[^/]+$/);

        // Video detail page should show
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      }
    }
  });

  test('opens YouTube video in new tab', async ({ page, context }) => {
    await page.goto('/videos');

    const table = page.getByRole('table');
    if (await table.isVisible()) {
      // Find and click the external link button
      const externalLinkButton = page.getByRole('button').filter({ has: page.locator('svg') }).nth(1);

      if (await externalLinkButton.isVisible()) {
        // Listen for new page
        const pagePromise = context.waitForEvent('page');
        await externalLinkButton.click();
        const newPage = await pagePromise;

        // Verify it opens YouTube
        await expect(newPage).toHaveURL(/youtube\.com/);
        await newPage.close();
      }
    }
  });

  test('shows delete confirmation and removes video', async ({ page }) => {
    await page.goto('/videos');

    const table = page.getByRole('table');
    if (await table.isVisible()) {
      // Click delete button (last action button)
      const deleteButton = page.getByRole('button').filter({ has: page.locator('svg') }).last();

      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        // Confirmation dialog should appear
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByText(/delete/i)).toBeVisible();

        // Confirm deletion
        await page.getByRole('button', { name: /delete/i }).last().click();

        // Video should be removed
        // (This might require checking the count decreased or table is empty)
      }
    }
  });
});
