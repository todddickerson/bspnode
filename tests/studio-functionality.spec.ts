import { test, expect, Page } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Studio Multi-Host Functionality', () => {
  test.beforeEach(async ({ context }) => {
    // Grant camera and microphone permissions
    await context.grantPermissions(['camera', 'microphone']);
  });

  test('complete studio flow with error checks', async ({ page, context }) => {
    console.log('🎬 Starting studio functionality test...');
    
    // Step 1: Login as stream owner
    console.log('📝 Step 1: Logging in as stream owner...');
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[id="email"]', 'testuser@example.com')
    await page.fill('input[id="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL(`${BASE_URL}/dashboard`)
    console.log('✅ Login successful');
    
    // Step 2: Create a multi-host stream
    console.log('📝 Step 2: Creating multi-host stream...');
    await page.click('text="Create New Stream"')
    await page.fill('input[name="title"]', 'Test Studio Stream')
    await page.fill('textarea[name="description"]', 'Testing multi-host studio functionality')
    
    // Select multi-host streaming option if available
    const multiHostOption = page.locator('text="Multi-Host Streaming", text="Collaborative Streaming"')
    if (await multiHostOption.isVisible()) {
      await multiHostOption.click()
    } else {
      // Fall back to browser streaming
      await page.getByText('Browser Streaming').click()
    }
    
    await page.click('button[type="submit"]')
    
    // Wait for redirect - could be to studio or broadcast page
    await page.waitForURL(/\/stream\/.*\/(studio|broadcast)/)
    
    const currentUrl = page.url()
    const streamId = currentUrl.match(/stream\/([^\/]+)/)?.[1]
    console.log(`✅ Stream created with ID: ${streamId}`);
    
    // Take screenshot of initial page
    await page.screenshot({ path: 'test-results/studio-01-initial.png', fullPage: true });
    
    // Step 3: Navigate to studio if not already there
    if (!currentUrl.includes('/studio')) {
      console.log('📝 Step 3: Navigating to studio...');
      await page.goto(`${BASE_URL}/stream/${streamId}/studio`)
      await page.waitForTimeout(2000)
    }
    
    // Check if we're on the studio page
    const studioTitle = page.locator('h1').first()
    const isStudioPage = await page.url().includes('/studio')
    console.log(`📍 On studio page: ${isStudioPage}`);
    
    if (!isStudioPage) {
      console.log('⚠️  Not on studio page, checking for multi-host option...');
      
      // Look for a way to access studio from broadcast page
      const studioButton = page.locator('text="Studio", text="Multi-Host", text="Collaborate"')
      if (await studioButton.isVisible()) {
        await studioButton.click()
        await page.waitForURL(/\/studio/)
        console.log('✅ Navigated to studio');
      } else {
        console.log('❌ Studio option not available - stream might not support multi-host');
        await page.screenshot({ path: 'test-results/studio-no-access.png', fullPage: true });
        return
      }
    }
    
    // Step 4: Check studio UI elements
    console.log('📝 Step 4: Checking studio UI elements...');
    await page.screenshot({ path: 'test-results/studio-02-interface.png', fullPage: true });
    
    // Check for key studio elements
    const joinStudioButton = page.locator('button:has-text("Join Studio")')
    const inviteLinkSection = page.locator('text="Invite Co-hosts"')
    const controlsSection = page.locator('text="Controls"')
    const hostsSection = page.locator('text="Current Hosts"')
    
    console.log('🔍 Studio UI Elements:');
    console.log(`- Join Studio button: ${await joinStudioButton.isVisible()}`);
    console.log(`- Invite section: ${await inviteLinkSection.isVisible()}`);
    console.log(`- Controls section: ${await controlsSection.isVisible()}`);
    console.log(`- Hosts section: ${await hostsSection.isVisible()}`);
    
    // Step 5: Test LiveKit connection
    console.log('📝 Step 5: Testing LiveKit connection...');
    
    if (await joinStudioButton.isVisible()) {
      await joinStudioButton.click()
      console.log('🔌 Attempting to join studio...');
      
      // Wait for connection or error
      await page.waitForTimeout(5000)
      
      // Check for connection status
      const connectingText = page.locator('text="Connecting"')
      const connectedIndicator = page.locator('button:has-text("Go Live")')
      const errorToast = page.locator('[role="alert"]')
      
      if (await errorToast.isVisible()) {
        const errorText = await errorToast.textContent()
        console.log(`❌ Connection error: ${errorText}`);
        await page.screenshot({ path: 'test-results/studio-03-connection-error.png', fullPage: true });
        
        // Check specific errors
        if (errorText?.includes('token')) {
          console.log('⚠️  LiveKit token generation failed - check API keys');
        } else if (errorText?.includes('WebSocket')) {
          console.log('⚠️  LiveKit WebSocket connection failed - check URL');
        }
      } else if (await connectedIndicator.isVisible()) {
        console.log('✅ Successfully connected to studio');
        await page.screenshot({ path: 'test-results/studio-04-connected.png', fullPage: true });
        
        // Test video/audio controls
        const videoButton = page.locator('button[aria-label*="video"], button:has(svg.lucide-video)')
        const audioButton = page.locator('button[aria-label*="audio"], button:has(svg.lucide-mic)')
        
        if (await videoButton.isVisible()) {
          await videoButton.click()
          console.log('📹 Toggled video');
        }
        
        if (await audioButton.isVisible()) {
          await audioButton.click()
          console.log('🎤 Toggled audio');
        }
      } else {
        console.log('⏳ Connection still in progress or UI not updated');
      }
    } else {
      console.log('⚠️  Join Studio button not found');
    }
    
    // Step 6: Test invite link
    console.log('📝 Step 6: Testing invite functionality...');
    const inviteInput = page.locator('input[readonly]').first()
    const copyButton = page.locator('button:has(svg.lucide-copy)')
    
    if (await inviteInput.isVisible()) {
      const inviteLink = await inviteInput.inputValue()
      console.log(`📋 Invite link: ${inviteLink}`);
      
      if (await copyButton.isVisible()) {
        await copyButton.click()
        console.log('✅ Copied invite link');
      }
    }
    
    // Step 7: Test broadcast start (if connected)
    const goLiveButton = page.locator('button:has-text("Go Live")')
    if (await goLiveButton.isVisible()) {
      console.log('📝 Step 7: Testing broadcast start...');
      await goLiveButton.click()
      
      await page.waitForTimeout(5000)
      await page.screenshot({ path: 'test-results/studio-05-live.png', fullPage: true });
      
      const liveIndicator = page.locator('text="LIVE"')
      const endStreamButton = page.locator('button:has-text("End Stream")')
      
      if (await liveIndicator.isVisible()) {
        console.log('✅ Broadcast started successfully');
        
        // Test viewer experience in new tab
        const viewerPage = await context.newPage()
        await viewerPage.goto(`${BASE_URL}/stream/${streamId}`)
        await viewerPage.waitForTimeout(3000)
        await viewerPage.screenshot({ path: 'test-results/studio-06-viewer.png', fullPage: true });
        
        const muxPlayer = viewerPage.locator('mux-player')
        const streamLive = viewerPage.locator('text="Stream is Live"')
        
        console.log(`👀 Viewer page - Mux player: ${await muxPlayer.isVisible()}, Live indicator: ${await streamLive.isVisible()}`);
        
        await viewerPage.close()
        
        // End stream
        if (await endStreamButton.isVisible()) {
          await endStreamButton.click()
          console.log('🛑 Ended stream');
        }
      } else {
        console.log('❌ Broadcast failed to start');
        const broadcastError = await page.locator('[role="alert"]').textContent()
        console.log(`Error: ${broadcastError}`);
      }
    }
    
    // Final summary
    console.log('\n📊 Studio Test Summary:');
    console.log('- Studio page accessible: ' + isStudioPage);
    console.log('- LiveKit connection: ' + (await goLiveButton.isVisible() ? '✅' : '❌'));
    console.log('- Invite system: ' + (await inviteInput.isVisible() ? '✅' : '❌'));
    console.log('- Broadcast capability: ' + (await page.locator('text="LIVE"').isVisible() ? '✅' : '❌'));
    
    // Log common issues
    console.log('\n⚠️  Common Issues to Check:');
    console.log('1. LiveKit API keys in .env.local');
    console.log('2. NEXT_PUBLIC_LIVEKIT_URL is set correctly');
    console.log('3. Stream type is set to support multi-host');
    console.log('4. User has permission to access studio');
    
    await page.screenshot({ path: 'test-results/studio-07-final.png', fullPage: true });
  });
});