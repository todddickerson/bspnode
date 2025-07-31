import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test('create livekit stream and test studio', async ({ page, context }) => {
  await context.grantPermissions(['camera', 'microphone']);
  
  console.log('🎥 LiveKit Studio Test\n');
  
  // Track errors
  const errors = [];
  page.on('response', async resp => {
    if (resp.url().includes('/api/') && !resp.ok()) {
      const body = await resp.text().catch(() => 'no body');
      errors.push({
        url: resp.url(),
        status: resp.status(),
        body: body
      });
    }
  });
  
  // Step 1: Login
  console.log('1️⃣ Logging in...');
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[id="email"]', 'testuser@example.com')
  await page.fill('input[id="password"]', 'password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 10000 })
  console.log('✅ Login successful\n');
  
  // Step 2: Create LiveKit stream via API
  console.log('2️⃣ Creating LiveKit stream via API...');
  
  const streamData = {
    title: 'LiveKit Studio Test ' + Date.now(),
    description: 'Testing LiveKit studio functionality',
    streamType: 'LIVEKIT',
    maxHosts: 4
  };
  
  const createResponse = await page.evaluate(async (data) => {
    const response = await fetch('/api/streams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await response.json();
    return { ok: response.ok, data: json };
  }, streamData);
  
  if (!createResponse.ok) {
    console.log('❌ Failed to create stream:', createResponse.data);
    return;
  }
  
  const streamId = createResponse.data.id;
  console.log(`✅ Stream created: ${streamId}\n`);
  
  // Step 3: Navigate to studio
  console.log('3️⃣ Navigating to studio...');
  await page.goto(`${BASE_URL}/stream/${streamId}/studio`);
  await page.waitForTimeout(3000);
  
  // Verify we're on studio page
  const studioTitle = await page.locator('h1').textContent();
  console.log(`📍 On page: ${studioTitle}\n`);
  
  // Step 4: Join Studio
  console.log('4️⃣ Attempting to join studio...');
  const joinButton = page.locator('button:has-text("Join Studio")');
  
  if (!await joinButton.isVisible()) {
    console.log('❌ Join Studio button not found');
    await page.screenshot({ path: 'test-results/livekit-no-button.png', fullPage: true });
    return;
  }
  
  // Clear errors before join
  errors.length = 0;
  
  await joinButton.click();
  console.log('⏳ Waiting for LiveKit connection...\n');
  
  // Wait for connection with periodic checks
  let connected = false;
  let errorMessage = '';
  
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(1000);
    
    // Check for success
    const goLiveButton = page.locator('button:has-text("Go Live")');
    if (await goLiveButton.isVisible()) {
      connected = true;
      console.log('✅ Connected to LiveKit successfully!');
      break;
    }
    
    // Check for error
    const errorToast = page.locator('[role="alert"]');
    if (await errorToast.isVisible()) {
      errorMessage = await errorToast.textContent() || 'Unknown error';
      console.log(`❌ Error: ${errorMessage}`);
      break;
    }
    
    // Progress indicator
    if (i % 3 === 0 && i > 0) {
      console.log(`   Still waiting... (${i}s)`);
    }
  }
  
  console.log('\n📊 Connection Result:');
  console.log(`   Connected: ${connected ? '✅ Yes' : '❌ No'}`);
  
  if (errors.length > 0) {
    console.log('\n🔴 API Errors:');
    errors.forEach(err => {
      console.log(`   ${err.url.replace(BASE_URL, '')}`);
      console.log(`   Status: ${err.status}`);
      console.log(`   Body: ${err.body}\n`);
    });
  }
  
  // Check final state
  const finalState = await page.evaluate(() => {
    const videos = document.querySelectorAll('video');
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim());
    return {
      videoCount: videos.length,
      hasLocalVideo: videos.length > 0 && videos[0].srcObject !== null,
      buttons: buttons.filter(b => b)
    };
  });
  
  console.log('🎯 Final State:');
  console.log(`   Video elements: ${finalState.videoCount}`);
  console.log(`   Local video active: ${finalState.hasLocalVideo ? '✅' : '❌'}`);
  console.log(`   Available buttons: ${finalState.buttons.join(', ')}`);
  
  await page.screenshot({ path: 'test-results/livekit-final-state.png', fullPage: true });
  
  // If connected, try to go live
  if (connected) {
    console.log('\n5️⃣ Testing broadcast...');
    const goLiveButton = page.locator('button:has-text("Go Live")');
    await goLiveButton.click();
    await page.waitForTimeout(5000);
    
    const liveIndicator = page.locator('text="LIVE"');
    const isLive = await liveIndicator.isVisible();
    console.log(`   Broadcasting: ${isLive ? '✅ LIVE!' : '❌ Not live'}`);
    
    if (isLive) {
      console.log('\n6️⃣ Testing stream end...');
      const endButton = page.locator('button:has-text("End Stream")');
      if (await endButton.isVisible()) {
        await endButton.click();
        await page.waitForTimeout(2000);
        console.log('   ✅ Stream ended successfully');
      }
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('LIVEKIT STUDIO TEST COMPLETE');
  console.log('='.repeat(50));
});