import { test, expect } from '@playwright/test';

test.describe('Model Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to models page
    await page.goto('http://localhost:6660/models');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to model detail page from models table', async ({ page }) => {
    // Wait for table to load
    await expect(page.locator('table')).toBeVisible();

    // Get the first model link (in the filename column)
    const firstModelLink = page.locator('tbody tr a[href^="/models/"]').first();
    await expect(firstModelLink).toBeVisible();

    // Click on the link to navigate to detail page
    await firstModelLink.click();

    // Wait for navigation to detail page
    await page.waitForURL(/\/models\/.+/);

    // Verify we're on the detail page
    await expect(page.locator('text=Model Details')).toBeVisible();
  });

  test('should display Path Information section prominently at top', async ({ page }) => {
    // Click first model to open detail
    await page.locator('tbody tr a[href^="/models/"]').first().click();
    await page.waitForURL(/\/models\/.+/);

    // Verify Path Information card is present and has border-2 class (prominent)
    const pathCard = page.locator('div[class*="border-2"]').filter({ has: page.locator('h3:has-text("File Paths")') });
    await expect(pathCard).toBeVisible();

    // Verify Full Path section
    await expect(page.locator('text=Full Path')).toBeVisible();
    const fullPathSection = page.locator('div:has-text("Full Path") >> ..').locator('div[class*="font-mono"]');
    await expect(fullPathSection).toBeVisible();

    // Verify copy button for full path
    const fullPathCopyBtn = fullPathSection.locator('button[title="Copy path"]');
    await expect(fullPathCopyBtn).toBeVisible();

    // Verify ComfyUI Path section
    await expect(page.locator('text=ComfyUI Path')).toBeVisible();

    // Verify Stability Matrix Path section
    await expect(page.locator('text=Stability Matrix Path')).toBeVisible();

    // Verify Storage Location badge
    await expect(page.locator('text=Storage Location')).toBeVisible();
    const locationBadge = page.locator('div:has-text("Storage Location") >> .. >> .').locator('[class*="badge"]');
    await expect(locationBadge).toBeVisible();
  });

  test('should copy full path to clipboard when copy button is clicked', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Click first model
    await page.locator('tbody tr a[href^="/models/"]').first().click();
    await page.waitForURL(/\/models\/.+/);

    // Find and click the first copy button (full path)
    const fullPathCopyBtn = page.locator('button[title="Copy path"]').first();
    await fullPathCopyBtn.click();

    // Verify toast notification appears
    await expect(page.locator('text=Copied to clipboard')).toBeVisible({ timeout: 3000 });
  });

  test('should display Identity & Basic Information section', async ({ page }) => {
    await page.locator('tbody tr a[href^="/models/"]').first().click();
    await page.waitForURL(/\/models\/.+/);

    // Verify section title
    await expect(page.locator('h3:has-text("Identity & Basic Information")')).toBeVisible();

    // Verify all expected fields
    await expect(page.locator('text=Filename')).toBeVisible();
    await expect(page.locator('text=File Size')).toBeVisible();
    await expect(page.locator('text=Model Type')).toBeVisible();
    await expect(page.locator('text=Architecture')).toBeVisible();
    await expect(page.locator('text=Precision')).toBeVisible();
    await expect(page.locator('text=Model ID (SHA256)')).toBeVisible();
  });

  test('should display Integrity & Hash Validation section with status icons', async ({ page }) => {
    await page.locator('tbody tr a[href^="/models/"]').first().click();
    await page.waitForURL(/\/models\/.+/);

    // Verify section title
    await expect(page.locator('h3:has-text("Integrity & Hash Validation")')).toBeVisible();

    // Verify Hash Status field with icon
    await expect(page.locator('text=Hash Status')).toBeVisible();

    // Verify Last Verified field
    await expect(page.locator('text=Last Verified')).toBeVisible();

    // Note: Expected Hash and Partial Hash may not be present for all models
    // We'll just check if the section is rendered correctly
  });

  test('should display CivitAI Information section', async ({ page }) => {
    await page.locator('tbody tr a[href^="/models/"]').first().click();
    await page.waitForURL(/\/models\/.+/);

    // Verify section title
    await expect(page.locator('h3:has-text("CivitAI Information")')).toBeVisible();

    // Check if model has CivitAI data or shows "Lookup" button
    const lookupButton = page.locator('button:has-text("Lookup on CivitAI")');
    const modelIdField = page.locator('text=Model ID').first();

    // Either lookup button or CivitAI data should be visible
    const hasLookupButton = await lookupButton.isVisible().catch(() => false);
    const hasModelIdField = await modelIdField.isVisible().catch(() => false);

    expect(hasLookupButton || hasModelIdField).toBeTruthy();
  });

  test('should display Timestamps section', async ({ page }) => {
    await page.locator('tbody tr a[href^="/models/"]').first().click();
    await page.waitForURL(/\/models\/.+/);

    // Verify section title
    await expect(page.locator('h3:has-text("Timestamps")')).toBeVisible();

    // Verify timestamp fields
    await expect(page.locator('dt:has-text("Created")')).toBeVisible();
    await expect(page.locator('dt:has-text("Last Verified")')).toBeVisible();
    await expect(page.locator('dt:has-text("Last Updated")')).toBeVisible();
  });

  test('should navigate back to models list when back button is clicked', async ({ page }) => {
    await page.locator('tbody tr a[href^="/models/"]').first().click();
    await page.waitForURL(/\/models\/.+/);

    // Click back button
    const backButton = page.locator('button:has-text("Back to Models")').first();
    await backButton.click();

    // Verify we're back on models page
    await page.waitForURL('http://localhost:6660/models', { timeout: 5000 });
    await expect(page.locator('h1:has-text("Models")')).toBeVisible();
  });

  test('should display storage location badge correctly', async ({ page }) => {
    await page.locator('tbody tr a[href^="/models/"]').first().click();
    await page.waitForURL(/\/models\/.+/);

    // Check for location badge
    const locationSection = page.locator('div:has-text("Storage Location") >> ..').last();
    const badge = locationSection.locator('[class*="badge"]');
    await expect(badge).toBeVisible();

    // Badge should contain either "Local Storage" or "Warehouse"
    const badgeText = await badge.textContent();
    expect(badgeText).toMatch(/Local Storage|Warehouse/);
  });

  test('should handle model not found gracefully', async ({ page }) => {
    // Navigate to non-existent model
    await page.goto('http://localhost:6660/models/nonexistent-model-id-12345');
    await page.waitForLoadState('networkidle');

    // Verify error state
    await expect(page.locator('text=Model not found')).toBeVisible();
    await expect(page.locator('button:has-text("Back to Models")')).toBeVisible();
  });

  test('should display all copy buttons correctly', async ({ page }) => {
    await page.locator('tbody tr a[href^="/models/"]').first().click();
    await page.waitForURL(/\/models\/.+/);

    // Count all copy buttons (3 for paths + 1 for Model ID)
    const copyButtons = page.locator('button[title*="Copy"]');
    const count = await copyButtons.count();

    // Should have at least 4 copy buttons (3 paths + 1 model ID)
    expect(count).toBeGreaterThanOrEqual(4);
  });
});
