const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  console.log('Navigating to T3.chat...');

  try {
    await page.goto('https://t3.chat/chat/16ee185b-5b5d-4c82-88a5-ea1349c279f3', {
      waitUntil: 'networkidle',
      timeout: 45000
    });

    console.log('Waiting for content to load...');
    await page.waitForTimeout(10000);

    console.log('Extracting conversation...');

    const content = await page.evaluate(() => {
      // Try to get the main chat content
      const main = document.querySelector('main');
      if (main) {
        return main.innerText;
      }
      return document.body.innerText;
    });

    console.log('\n' + '='.repeat(80));
    console.log('EXTRACTED CONTENT');
    console.log('='.repeat(80) + '\n');
    console.log(content);
    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('Error occurred:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
