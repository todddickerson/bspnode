import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test('test studio directly', async ({ page, context }) => {
  await context.grantPermissions(['camera', 'microphone']);
  
  console.log('🎬 Direct Studio Test\n');
  
  // Step 1: Login
  console.log('1️⃣ Logging in...');
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[id="email"]', 'testuser@example.com')
  await page.fill('input[id="password"]', 'password123')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(3000)
  
  // Step 2: Go directly to a known studio page
  const testStreamId = 'cmdqcaxe80009srbl6bo5cs2o';
  console.log(`2️⃣ Going to studio for stream: ${testStreamId}`);
  await page.goto(`${BASE_URL}/stream/${testStreamId}/studio`)
  await page.waitForTimeout(3000)
  
  // Take initial screenshot
  await page.screenshot({ path: 'test-results/studio-direct-01-initial.png', fullPage: true });
  
  // Step 3: Check if we're on studio page
  const onStudioPage = page.url().includes('/studio');
  console.log(`3️⃣ On studio page: ${onStudioPage ? '✅' : '❌'}`);
  
  if (!onStudioPage) {
    console.log('Failed to access studio. Current URL:', page.url());
    return;
  }
  
  // Step 4: Test Join Studio
  console.log('\n4️⃣ Testing Join Studio functionality...');
  const joinButton = page.locator('button:has-text("Join Studio")');
  
  if (await joinButton.isVisible()) {
    console.log('✅ Join Studio button found');
    
    // Set up error monitoring
    const apiErrors = [];
    const consoleErrors = [];
    
    page.on('response', response => {
      if (response.url().includes('/api/') && !response.ok()) {
        apiErrors.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
      }
    });
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Click Join Studio
    await joinButton.click();
    console.log('⏳ Waiting for connection...');
    await page.waitForTimeout(10000); // Wait 10 seconds
    
    // Take screenshot after join attempt
    await page.screenshot({ path: 'test-results/studio-direct-02-after-join.png', fullPage: true });
    
    // Check results
    const goLiveButton = page.locator('button:has-text("Go Live")');
    const errorToast = page.locator('[role="alert"]');
    const videoControls = page.locator('button').filter({ has: page.locator('svg.lucide-video, svg.lucide-video-off') });
    const audioControls = page.locator('button').filter({ has: page.locator('svg.lucide-mic, svg.lucide-mic-off') });
    
    console.log('\n📊 Results:');
    console.log(`- Go Live button visible: ${await goLiveButton.isVisible() ? '✅' : '❌'}`);
    console.log(`- Error toast visible: ${await errorToast.isVisible() ? '✅' : '❌'}`);
    console.log(`- Video controls enabled: ${await videoControls.first().isEnabled() ? '✅' : '❌'}`);
    console.log(`- Audio controls enabled: ${await audioControls.first().isEnabled() ? '✅' : '❌'}`);
    
    if (apiErrors.length > 0) {
      console.log('\n❌ API Errors:');
      apiErrors.forEach(err => {
        console.log(`  - ${err.url}: ${err.status} ${err.statusText}`);
      });
    }
    
    if (consoleErrors.length > 0) {
      console.log('\n❌ Console Errors:');
      consoleErrors.forEach(err => {
        console.log(`  - ${err}`);
      });
    }
    
    if (await errorToast.isVisible()) {
      const errorText = await errorToast.textContent();
      console.log(`\n⚠️ Error message: "${errorText}"`);
    }
    
    // If connected, test broadcast
    if (await goLiveButton.isVisible()) {
      console.log('\n5️⃣ Testing broadcast...');
      await goLiveButton.click();
      await page.waitForTimeout(5000);
      
      const liveIndicator = page.locator('text="LIVE"');
      const endStreamButton = page.locator('button:has-text("End Stream")');
      
      console.log(`- Live indicator: ${await liveIndicator.isVisible() ? '✅' : '❌'}`);
      console.log(`- End stream button: ${await endStreamButton.isVisible() ? '✅' : '❌'}`);
      
      await page.screenshot({ path: 'test-results/studio-direct-03-broadcast.png', fullPage: true });
      
      if (await endStreamButton.isVisible()) {
        console.log('🎉 Successfully broadcasting!');
        await endStreamButton.click();
        console.log('✅ Ended stream');
      }
    }
  } else {
    console.log('❌ Join Studio button not found');
    
    // Check if already connected
    const goLiveButton = page.locator('button:has-text("Go Live")');
    if (await goLiveButton.isVisible()) {
      console.log('ℹ️ Already connected to studio');
    }
  }
  
  // Final summary
  console.log('\n' + '='.repeat(50));
  console.log('STUDIO TEST SUMMARY');
  console.log('='.repeat(50));
  console.log('\nIf LiveKit connection fails:');
  console.log('1. Ensure .env.local has valid LiveKit credentials');
  console.log('2. Check that LiveKit service is accessible');
  console.log('3. Verify user has permission to access this stream');
  console.log('4. Check browser console for WebSocket errors');
});