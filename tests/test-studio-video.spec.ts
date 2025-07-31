import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test('test studio video functionality', async ({ page, context }) => {
  await context.grantPermissions(['camera', 'microphone']);
  
  console.log('🎥 Testing Studio Video\n');
  
  // Enable console log capture
  page.on('console', msg => {
    if (msg.type() === 'log') {
      console.log('Browser log:', msg.text());
    } else if (msg.type() === 'error') {
      console.log('Browser error:', msg.text());
    }
  });
  
  // Step 1: Login
  console.log('1️⃣ Logging in...');
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[id="email"]', 'testuser@example.com')
  await page.fill('input[id="password"]', 'password123')
  await page.click('button[type="submit"]')
  
  // Wait for navigation with longer timeout
  try {
    await page.waitForURL('**/dashboard', { timeout: 15000 })
    console.log('✅ Login successful\n');
  } catch (e) {
    console.log('❌ Login failed, checking current URL:', page.url());
    await page.screenshot({ path: 'test-results/login-failed.png' });
    return;
  }
  
  // Step 2: Get or create a stream
  console.log('2️⃣ Finding or creating stream...');
  
  const streams = await page.evaluate(async () => {
    const response = await fetch('/api/streams');
    if (response.ok) {
      return await response.json();
    }
    return [];
  });
  
  let streamId;
  const livekitStream = streams.find(s => s.streamType === 'LIVEKIT');
  
  if (livekitStream) {
    streamId = livekitStream.id;
    console.log(`Using existing stream: ${streamId}`);
  } else {
    console.log('Creating new LIVEKIT stream...');
    const newStream = await page.evaluate(async () => {
      const response = await fetch('/api/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Video Test Stream ' + Date.now(),
          description: 'Testing video functionality',
          streamType: 'LIVEKIT',
          maxHosts: 4
        }),
      });
      return await response.json();
    });
    streamId = newStream.id;
    console.log(`Created stream: ${streamId}`);
  }
  
  // Step 3: Navigate to studio
  console.log('\n3️⃣ Navigating to studio...');
  await page.goto(`${BASE_URL}/stream/${streamId}/studio`);
  await page.waitForTimeout(2000);
  
  // Take initial screenshot
  await page.screenshot({ path: 'test-results/studio-initial.png' });
  
  // Step 4: Join studio
  console.log('4️⃣ Joining studio...');
  const joinButton = page.locator('button:has-text("Join Studio")');
  
  if (await joinButton.isVisible()) {
    console.log('Clicking Join Studio...');
    await joinButton.click();
    
    // Wait for connection with periodic checks
    let connected = false;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1000);
      
      // Check for Go Live button
      const goLiveButton = page.locator('button:has-text("Go Live")');
      if (await goLiveButton.isVisible()) {
        connected = true;
        console.log('✅ Connected to LiveKit!');
        break;
      }
      
      // Check for error
      const errorToast = page.locator('[role="alert"]');
      if (await errorToast.isVisible()) {
        const errorText = await errorToast.textContent();
        console.log(`❌ Error: ${errorText}`);
        break;
      }
      
      if (i % 5 === 0) {
        console.log(`   Still connecting... (${i}s)`);
      }
    }
    
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/studio-after-join.png' });
    
    // Step 5: Check video element
    console.log('\n5️⃣ Checking video element...');
    const videoInfo = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (!video) return { exists: false };
      
      return {
        exists: true,
        width: video.offsetWidth,
        height: video.offsetHeight,
        hasStream: !!video.srcObject,
        readyState: video.readyState,
        paused: video.paused,
        muted: video.muted,
        autoplay: video.autoplay,
        currentTime: video.currentTime,
        duration: video.duration,
        style: video.getAttribute('style'),
        className: video.className
      };
    });
    
    console.log('Video element info:', JSON.stringify(videoInfo, null, 2));
    
    // Step 6: Test controls
    if (connected) {
      console.log('\n6️⃣ Testing controls...');
      
      // Test video toggle
      const videoButton = page.locator('button').filter({ 
        has: page.locator('svg.lucide-video, svg.lucide-video-off') 
      }).first();
      
      if (await videoButton.isVisible()) {
        console.log('Testing video toggle...');
        await videoButton.click();
        await page.waitForTimeout(1000);
        await videoButton.click();
        await page.waitForTimeout(1000);
        console.log('✅ Video toggle tested');
      }
      
      // Test settings
      const settingsButton = page.locator('button').filter({ 
        has: page.locator('svg.lucide-settings') 
      }).first();
      
      if (await settingsButton.isVisible()) {
        console.log('Testing settings...');
        await settingsButton.click();
        await page.waitForTimeout(1000);
        
        // Check for device selectors
        const selectors = await page.locator('select').count();
        console.log(`Found ${selectors} device selectors`);
        
        if (selectors > 0) {
          const cameraOptions = await page.locator('select').first().locator('option').count();
          const micOptions = await page.locator('select').nth(1).locator('option').count();
          console.log(`Camera options: ${cameraOptions}, Mic options: ${micOptions}`);
        }
        
        await page.screenshot({ path: 'test-results/studio-settings-open.png' });
      }
    }
  } else {
    console.log('❌ Join Studio button not found');
  }
  
  console.log('\n✅ Test complete');
});