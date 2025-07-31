import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test('test studio video with screenshots', async ({ page, context }) => {
  await context.grantPermissions(['camera', 'microphone']);
  
  console.log('🎥 Studio Video Test with Screenshots\n');
  
  // Capture console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`Browser ${msg.type()}: ${text}`);
    }
  });
  
  // Step 1: Login
  console.log('1️⃣ Logging in...');
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[id="email"]', { timeout: 5000 });
  await page.fill('input[id="email"]', 'testuser@example.com');
  await page.fill('input[id="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  console.log('✅ Logged in\n');
  
  // Step 2: Find LIVEKIT stream with "Enter Studio" button
  console.log('2️⃣ Finding LiveKit stream...');
  await page.screenshot({ path: 'test-results/01-dashboard.png' });
  
  // Look for Enter Studio button
  const enterStudioButton = page.locator('button:has-text("Enter Studio")').first();
  if (await enterStudioButton.isVisible()) {
    console.log('✅ Found "Enter Studio" button, clicking...');
    await enterStudioButton.click();
    
    // Wait for navigation
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    await page.screenshot({ path: 'test-results/02-after-enter-studio.png' });
    
    // Now look for Join Studio button
    console.log('\n3️⃣ Looking for Join Studio button...');
    
    // Clear console before joining
    consoleLogs.length = 0;
    
    const joinButton = page.locator('button:has-text("Join Studio")');
    if (await joinButton.isVisible()) {
      console.log('✅ Found "Join Studio" button, clicking...');
      await joinButton.click();
      
      // Wait for connection
      console.log('⏳ Waiting for LiveKit connection...');
      
      // Wait for either Go Live button or error
      const result = await Promise.race([
        page.waitForSelector('button:has-text("Go Live")', { timeout: 15000 }).then(() => 'connected'),
        page.waitForSelector('[role="alert"]', { timeout: 15000 }).then(() => 'error'),
        page.waitForTimeout(15000).then(() => 'timeout')
      ]);
      
      console.log(`\n📊 Connection result: ${result}`);
      await page.screenshot({ path: 'test-results/03-after-join-studio.png' });
      
      // Check video element state
      const videoState = await page.evaluate(() => {
        const videos = document.querySelectorAll('video');
        return Array.from(videos).map((video, index) => {
          const stream = video.srcObject as MediaStream;
          const tracks = stream ? stream.getTracks() : [];
          
          return {
            index,
            hasStream: !!video.srcObject,
            streamActive: stream?.active || false,
            videoTracks: tracks.filter(t => t.kind === 'video').map(t => ({
              enabled: t.enabled,
              readyState: t.readyState,
              label: t.label
            })),
            audioTracks: tracks.filter(t => t.kind === 'audio').map(t => ({
              enabled: t.enabled,
              readyState: t.readyState,
              label: t.label
            })),
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            readyState: video.readyState,
            muted: video.muted,
            autoplay: video.autoplay
          };
        });
      });
      
      console.log('\n📹 Video Elements State:');
      console.log(JSON.stringify(videoState, null, 2));
      
      // Test controls if connected
      if (result === 'connected') {
        console.log('\n4️⃣ Testing controls...');
        
        // Test video toggle
        const videoButton = page.locator('button').filter({ 
          has: page.locator('svg.lucide-video, svg.lucide-video-off') 
        }).first();
        
        if (await videoButton.isVisible()) {
          await videoButton.click();
          await page.waitForTimeout(1000);
          await page.screenshot({ path: 'test-results/04-video-toggled.png' });
          await videoButton.click();
          await page.waitForTimeout(1000);
        }
        
        // Test settings
        const settingsButton = page.locator('button').filter({ 
          has: page.locator('svg.lucide-settings') 
        }).first();
        
        if (await settingsButton.isVisible()) {
          await settingsButton.click();
          await page.waitForTimeout(1000);
          await page.screenshot({ path: 'test-results/05-settings-open.png' });
          
          // Check device selectors
          const selectors = await page.locator('select').count();
          console.log(`   Found ${selectors} device selectors`);
          
          if (selectors > 0) {
            const devices = await page.evaluate(() => {
              const selects = Array.from(document.querySelectorAll('select'));
              return selects.map(select => ({
                options: Array.from(select.options).map(opt => opt.text),
                value: select.value
              }));
            });
            console.log('   Device options:', JSON.stringify(devices, null, 2));
          }
        }
      }
      
      // Print console logs
      console.log('\n📝 Console Logs from Studio:');
      consoleLogs.slice(-20).forEach(log => console.log(log));
      
    } else {
      console.log('❌ Join Studio button not found');
      await page.screenshot({ path: 'test-results/no-join-button.png' });
    }
  } else {
    console.log('❌ No "Enter Studio" button found on dashboard');
    
    // Try direct navigation to first LIVEKIT stream
    const streams = await page.evaluate(async () => {
      const response = await fetch('/api/streams');
      return await response.json();
    });
    
    const livekitStream = streams.find(s => s.streamType === 'LIVEKIT');
    if (livekitStream) {
      console.log(`\n📍 Navigating directly to studio: ${livekitStream.id}`);
      await page.goto(`${BASE_URL}/stream/${livekitStream.id}/studio`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/direct-studio-nav.png' });
    }
  }
  
  console.log('\n✅ Test complete');
});