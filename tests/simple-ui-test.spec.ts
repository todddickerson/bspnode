import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test('simple broadcaster UI check', async ({ page, context }) => {
  // Grant permissions
  await context.grantPermissions(['camera', 'microphone']);
  
  // Login
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[id="email"]', 'testuser@example.com')
  await page.fill('input[id="password"]', 'password123')
  await page.click('button[type="submit"]')
  await page.waitForURL(`${BASE_URL}/dashboard`)
  
  // Click first Start Broadcasting button
  await page.waitForTimeout(2000)
  await page.locator('button:has-text("Start Broadcasting")').first().click()
  await page.waitForURL(/\/stream\/.*\/broadcast/)
  
  // Wait for page load
  await page.waitForTimeout(3000)
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/broadcaster-ui-check.png', fullPage: true });
  
  // Check for UI elements
  const viewerCount = await page.locator('text="Viewers"').count()
  const chatPanel = await page.locator('text="Live Chat"').count()
  const chatToggle = await page.locator('button[title*="chat"]').count()
  
  console.log('UI Elements Found:');
  console.log(`- Viewer sections: ${viewerCount}`);
  console.log(`- Chat panels: ${chatPanel}`);
  console.log(`- Chat toggle buttons: ${chatToggle}`);
  
  if (viewerCount > 0) {
    console.log('✅ Viewer count feature is present');
  } else {
    console.log('❌ Viewer count feature is NOT present');
  }
  
  if (chatPanel > 0) {
    console.log('✅ Chat panel feature is present');
  } else {
    console.log('❌ Chat panel feature is NOT present');
  }
});