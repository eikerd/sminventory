#!/usr/bin/env node
/**
 * prove.js - Screenshot helper for visual verification
 *
 * Usage: npm run prove -- http://localhost:6660/workflows?view=table
 *
 * Takes a screenshot of the given URL and saves it to ~/Downloads/
 * Perfect for verifying what Claude Code actually sees vs what you see
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

async function prove() {
  const url = process.argv[2];

  if (!url) {
    console.error('Usage: npm run prove -- <url>');
    console.error('Example: npm run prove -- http://localhost:6660/workflows?view=table');
    process.exit(1);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log(`Taking screenshot of: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle' });

    // Extract filename from URL for screenshot naming
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.replace(/\//g, '_') || 'root';
    const search = urlObj.search ? urlObj.search.replace(/[?&=]/g, '_') : '';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `prove_${pathname}${search}_${timestamp}.png`;

    const downloadsPath = path.join(os.homedir(), 'Downloads', filename);

    await page.screenshot({ path: downloadsPath, fullPage: true });
    console.log(`✓ Screenshot saved: ${downloadsPath}`);
    console.log(`  URL: ${url}`);

    // Open the screenshot in default image viewer
    try {
      const { exec } = require('child_process');
      exec(`xdg-open "${downloadsPath}"`, (error) => {
        if (error) {
          console.warn(`Could not auto-open screenshot: ${error.message}`);
          console.log(`Open manually: ${downloadsPath}`);
        }
      });
    } catch (error) {
      console.warn('Could not open screenshot automatically');
    }

  } catch (error) {
    console.error('Error taking screenshot:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

prove().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
