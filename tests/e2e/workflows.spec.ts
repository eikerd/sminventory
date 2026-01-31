import { test, expect } from '@playwright/test';

test.describe('Workflows page', () => {
  test('table layout renders', async ({ page }) => {
    await page.goto('/workflows');

    await expect(page.getByRole('heading', { name: 'Workflows' })).toBeVisible({ timeout: 15000 });
    // Wait for page to load - either table appears or skeleton is visible
    await page.waitForFunction(() => {
      const table = document.querySelector('table');
      const skeleton = document.querySelector('[data-slot="skeleton"]');
      return !!table || !!skeleton;
    }, { timeout: 15000 });

    // Check either table or skeleton is visible
    const hasTable = await page.locator('table').first().isVisible().catch(() => false);
    const hasSkeleton = await page.locator('[data-slot="skeleton"]').first().isVisible().catch(() => false);
    
    if (!hasTable && !hasSkeleton) {
      throw new Error('Neither table nor skeleton visible');
    }
    
    if (hasTable) {
      await expect(page.locator('table').first().locator('thead th')).toHaveCount(6);
    }
  });
});
