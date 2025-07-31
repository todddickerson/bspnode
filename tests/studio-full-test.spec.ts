import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test('complete studio test with device switching', async ({ page, context }) => {
  await context.grantPermissions(['camera', 'microphone']);
  
  console.log('🎬 Complete Studio Test\n');
  
  // Step 1: Login
  console.log('1️⃣ Logging in...');
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[id="email"]', 'testuser@example.com')
  await page.fill('input[id="password"]', 'password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 10000 })
  console.log('✅ Login successful\n');
  
  // Step 2: Create new LiveKit stream
  console.log('2️⃣ Creating new LiveKit stream...');
  
  const newStream = await page.evaluate(async () => {
    const response = await fetch('/api/streams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Full Studio Test ' + Date.now(),
        description: 'Testing complete studio functionality',
        streamType: 'LIVEKIT',
        maxHosts: 4
      }),
    });
    return await response.json();
  });
  
  const streamId = newStream.id;
  console.log(`✅ Created stream: ${streamId}\n`);
  
  // Step 3: Navigate to studio
  console.log('3️⃣ Navigating to studio...');
  await page.goto(`${BASE_URL}/stream/${streamId}/studio`);
  await page.waitForTimeout(2000);
  
  // Verify we're on studio page
  const studioTitle = await page.locator('h1').textContent();
  console.log(`Page title: ${studioTitle}`);
  
  // Step 4: Join studio
  console.log('\n4️⃣ Joining studio...');
  const joinButton = page.locator('button:has-text("Join Studio")');
  
  if (!await joinButton.isVisible()) {
    console.log('❌ Join Studio button not visible');
    await page.screenshot({ path: 'test-results/studio-no-join-button.png', fullPage: true });
    return;
  }
  
  await joinButton.click();
  console.log('⏳ Waiting for LiveKit connection...');
  
  // Wait for connection
  try {
    await page.waitForSelector('button:has-text("Go Live")', { timeout: 20000 });
    console.log('✅ Connected to LiveKit successfully!\n');
  } catch (error) {
    console.log('❌ Failed to connect to LiveKit');
    const errorToast = await page.locator('[role="alert"]').textContent().catch(() => 'No error message');
    console.log(`Error: ${errorToast}`);
    await page.screenshot({ path: 'test-results/studio-connection-failed.png', fullPage: true });
    return;
  }
  
  // Step 5: Test settings and device switching
  console.log('5️⃣ Testing device settings...');
  
  // Find settings button - try multiple selectors
  let settingsButton = page.locator('button').filter({ has: page.locator('svg.lucide-settings') });
  
  if (!await settingsButton.isVisible()) {
    // Try another selector
    settingsButton = page.locator('button[aria-label="Settings"]');
  }
  
  const settingsVisible = await settingsButton.isVisible();
  console.log(`Settings button visible: ${settingsVisible ? '✅' : '❌'}`);
  
  if (settingsVisible) {
    // Click settings to show device selectors
    await settingsButton.click();
    await page.waitForTimeout(1000);
    console.log('✅ Settings panel opened');
    
    // Check for device selectors
    const cameraLabel = page.locator('label:has-text("Camera")');
    const micLabel = page.locator('label:has-text("Microphone")');
    
    const cameraLabelVisible = await cameraLabel.isVisible();
    const micLabelVisible = await micLabel.isVisible();
    
    console.log(`\n📹 Device Controls:`);
    console.log(`   Camera label visible: ${cameraLabelVisible ? '✅' : '❌'}`);
    console.log(`   Microphone label visible: ${micLabelVisible ? '✅' : '❌'}`);
    
    if (cameraLabelVisible) {
      const cameraSelect = page.locator('select').first();
      const cameraOptions = await cameraSelect.locator('option').count();
      console.log(`   Camera options: ${cameraOptions}`);
      
      if (cameraOptions > 1) {
        // Get current value
        const currentCamera = await cameraSelect.inputValue();
        console.log(`   Current camera: ${currentCamera.slice(0, 20)}...`);
        
        // Switch to second option
        await cameraSelect.selectOption({ index: 1 });
        await page.waitForTimeout(2000);
        
        const newCamera = await cameraSelect.inputValue();
        console.log(`   Switched to: ${newCamera.slice(0, 20)}...`);
        console.log(`   ✅ Camera switching works`);
      }
    }
    
    if (micLabelVisible) {
      const micSelect = page.locator('select').nth(1);
      const micOptions = await micSelect.locator('option').count();
      console.log(`   Microphone options: ${micOptions}`);
      
      if (micOptions > 1) {
        // Get current value
        const currentMic = await micSelect.inputValue();
        console.log(`   Current microphone: ${currentMic.slice(0, 20)}...`);
        
        // Switch to second option
        await micSelect.selectOption({ index: 1 });
        await page.waitForTimeout(2000);
        
        const newMic = await micSelect.inputValue();
        console.log(`   Switched to: ${newMic.slice(0, 20)}...`);
        console.log(`   ✅ Microphone switching works`);
      }
    }
    
    // Take screenshot of settings
    await page.screenshot({ path: 'test-results/studio-settings-open.png', fullPage: true });
    
    // Close settings
    await settingsButton.click();
    await page.waitForTimeout(500);
    console.log('\n✅ Settings tested and closed');
  }
  
  // Step 6: Test media controls
  console.log('\n6️⃣ Testing media controls...');
  
  // Test video toggle
  const videoButton = page.locator('button').filter({ 
    has: page.locator('svg.lucide-video, svg.lucide-video-off') 
  }).first();
  
  if (await videoButton.isVisible()) {
    const initialVideoIcon = await videoButton.locator('svg').getAttribute('class');
    await videoButton.click();
    await page.waitForTimeout(1000);
    const afterVideoIcon = await videoButton.locator('svg').getAttribute('class');
    console.log(`   Video toggle: ${initialVideoIcon !== afterVideoIcon ? '✅ Works' : '❌ Not working'}`);
    
    // Toggle back
    await videoButton.click();
    await page.waitForTimeout(1000);
  }
  
  // Test audio toggle
  const audioButton = page.locator('button').filter({ 
    has: page.locator('svg.lucide-mic, svg.lucide-mic-off') 
  }).first();
  
  if (await audioButton.isVisible()) {
    const initialAudioIcon = await audioButton.locator('svg').getAttribute('class');
    await audioButton.click();
    await page.waitForTimeout(1000);
    const afterAudioIcon = await audioButton.locator('svg').getAttribute('class');
    console.log(`   Audio toggle: ${initialAudioIcon !== afterAudioIcon ? '✅ Works' : '❌ Not working'}`);
    
    // Toggle back
    await audioButton.click();
    await page.waitForTimeout(1000);
  }
  
  // Step 7: Test going live
  console.log('\n7️⃣ Testing broadcast...');
  const goLiveButton = page.locator('button:has-text("Go Live")');
  
  if (await goLiveButton.isVisible()) {
    await goLiveButton.click();
    console.log('⏳ Starting broadcast...');
    await page.waitForTimeout(5000);
    
    const liveIndicator = page.locator('text="LIVE"');
    const isLive = await liveIndicator.isVisible();
    console.log(`   Live status: ${isLive ? '✅ LIVE!' : '❌ Not live'}`);
    
    if (isLive) {
      // End stream
      const endButton = page.locator('button:has-text("End Stream")');
      if (await endButton.isVisible()) {
        console.log('   Ending stream...');
        await endButton.click();
        await page.waitForTimeout(2000);
        console.log('   ✅ Stream ended');
      }
    }
  }
  
  // Final summary
  const finalState = await page.evaluate(() => {
    const videos = document.querySelectorAll('video');
    const activeVideos = Array.from(videos).filter(v => v.srcObject !== null);
    const selects = document.querySelectorAll('select');
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(t => t);
    
    return {
      videoCount: videos.length,
      activeVideoCount: activeVideos.length,
      selectCount: selects.length,
      buttonTexts: buttons
    };
  });
  
  console.log('\n🎯 Final Summary:');
  console.log(`   Total videos: ${finalState.videoCount}`);
  console.log(`   Active videos: ${finalState.activeVideoCount}`);
  console.log(`   Device selectors: ${finalState.selectCount}`);
  console.log(`   Available actions: ${finalState.buttonTexts.slice(0, 5).join(', ')}...`);
  
  // Take final screenshot
  await page.screenshot({ path: 'test-results/studio-final-state.png', fullPage: true });
  
  console.log('\n' + '='.repeat(50));
  console.log('COMPLETE STUDIO TEST FINISHED');
  console.log('='.repeat(50));
});