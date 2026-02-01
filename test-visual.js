const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  console.log('Navigating to workflows page...');
  await page.goto('http://localhost:6660/workflows');
  
  // Wait for page to load
  await page.waitForSelector('table');
  
  console.log('Page loaded. Taking screenshot...');
  
  // Create screenshots directory if it doesn't exist
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  
  // Take full page screenshot
  await page.screenshot({
    path: path.join(screenshotsDir, 'workflows-spreadsheet-view.png'),
    fullPage: true
  });
  
  console.log(`Screenshot saved to ${path.join(screenshotsDir, 'workflows-spreadsheet-view.png')}`);
  
  // Capture table structure details
  console.log('\nAnalyzing table structure...');
  
  // Check columns
  const columns = await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll('thead th'));
    return headers.map(h => h.textContent.trim());
  });
  
  console.log('Table columns:', columns);
  
  // Check row count
  const rowCount = await page.evaluate(() => {
    return document.querySelectorAll('tbody tr').length;
  });
  
  console.log('Table rows:', rowCount);
  
  // Check for health status dots
  const healthDots = await page.evaluate(() => {
    return document.querySelectorAll('.rounded-full.w-3.h-3').length;
  });
  
  console.log('Health status dots:', healthDots);
  
  // Check progress bars
  const progressBars = await page.evaluate(() => {
    return document.querySelectorAll('[role="progressbar"]').length;
  });
  
  console.log('Progress bars:', progressBars);
  
  // Capture colors
  const colors = await page.evaluate(() => {
    const bgElement = document.querySelector('body');
    const bgColor = window.getComputedStyle(bgElement).backgroundColor;
    
    // Get some text colors
    const firstRow = document.querySelector('tbody tr');
    let rowColor = 'N/A';
    if (firstRow) {
      rowColor = window.getComputedStyle(firstRow).color;
    }
    
    return {
      background: bgColor,
      rowText: rowColor
    };
  });
  
  console.log('Color analysis:');
  console.log('  Background:', colors.background);
  console.log('  Row text:', colors.rowText);
  
  // Check for monospace fonts
  const monospaceElements = await page.evaluate(() => {
    const elements = [];
    const allElements = document.querySelectorAll('*');
    
    allElements.forEach(el => {
      const fontFamily = window.getComputedStyle(el).fontFamily;
      if (fontFamily.includes('monospace') && el.textContent && el.textContent.trim()) {
        elements.push({
          tag: el.tagName.toLowerCase(),
          text: el.textContent.trim(),
          fontFamily: fontFamily
        });
      }
    });
    
    return elements.slice(0, 5); // Return first 5 for brevity
  });
  
  console.log('\nMonospace font usage:');
  monospaceElements.forEach(el => {
    console.log(`  ${el.tag}: "${el.text}" (${el.fontFamily})`);
  });
  
  await browser.close();
  
  console.log('\n\n=== SPEC COMPLIANCE CHECK ===');
  console.log('1. Deep matte black background:', colors.background.includes('0, 0, 0') || colors.background.includes('#0d0d0d') ? '✓' : '✗');
  console.log('2. Table columns present:', columns.length >= 6 ? '✓' : '✗');
  console.log('3. Health status dots:', healthDots > 0 ? '✓' : '✗');
  console.log('4. Progress bars:', progressBars > 0 ? '✓' : '✗');
  console.log('5. Monospace fonts used:', monospaceElements.length > 0 ? '✓' : '✗');
  console.log('\nScreenshot saved for visual inspection.');
})();
