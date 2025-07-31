import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test('full studio debug with stream creation', async ({ page, context }) => {
  await context.grantPermissions(['camera', 'microphone']);
  
  // Enhanced error capturing
  const errors = {
    console: [],
    network: [],
    page: []
  };

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.console.push(msg.text());
    }
  });

  page.on('response', async response => {
    if (response.url().includes('/api/') && !response.ok()) {
      let body = '';
      try {
        body = await response.text();
      } catch (e) {
        body = 'Could not read body';
      }
      errors.network.push({
        url: response.url(),
        status: response.status(),
        body: body
      });
    }
  });

  page.on('pageerror', error => {
    errors.page.push(error.message);
  });

  console.log('🚀 Full Studio Debug Test\n');
  
  // Step 1: Login
  console.log('1️⃣ Logging in...');
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[id="email"]', 'testuser@example.com')
  await page.fill('input[id="password"]', 'password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 10000 })
  console.log('✅ Login successful');
  
  // Step 2: Create stream
  console.log('\n2️⃣ Creating new stream...');
  await page.goto(`${BASE_URL}/stream/new`);
  await page.waitForTimeout(2000);
  
  // Fill the form
  await page.fill('input[name="title"]', 'Debug Studio Test ' + Date.now());
  await page.fill('textarea[name="description"]', 'Testing LiveKit connection');
  
  // Select browser streaming
  const browserRadio = page.locator('input[value="BROWSER"]');
  if (await browserRadio.isVisible()) {
    await browserRadio.click();
  }
  
  // Submit
  await page.click('button[type="submit"]');
  console.log('⏳ Waiting for stream creation...');
  await page.waitForTimeout(3000);
  
  // Get stream ID
  const currentUrl = page.url();
  const streamId = currentUrl.match(/stream\/([^\/]+)/)?.[1];
  
  if (!streamId) {
    console.log('❌ Failed to create stream');
    return;
  }
  
  console.log(`✅ Stream created: ${streamId}`);
  
  // Step 3: Go to studio
  console.log('\n3️⃣ Navigating to studio...');
  await page.goto(`${BASE_URL}/stream/${streamId}/studio`);
  await page.waitForTimeout(3000);
  
  console.log('📸 Taking screenshot before join...');
  await page.screenshot({ path: 'test-results/studio-debug-01-before.png', fullPage: true });
  
  // Step 4: Try to join studio
  const joinButton = page.locator('button:has-text("Join Studio")');
  if (!await joinButton.isVisible()) {
    console.log('❌ Join Studio button not found');
    return;
  }
  
  console.log('\n4️⃣ Attempting to join studio...');
  console.log('🔍 Monitoring network calls...\n');
  
  // Clear errors before critical action
  errors.console = [];
  errors.network = [];
  errors.page = [];
  
  // Track specific API calls
  const apiCalls = [];
  const apiListener = (request) => {
    if (request.url().includes('/api/streams/')) {
      apiCalls.push({
        method: request.method(),
        url: request.url().replace(BASE_URL, ''),
        time: new Date().toISOString()
      });
    }
  };
  page.on('request', apiListener);
  
  await joinButton.click();
  console.log('⏳ Waiting for LiveKit connection...');
  
  // Wait and monitor
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1000);
    
    // Check state
    const goLive = page.locator('button:has-text("Go Live")');
    const connecting = page.locator('text="Connecting..."');
    const errorToast = page.locator('[role="alert"]');
    
    if (await goLive.isVisible()) {
      console.log('\n✅ SUCCESS! Connected to LiveKit');
      break;
    }
    
    if (await errorToast.isVisible()) {
      const errorText = await errorToast.textContent();
      console.log(`\n❌ Error detected: ${errorText}`);
      break;
    }
    
    if (i === 4) {
      console.log('Still waiting...');
    }
  }
  
  console.log('\n📸 Taking screenshot after join attempt...');
  await page.screenshot({ path: 'test-results/studio-debug-02-after.png', fullPage: true });
  
  // Print diagnostic info
  console.log('\n' + '='.repeat(50));
  console.log('📊 DIAGNOSTIC INFORMATION');
  console.log('='.repeat(50));
  
  console.log('\n🔵 API Calls Made:');
  if (apiCalls.length === 0) {
    console.log('  No API calls detected');
  } else {
    apiCalls.forEach(call => {
      console.log(`  ${call.method} ${call.url}`);
    });
  }
  
  console.log('\n🔴 Network Errors:');
  if (errors.network.length === 0) {
    console.log('  No network errors');
  } else {
    errors.network.forEach(err => {
      console.log(`  ${err.url}`);
      console.log(`    Status: ${err.status}`);
      console.log(`    Body: ${err.body}`);
    });
  }
  
  console.log('\n🟡 Console Errors:');
  if (errors.console.length === 0) {
    console.log('  No console errors');
  } else {
    errors.console.forEach(err => {
      console.log(`  ${err}`);
    });
  }
  
  console.log('\n🟣 Page Errors:');
  if (errors.page.length === 0) {
    console.log('  No page errors');
  } else {
    errors.page.forEach(err => {
      console.log(`  ${err}`);
    });
  }
  
  // Check final state
  console.log('\n🎯 Final State Check:');
  const finalChecks = {
    goLive: await page.locator('button:has-text("Go Live")').isVisible(),
    connecting: await page.locator('text="Connecting..."').isVisible(),
    joinStudio: await page.locator('button:has-text("Join Studio")').isVisible(),
    error: await page.locator('[role="alert"]').isVisible(),
    videoEnabled: await page.locator('button[disabled]:has(svg)').first().isEnabled(),
  };
  
  console.log(`  Go Live button: ${finalChecks.goLive ? '✅ Visible' : '❌ Not visible'}`);
  console.log(`  Connecting: ${finalChecks.connecting ? '⏳ Yes' : 'No'}`);
  console.log(`  Join Studio button: ${finalChecks.joinStudio ? 'Still visible' : 'Hidden'}`);
  console.log(`  Error shown: ${finalChecks.error ? '❌ Yes' : '✅ No'}`);
  console.log(`  Controls enabled: ${finalChecks.videoEnabled ? '✅ Yes' : '❌ No'}`);
  
  // Try to get more details from the page
  const streamInfo = await page.evaluate(() => {
    // Try to get React or other framework state
    const root = document.querySelector('#__next') || document.querySelector('#root');
    return {
      hasVideo: !!document.querySelector('video'),
      videoCount: document.querySelectorAll('video').length,
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent),
    };
  });
  
  console.log('\n🖥️ Page Info:');
  console.log(`  Has video element: ${streamInfo.hasVideo}`);
  console.log(`  Video count: ${streamInfo.videoCount}`);
  console.log(`  Visible buttons: ${streamInfo.buttons.filter(b => b).join(', ')}`);
  
  page.off('request', apiListener);
  
  console.log('\n' + '='.repeat(50));
  console.log('TEST COMPLETE');
  console.log('='.repeat(50));
});