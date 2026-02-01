const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('Starting visual inspection...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000 // Slow down to see what's happening
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    acceptDownloads: false
  });
  
  const page = await context.newPage();
  
  // Set longer timeout
  page.setDefaultTimeout(60000);
  
  console.log('Navigating to http://localhost:6660/workflows...');
  
  try {
    const response = await page.goto('http://localhost:6660/workflows', {
      waitUntil: 'networkidle',
      timeout: 60000
    });
    
    console.log('Response status:', response?.status());
    
    // Wait a bit longer
    await page.waitForTimeout(3000);
    
    // Check page title
    const title = await page.title();
    console.log('Page title:', title);
    
    // Take screenshot of viewport
    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    const screenshotPath = path.join(screenshotsDir, 'workflows-viewport.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Viewport screenshot saved: ${screenshotPath}`);
    
    // Check if table exists
    const tableExists = await page.locator('table').count();
    console.log('Table found:', tableExists > 0);
    
    if (tableExists > 0) {
      // Count rows
      const rowCount = await page.locator('tbody tr').count();
      console.log('Table rows:', rowCount);
      
      // Get first few rows content
      const firstRow = await page.locator('tbody tr').first();
      if (await firstRow.count() > 0) {
        const firstRowText = await firstRow.textContent();
        console.log('First row (first 100 chars):', firstRowText?.substring(0, 100));
      }
    } else {
      // Check what's on the page
      const bodyText = await page.textContent('body');
      console.log('Body content (first 500 chars):', bodyText?.substring(0, 500));
      
      // Take screenshot of entire page
      const fullScreenshotPath = path.join(screenshotsDir, 'workflows-full.png');
      await page.screenshot({ path: fullScreenshotPath, fullPage: true });
      console.log(`Full page screenshot saved: ${fullScreenshotPath}`);
    }
    
    // Check for loading indicators
    const loadingIndicator = await page.locator('.animate-spin, [role="progressbar"]').count();
    console.log('Loading indicators found:', loadingIndicator);
    
    // Check for error messages
    const errorElements = await page.locator('.text-red-500, .bg-red-500, .text-amber-500, .bg-amber-500').count();
    console.log('Error/amber elements found:', errorElements);
    
    // Wait and take one more screenshot
    await page.waitForTimeout(2000);
    const finalScreenshotPath = path.join(screenshotsDir, 'workflows-final.png');
    await page.screenshot({ path: finalScreenshotPath });
    
    console.log('\n=== SPEC CHECKLIST ===');
    console.log('1. Server responding: ✓');
    console.log('2. Page loaded: ✓');
    console.log('3. Spreadsheet table found:', tableExists > 0 ? '✓' : '✗');
    console.log('4. Data visible:', rowCount > 0 ? '✓' : '✗ (no workflows yet?)');
    
  } catch (error) {
    console.error('Error during visual test:', error);
  } finally {
    // Keep browser open for manual inspection
    console.log('\nBrowser will remain open for 30 seconds for manual inspection...');
    console.log('Press Ctrl+C to close the browser early.');
    
    await page.waitForTimeout(30000);
    await browser.close();
  }
})();