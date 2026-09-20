import { test, expect } from '@playwright/test';

test.describe('New Features Integration Tests', () => {
  test('should navigate through model list to detail and back', async ({ page }) => {
    // Start at models page
    await page.goto('http://localhost:6660/models');
    await page.waitForLoadState('networkidle');

    // Verify models table loads
    await expect(page.locator('table')).toBeVisible();
    const rowCount = await page.locator('tbody tr').count();
    expect(rowCount).toBeGreaterThan(0);

    // Click first model
    await page.locator('tbody tr a[href^="/models/"]').first().click();
    await page.waitForURL(/\/models\/.+/);

    // Verify detail page loads
    await expect(page.locator('h1', { hasText: 'Model Details' })).toBeVisible();
    await expect(page.locator('h3:has-text("File Paths")')).toBeVisible();

    // Navigate back
    await page.locator('button:has-text("Back to Models")').first().click();
    await page.waitForURL('http://localhost:6660/models');

    // Verify back on models page
    await expect(page.locator('table')).toBeVisible();
  });

  test('should navigate through workflow list to detail and verify validation card', async ({ page }) => {
    // Start at home/dashboard
    await page.goto('http://localhost:6660/');
    await page.waitForLoadState('networkidle');

    // Click first workflow
    await page.locator('tbody tr').first().click();
    await page.waitForURL(/\/workflows\/.+/);

    // Verify workflow detail page loads
    await expect(page.locator('h1')).toBeVisible();

    // Verify all 5 stats cards are present
    await expect(page.locator('text=Scan Status')).toBeVisible();
    await expect(page.locator('text=Dependencies').first()).toBeVisible();
    await expect(page.locator('text=Total Size')).toBeVisible();
    await expect(page.locator('text=VRAM Estimate')).toBeVisible();
    await expect(page.locator('text=Path Validation')).toBeVisible();

    // Navigate back
    await page.locator('button[aria-label="Go back"], button:has-text("Back")').first().click();
    await page.waitForURL('http://localhost:6660/', { timeout: 5000 });
  });

  test('should work correctly in both table and card view modes', async ({ page }) => {
    // Test models page view switching
    await page.goto('http://localhost:6660/models?view=table');
    await page.waitForLoadState('networkidle');

    // Table view should show table
    await expect(page.locator('table')).toBeVisible();

    // Click first row in table view
    await page.locator('tbody tr a[href^="/models/"]').first().click();
    await page.waitForURL(/\/models\/.+/);
    await expect(page.locator('text=Model Details')).toBeVisible();

    // Go back
    await page.locator('button:has-text("Back to Models")').first().click();
    await page.waitForURL(/\/models/);

    // Switch to card view
    await page.goto('http://localhost:6660/models?view=cards');
    await page.waitForLoadState('networkidle');

    // Should show cards instead
    const cards = page.locator('[class*="card"], div[class*="grid"] > div');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test('should not show console errors on model detail page', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('http://localhost:6660/models');
    await page.waitForLoadState('networkidle');

    await page.locator('tbody tr a[href^="/models/"]').first().click();
    await page.waitForURL(/\/models\/.+/);

    // Wait for page to fully render
    await page.waitForTimeout(2000);

    // Filter out known/acceptable errors
    const realErrors = consoleErrors.filter(err =>
      !err.includes('favicon') &&
      !err.includes('sourcemap') &&
      !err.includes('DevTools')
    );

    expect(realErrors).toHaveLength(0);
  });

  test('should not show console errors on workflow detail page with validation', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('http://localhost:6660/');
    await page.waitForLoadState('networkidle');

    await page.locator('tbody tr').first().click();
    await page.waitForURL(/\/workflows\/.+/);

    // Wait for page to fully render
    await page.waitForTimeout(2000);

    // Filter out known/acceptable errors
    const realErrors = consoleErrors.filter(err =>
      !err.includes('favicon') &&
      !err.includes('sourcemap') &&
      !err.includes('DevTools')
    );

    expect(realErrors).toHaveLength(0);
  });

  test('should handle responsive layout on model detail page', async ({ page }) => {
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('http://localhost:6660/models');
    await page.waitForLoadState('networkidle');

    await page.locator('tbody tr a[href^="/models/"]').first().click();
    await page.waitForURL(/\/models\/.+/);

    // Verify layout renders correctly
    await expect(page.locator('h3:has-text("File Paths")')).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    await expect(page.locator('h3:has-text("File Paths")')).toBeVisible();

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await expect(page.locator('h3:has-text("File Paths")')).toBeVisible();
  });

  test('should handle validation button clicks without errors', async ({ page }) => {
    await page.goto('http://localhost:6660/');
    await page.waitForLoadState('networkidle');

    await page.locator('tbody tr').first().click();
    await page.waitForURL(/\/workflows\/.+/);

    const validateButton = page.locator('button:has-text("Peek & Validate Now")');
    await expect(validateButton).toBeVisible();

    // Click validate button
    await validateButton.click();

    // Should show loading state without errors
    await expect(validateButton).toContainText('Validating');

    // Wait for completion
    await expect(validateButton).toContainText('Peek & Validate Now', { timeout: 15000 });
  });

  test('should display all badges and status indicators correctly', async ({ page }) => {
    await page.goto('http://localhost:6660/models');
    await page.waitForLoadState('networkidle');

    await page.locator('tbody tr a[href^="/models/"]').first().click();
    await page.waitForURL(/\/models\/.+/);

    // Verify badges are visible
    const badges = page.locator('[class*="badge"]');
    const badgeCount = await badges.count();
    expect(badgeCount).toBeGreaterThan(0);

    // Verify each badge renders correctly
    for (let i = 0; i < Math.min(badgeCount, 5); i++) {
      const badge = badges.nth(i);
      await expect(badge).toBeVisible();
      const text = await badge.textContent();
      expect(text).toBeTruthy();
      expect(text!.length).toBeGreaterThan(0);
    }
  });

  test('should display icons correctly throughout the UI', async ({ page }) => {
    await page.goto('http://localhost:6660/models');
    await page.waitForLoadState('networkidle');

    await page.locator('tbody tr a[href^="/models/"]').first().click();
    await page.waitForURL(/\/models\/.+/);

    // Check for various icons using lucide class names
    const iconClasses = [
      'lucide-folder-open',
      'lucide-file',
      'lucide-database',
      'lucide-copy',
      'lucide-hard-drive',
      'lucide-cloud',
    ];

    for (const iconClass of iconClasses) {
      const icons = page.locator(`svg[class*="${iconClass}"]`);
      const count = await icons.count();
      if (count > 0) {
        await expect(icons.first()).toBeVisible();
      }
    }
  });

  test('should handle quick navigation between multiple models', async ({ page }) => {
    await page.goto('http://localhost:6660/models');
    await page.waitForLoadState('networkidle');

    // Get first 3 models
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    const testCount = Math.min(3, rowCount);

    for (let i = 0; i < testCount; i++) {
      // Click model link
      const modelLink = page.locator('tbody tr a[href^="/models/"]').nth(i);
      await modelLink.click();
      await page.waitForURL(/\/models\/.+/);

      // Verify detail page loaded
      await expect(page.locator('h3:has-text("File Paths")')).toBeVisible();

      // Go back
      await page.locator('button:has-text("Back to Models")').first().click();
      await page.waitForURL(/\/models/);
    }
  });
});
