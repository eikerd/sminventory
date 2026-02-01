const { chromium } = require('playwright');

async function testPage(browser, url, pageName) {
  console.log(`\n🔍 Testing: ${pageName}`);
  console.log(`📍 URL: ${url}`);
  console.log('━'.repeat(70));

  const page = await browser.newPage();
  const errors = [];
  const warnings = [];
  const logs = [];

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    logs.push({ type, text });
    if (type === 'error') {
      errors.push(text);
    } else if (type === 'warning') {
      warnings.push(text);
    }
  });

  page.on('pageerror', error => {
    errors.push(`PAGE ERROR: ${error.message}`);
  });

  page.on('response', response => {
    if (response.status() >= 400) {
      errors.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(2000);

    if (errors.length === 0 && warnings.length === 0) {
      console.log('✅ NO ERRORS OR WARNINGS');
    } else {
      if (errors.length > 0) {
        console.log(`\n❌ ERRORS (${errors.length}):`);
        errors.forEach(err => console.log(`   - ${err}`));
      }
      if (warnings.length > 0) {
        console.log(`\n⚠️  WARNINGS (${warnings.length}):`);
        warnings.forEach(warn => console.log(`   - ${warn}`));
      }
    }

    await page.close();
    return { errors: errors.length, warnings: warnings.length, success: errors.length === 0 };

  } catch (error) {
    console.log(`❌ NAVIGATION FAILED: ${error.message}`);
    await page.close();
    return { errors: 1, warnings: 0, success: false };
  }
}

(async () => {
  console.log('🚀 RIGOROUS TESTING SUITE 🚀');
  console.log('═'.repeat(70));

  const browser = await chromium.launch({ headless: true });
  const results = {};

  const pages = [
    { url: 'http://localhost:6660/', name: 'Home Page' },
    { url: 'http://localhost:6660/workflows', name: 'Workflows Page' },
    { url: 'http://localhost:6660/workflows?view=table', name: 'Workflows - Table View' },
    { url: 'http://localhost:6660/models', name: 'Models Page' },
    { url: 'http://localhost:6660/downloads', name: 'Downloads Page' },
    { url: 'http://localhost:6660/tasks', name: 'Tasks Page' },
    { url: 'http://localhost:6660/settings', name: 'Settings Page' },
  ];

  for (const pageTest of pages) {
    const result = await testPage(browser, pageTest.url, pageTest.name);
    results[pageTest.name] = result;
  }

  await browser.close();

  console.log('\n' + '═'.repeat(70));
  console.log('SUMMARY');
  console.log('═'.repeat(70));

  let totalErrors = 0;
  let passedPages = 0;
  let failedPages = 0;

  Object.entries(results).forEach(([name, result]) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${name}: ${result.errors} errors, ${result.warnings} warnings`);
    totalErrors += result.errors;
    if (result.success) passedPages++;
    else failedPages++;
  });

  console.log('\n' + '═'.repeat(70));
  console.log(`FINAL RESULT: ${passedPages}/${pages.length} pages passed`);
  console.log(`Total Errors: ${totalErrors}`);
  console.log('═'.repeat(70));

  if (totalErrors > 0) {
    console.log('\n🔴 FAILED - Errors detected. See details above.');
    process.exit(1);
  } else {
    console.log('\n🟢 SUCCESS - All pages clean, no errors detected.');
    process.exit(0);
  }
})();
