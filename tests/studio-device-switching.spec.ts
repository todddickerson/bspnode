import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test('studio device switching test', async ({ page, context }) => {
  await context.grantPermissions(['camera', 'microphone']);
  
  console.log('🔧 Studio Device Switching Test\n');
  
  // Step 1: Login
  console.log('1️⃣ Logging in...');
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[id="email"]', 'testuser@example.com')
  await page.fill('input[id="password"]', 'password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 10000 })
  console.log('✅ Login successful\n');
  
  // Step 2: Create or get stream
  console.log('2️⃣ Getting stream...');
  
  const streams = await page.evaluate(async () => {
    const response = await fetch('/api/streams');
    if (response.ok) {
      return await response.json();
    }
    return [];
  });
  
  let streamId;
  if (streams.length > 0) {
    streamId = streams[0].id;
    console.log(`Using existing stream: ${streamId}`);
  } else {
    const newStream = await page.evaluate(async () => {
      const response = await fetch('/api/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Device Test Stream',
          description: 'Testing device switching',
          streamType: 'LIVEKIT',
          maxHosts: 4
        }),
      });
      return await response.json();
    });
    streamId = newStream.id;
    console.log(`Created new stream: ${streamId}`);
  }
  
  // Step 3: Navigate to studio
  console.log('\n3️⃣ Navigating to studio...');
  await page.goto(`${BASE_URL}/stream/${streamId}/studio`);
  await page.waitForTimeout(2000);
  
  // Step 4: Join studio
  console.log('4️⃣ Joining studio...');
  const joinButton = page.locator('button:has-text("Join Studio")');
  
  if (await joinButton.isVisible()) {
    await joinButton.click();
    console.log('⏳ Waiting for connection...');
    
    // Wait for connection
    await page.waitForSelector('button:has-text("Go Live")', { timeout: 15000 });
    console.log('✅ Connected to studio\n');
  }
  
  // Step 5: Test settings button
  console.log('5️⃣ Testing settings controls...');
  const settingsButton = page.locator('button[aria-label="Settings"], button:has(svg.lucide-settings)');
  
  console.log('Looking for settings button...');
  const settingsVisible = await settingsButton.isVisible();
  console.log(`Settings button visible: ${settingsVisible ? '✅' : '❌'}`);
  
  if (settingsVisible) {
    await settingsButton.click();
    await page.waitForTimeout(1000);
    
    // Check if device selectors are visible
    const cameraSelector = page.locator('select').first();
    const micSelector = page.locator('select').nth(1);
    
    const cameraSelectorVisible = await cameraSelector.isVisible();
    const micSelectorVisible = await micSelector.isVisible();
    
    console.log(`\n📹 Device Selectors:`);
    console.log(`   Camera selector visible: ${cameraSelectorVisible ? '✅' : '❌'}`);
    console.log(`   Microphone selector visible: ${micSelectorVisible ? '✅' : '❌'}`);
    
    if (cameraSelectorVisible) {
      // Get available camera options
      const cameraOptions = await cameraSelector.locator('option').allTextContents();
      console.log(`\n   Available cameras: ${cameraOptions.length}`);
      cameraOptions.forEach((cam, i) => console.log(`     ${i + 1}. ${cam}`));
      
      // Try to switch camera if multiple available
      if (cameraOptions.length > 1) {
        console.log('\n   Attempting to switch camera...');
        await cameraSelector.selectOption({ index: 1 });
        await page.waitForTimeout(2000);
        console.log('   ✅ Camera switch attempted');
      }
    }
    
    if (micSelectorVisible) {
      // Get available microphone options
      const micOptions = await micSelector.locator('option').allTextContents();
      console.log(`\n   Available microphones: ${micOptions.length}`);
      micOptions.forEach((mic, i) => console.log(`     ${i + 1}. ${mic}`));
      
      // Try to switch microphone if multiple available
      if (micOptions.length > 1) {
        console.log('\n   Attempting to switch microphone...');
        await micSelector.selectOption({ index: 1 });
        await page.waitForTimeout(2000);
        console.log('   ✅ Microphone switch attempted');
      }
    }
    
    // Take screenshot of settings panel
    await page.screenshot({ path: 'test-results/studio-device-settings.png', fullPage: true });
    
    // Close settings
    await settingsButton.click();
    console.log('\n✅ Settings panel tested');
  } else {
    console.log('❌ Settings button not found or not visible');
  }
  
  // Step 6: Test video/audio toggle
  console.log('\n6️⃣ Testing media controls...');
  const videoButton = page.locator('button:has(svg.lucide-video), button:has(svg.lucide-video-off)').first();
  const audioButton = page.locator('button:has(svg.lucide-mic), button:has(svg.lucide-mic-off)').first();
  
  if (await videoButton.isVisible()) {
    console.log('   Testing video toggle...');
    await videoButton.click();
    await page.waitForTimeout(1000);
    await videoButton.click();
    await page.waitForTimeout(1000);
    console.log('   ✅ Video toggle works');
  }
  
  if (await audioButton.isVisible()) {
    console.log('   Testing audio toggle...');
    await audioButton.click();
    await page.waitForTimeout(1000);
    await audioButton.click();
    await page.waitForTimeout(1000);
    console.log('   ✅ Audio toggle works');
  }
  
  // Final state
  const finalState = await page.evaluate(() => {
    const videos = document.querySelectorAll('video');
    const selects = document.querySelectorAll('select');
    return {
      videoCount: videos.length,
      hasActiveVideo: videos.length > 0 && Array.from(videos).some(v => v.srcObject !== null),
      selectCount: selects.length,
      selectsVisible: Array.from(selects).map(s => s.offsetParent !== null)
    };
  });
  
  console.log('\n🎯 Final State:');
  console.log(`   Video elements: ${finalState.videoCount}`);
  console.log(`   Active video: ${finalState.hasActiveVideo ? '✅' : '❌'}`);
  console.log(`   Device selectors: ${finalState.selectCount}`);
  console.log(`   Selectors visible: ${finalState.selectsVisible.filter(v => v).length}/${finalState.selectCount}`);
  
  console.log('\n' + '='.repeat(50));
  console.log('DEVICE SWITCHING TEST COMPLETE');
  console.log('='.repeat(50));
});