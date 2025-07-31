import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test('simple studio functionality check', async ({ page, context }) => {
  await context.grantPermissions(['camera', 'microphone']);
  
  console.log('🎬 Simple Studio Test\n');
  
  // Login
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[id="email"]', 'testuser@example.com')
  await page.fill('input[id="password"]', 'password123')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(3000)
  
  console.log('✅ Logged in');
  
  // Go to dashboard and find a stream
  await page.goto(`${BASE_URL}/dashboard`)
  await page.waitForTimeout(2000)
  
  // Click on first available stream
  const streamCard = page.locator('.bg-white').filter({ hasText: 'Stream' }).first()
  const streamTitle = await streamCard.locator('h3').textContent()
  console.log(`📺 Using stream: ${streamTitle}`);
  
  // Try to access studio - look for any studio-related button
  const studioButton = streamCard.locator('button:has-text("Studio"), a:has-text("Studio")')
  const broadcastButton = streamCard.locator('button:has-text("Start Broadcasting")')
  
  if (await studioButton.isVisible()) {
    await studioButton.click()
  } else if (await broadcastButton.isVisible()) {
    await broadcastButton.click()
  } else {
    console.log('❌ No studio/broadcast button found');
    return
  }
  
  await page.waitForTimeout(3000)
  
  // Check if we're on studio or broadcast page
  const currentUrl = page.url()
  console.log(`📍 Current page: ${currentUrl.includes('/studio') ? 'Studio' : currentUrl.includes('/broadcast') ? 'Broadcast' : 'Other'}`);
  
  // If on broadcast page, try to navigate to studio
  if (currentUrl.includes('/broadcast') && !currentUrl.includes('/studio')) {
    const streamId = currentUrl.match(/stream\/([^\/]+)/)?.[1]
    if (streamId) {
      console.log('🔄 Navigating to studio...');
      await page.goto(`${BASE_URL}/stream/${streamId}/studio`)
      await page.waitForTimeout(3000)
    }
  }
  
  // Now test studio functionality
  if (page.url().includes('/studio')) {
    console.log('\n📋 STUDIO FUNCTIONALITY TEST:');
    
    // 1. Check page elements
    const joinButton = page.locator('button:has-text("Join Studio")')
    const inviteSection = page.locator('text="Invite Co-hosts"')
    const controlsSection = page.locator('text="Controls"')
    
    console.log(`- Join button: ${await joinButton.isVisible() ? '✅' : '❌'}`);
    console.log(`- Invite section: ${await inviteSection.isVisible() ? '✅' : '❌'}`);
    console.log(`- Controls section: ${await controlsSection.isVisible() ? '✅' : '❌'}`);
    
    // 2. Try to join studio
    if (await joinButton.isVisible()) {
      console.log('\n🔌 Attempting to join...');
      
      // Monitor console errors
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      await joinButton.click()
      await page.waitForTimeout(8000)
      
      // Check state after join attempt
      const goLiveButton = page.locator('button:has-text("Go Live")')
      const errorToast = page.locator('[role="alert"]')
      
      if (await goLiveButton.isVisible()) {
        console.log('✅ Successfully connected to LiveKit!');
        
        // Test controls
        const videoBtn = page.locator('button[aria-label*="video"], button').filter({ has: page.locator('svg.lucide-video') }).first()
        const audioBtn = page.locator('button[aria-label*="audio"], button').filter({ has: page.locator('svg.lucide-mic') }).first()
        
        console.log(`- Video control: ${await videoBtn.isEnabled() ? '✅ Enabled' : '❌ Disabled'}`);
        console.log(`- Audio control: ${await audioBtn.isEnabled() ? '✅ Enabled' : '❌ Disabled'}`);
        
        // Try broadcast
        console.log('\n🔴 Testing broadcast...');
        await goLiveButton.click()
        await page.waitForTimeout(5000)
        
        const liveIndicator = page.locator('text="LIVE"')
        console.log(`- Broadcast status: ${await liveIndicator.isVisible() ? '✅ LIVE!' : '❌ Not live'}`);
      } else if (await errorToast.isVisible()) {
        const errorMsg = await errorToast.textContent()
        console.log(`❌ Connection failed: ${errorMsg}`);
        
        if (errors.length > 0) {
          console.log('\nConsole errors:');
          errors.forEach(e => console.log(`  - ${e}`));
        }
        
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Check .env.local has LiveKit credentials');
        console.log('2. Verify NEXT_PUBLIC_LIVEKIT_URL is accessible');
        console.log('3. Check browser console for detailed errors');
      } else {
        console.log('❓ Unknown state after join attempt');
      }
    }
    
    await page.screenshot({ path: 'test-results/studio-simple-final.png', fullPage: true });
  } else {
    console.log('❌ Not on studio page');
    console.log('Note: This stream might not support multi-host/studio mode');
  }
});