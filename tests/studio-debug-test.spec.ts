import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test('debug studio connection', async ({ page, context }) => {
  await context.grantPermissions(['camera', 'microphone']);
  
  // Capture console logs
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
  });

  // Capture network requests
  const apiRequests = [];
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      apiRequests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers()
      });
    }
  });

  // Capture network responses
  const apiResponses = [];
  page.on('response', async response => {
    if (response.url().includes('/api/')) {
      let body = null;
      try {
        body = await response.text();
      } catch (e) {
        body = 'Could not read body';
      }
      
      apiResponses.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        body: body
      });
    }
  });

  // Capture errors
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push({
      message: error.message,
      stack: error.stack
    });
  });

  console.log('🔍 Studio Connection Debug Test\n');
  
  // Step 1: Login
  console.log('1️⃣ Logging in...');
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[id="email"]', 'testuser@example.com')
  await page.fill('input[id="password"]', 'password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 10000 })
  console.log('✅ Login successful');
  
  // Step 2: Go to first stream studio
  console.log('\n2️⃣ Finding a stream...');
  await page.waitForTimeout(2000);
  
  // Get the first stream card's Studio button
  const studioButton = page.locator('[href*="/studio"]').first();
  if (await studioButton.isVisible()) {
    const href = await studioButton.getAttribute('href');
    console.log(`Found studio link: ${href}`);
    await studioButton.click();
    await page.waitForTimeout(3000);
    
    console.log('\n3️⃣ On studio page, attempting to join...');
    await page.screenshot({ path: 'test-results/debug-01-studio.png', fullPage: true });
    
    const joinButton = page.locator('button:has-text("Join Studio")');
    if (await joinButton.isVisible()) {
      console.log('Found Join Studio button, clicking...');
      
      // Clear previous logs before the critical action
      consoleLogs.length = 0;
      apiRequests.length = 0;
      apiResponses.length = 0;
      pageErrors.length = 0;
      
      await joinButton.click();
      console.log('⏳ Waiting for connection attempt...');
      await page.waitForTimeout(10000);
      
      await page.screenshot({ path: 'test-results/debug-02-after-join.png', fullPage: true });
      
      // Print all captured data
      console.log('\n📊 DIAGNOSTIC INFORMATION:');
      
      console.log('\n🔴 Page Errors:');
      if (pageErrors.length === 0) {
        console.log('  No page errors');
      } else {
        pageErrors.forEach(err => {
          console.log(`  - ${err.message}`);
          if (err.stack) console.log(`    ${err.stack.split('\n')[1]}`);
        });
      }
      
      console.log('\n🟡 Console Logs:');
      const errorLogs = consoleLogs.filter(log => log.type === 'error');
      if (errorLogs.length === 0) {
        console.log('  No console errors');
      } else {
        errorLogs.forEach(log => {
          console.log(`  - ${log.text}`);
        });
      }
      
      console.log('\n🔵 API Requests:');
      apiRequests.forEach(req => {
        console.log(`  - ${req.method} ${req.url}`);
      });
      
      console.log('\n🟢 API Responses:');
      apiResponses.forEach(resp => {
        console.log(`  - ${resp.url}`);
        console.log(`    Status: ${resp.status} ${resp.statusText}`);
        if (resp.status >= 400) {
          console.log(`    Body: ${resp.body}`);
        }
      });
      
      // Check current state
      const goLive = page.locator('button:has-text("Go Live")');
      const connecting = page.locator('text="Connecting..."');
      const errorToast = page.locator('[role="alert"]');
      
      console.log('\n🎯 Current State:');
      console.log(`  - Go Live button visible: ${await goLive.isVisible()}`);
      console.log(`  - Connecting indicator: ${await connecting.isVisible()}`);
      console.log(`  - Error toast visible: ${await errorToast.isVisible()}`);
      
      if (await errorToast.isVisible()) {
        const errorText = await errorToast.textContent();
        console.log(`  - Error message: ${errorText}`);
      }
      
      // Check if video/audio controls are enabled
      const videoButton = page.locator('button[aria-label*="video"], button:has(svg[class*="Video"])').first();
      const audioButton = page.locator('button[aria-label*="audio"], button:has(svg[class*="Mic"])').first();
      
      console.log('\n🎤 Media Controls:');
      console.log(`  - Video button enabled: ${await videoButton.isEnabled()}`);
      console.log(`  - Audio button enabled: ${await audioButton.isEnabled()}`);
      
    } else {
      console.log('❌ Join Studio button not found');
    }
  } else {
    console.log('❌ No studio links found on dashboard');
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('DEBUG TEST COMPLETE');
  console.log('='.repeat(50));
});