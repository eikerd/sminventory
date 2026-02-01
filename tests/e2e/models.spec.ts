import { test, expect } from '@playwright/test';

test.describe('Models page', () => {
  test('renders tree placeholder', async ({ page }) => {
    await page.goto('/models');
    await expect(page.getByRole('heading', { name: /Models/i })).toBeVisible();
  });
});
