import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Studio Functional Test', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['camera', 'microphone']);
  });

  test('verify all studio features actually work', async ({ page, context }) => {
    console.log('🧪 Testing studio functionality thoroughly...\n');
    
    // Navigate directly to a known studio page
    const testStreamId = 'cmdqcaxe80009srbl6bo5cs2o';
    await page.goto(`${BASE_URL}/stream/${testStreamId}/studio`)
    await page.waitForTimeout(3000)
    
    console.log('📍 TEST 1: Page Load');
    const isStudioPage = await page.url().includes('/studio')
    console.log(`- Studio page loaded: ${isStudioPage ? '✅' : '❌'}`);
    await page.screenshot({ path: 'test-results/studio-test-01-initial.png', fullPage: true });
    
    // Test 2: Join Studio Button
    console.log('\n📍 TEST 2: Join Studio Button');
    const joinButton = page.locator('button:has-text("Join Studio")')
    const joinButtonVisible = await joinButton.isVisible()
    console.log(`- Join button visible: ${joinButtonVisible ? '✅' : '❌'}`);
    
    if (joinButtonVisible) {
      // Monitor for errors
      let connectionError = null;
      page.on('response', response => {
        if (response.status() >= 400) {
          console.log(`❌ API Error: ${response.url()} - Status: ${response.status()}`);
        }
      });
      
      // Click join button
      await joinButton.click()
      console.log('- Clicked Join Studio button');
      
      // Wait for connection attempt
      await page.waitForTimeout(5000)
      
      // Check connection state
      const connectingIndicator = page.locator('text="Connecting"')
      const goLiveButton = page.locator('button:has-text("Go Live")')
      const errorToast = page.locator('[role="alert"]')
      
      if (await errorToast.isVisible()) {
        const errorText = await errorToast.textContent()
        console.log(`- Connection result: ❌ Error - ${errorText}`);
        connectionError = errorText;
      } else if (await goLiveButton.isVisible()) {
        console.log('- Connection result: ✅ Connected successfully');
      } else if (await connectingIndicator.isVisible()) {
        console.log('- Connection result: ⏳ Still connecting after 5 seconds');
      } else {
        console.log('- Connection result: ❓ Unknown state');
      }
      
      await page.screenshot({ path: 'test-results/studio-test-02-after-join.png', fullPage: true });
      
      // If there's a connection error, diagnose it
      if (connectionError) {
        console.log('\n🔍 Diagnosing connection error:');
        if (connectionError.includes('token')) {
          console.log('- Issue: LiveKit token generation failed');
          console.log('- Fix: Check LIVEKIT_API_KEY and LIVEKIT_API_SECRET in .env.local');
        } else if (connectionError.includes('WebSocket') || connectionError.includes('connect')) {
          console.log('- Issue: Cannot connect to LiveKit server');
          console.log('- Fix: Check NEXT_PUBLIC_LIVEKIT_URL in .env.local');
        } else if (connectionError.includes('room')) {
          console.log('- Issue: LiveKit room creation failed');
          console.log('- Fix: Check LiveKit service status and quotas');
        }
      }
    }
    
    // Test 3: Video/Audio Controls
    console.log('\n📍 TEST 3: Video/Audio Controls');
    const videoButton = page.locator('button').filter({ has: page.locator('svg.lucide-video, svg.lucide-video-off') }).first()
    const audioButton = page.locator('button').filter({ has: page.locator('svg.lucide-mic, svg.lucide-mic-off') }).first()
    
    const videoButtonEnabled = await videoButton.isEnabled()
    const audioButtonEnabled = await audioButton.isEnabled()
    
    console.log(`- Video button enabled: ${videoButtonEnabled ? '✅' : '❌'}`);
    console.log(`- Audio button enabled: ${audioButtonEnabled ? '✅' : '❌'}`);
    
    if (videoButtonEnabled) {
      await videoButton.click()
      await page.waitForTimeout(500)
      console.log('- Toggled video');
      
      // Check if button state changed
      const videoOffIcon = await page.locator('svg.lucide-video-off').isVisible()
      console.log(`- Video toggled off: ${videoOffIcon ? '✅' : '❌'}`);
    }
    
    if (audioButtonEnabled) {
      await audioButton.click()
      await page.waitForTimeout(500)
      console.log('- Toggled audio');
      
      // Check if button state changed
      const audioOffIcon = await page.locator('svg.lucide-mic-off').isVisible()
      console.log(`- Audio toggled off: ${audioOffIcon ? '✅' : '❌'}`);
    }
    
    // Test 4: Invite System
    console.log('\n📍 TEST 4: Invite System');
    const inviteInput = page.locator('input[readonly][value*="localhost"]')
    const copyButton = inviteInput.locator('..').locator('button').first()
    
    const inviteInputVisible = await inviteInput.isVisible()
    console.log(`- Invite link input visible: ${inviteInputVisible ? '✅' : '❌'}`);
    
    if (inviteInputVisible) {
      const inviteLink = await inviteInput.inputValue()
      console.log(`- Invite link: ${inviteLink}`);
      
      // Test copy button
      if (await copyButton.isVisible()) {
        await copyButton.click()
        await page.waitForTimeout(1000)
        
        // Check for copy confirmation
        const copyToast = page.locator('text="Copied"')
        const copiedSuccess = await copyToast.isVisible()
        console.log(`- Copy button works: ${copiedSuccess ? '✅' : '❌'}`);
      }
      
      // Test invite link in new tab
      console.log('- Testing invite link...');
      const invitePage = await context.newPage()
      await invitePage.goto(inviteLink)
      await invitePage.waitForTimeout(3000)
      
      const joinPageTitle = await invitePage.locator('h1, h2').first().textContent()
      console.log(`- Invite link loads: ${joinPageTitle ? '✅' : '❌'} (${joinPageTitle})`);
      
      await invitePage.screenshot({ path: 'test-results/studio-test-03-invite-page.png' });
      await invitePage.close()
    }
    
    // Test 5: Go Live Functionality (if connected)
    console.log('\n📍 TEST 5: Broadcast Functionality');
    const goLiveButton = page.locator('button:has-text("Go Live")')
    const goLiveVisible = await goLiveButton.isVisible()
    
    if (goLiveVisible) {
      console.log('- Go Live button available ✅');
      await goLiveButton.click()
      console.log('- Clicked Go Live');
      
      await page.waitForTimeout(5000)
      
      // Check if broadcasting started
      const liveIndicator = page.locator('text="LIVE"')
      const endStreamButton = page.locator('button:has-text("End Stream")')
      const broadcastError = page.locator('[role="alert"]')
      
      if (await broadcastError.isVisible()) {
        const errorText = await broadcastError.textContent()
        console.log(`- Broadcast result: ❌ Error - ${errorText}`);
        
        // Diagnose broadcast error
        if (errorText.includes('egress')) {
          console.log('  - Issue: LiveKit egress failed');
          console.log('  - Fix: Check LiveKit egress limits and Mux integration');
        }
      } else if (await liveIndicator.isVisible() && await endStreamButton.isVisible()) {
        console.log('- Broadcast result: ✅ Live!');
        
        // Test viewer experience
        const viewerPage = await context.newPage()
        await viewerPage.goto(`${BASE_URL}/stream/${testStreamId}`)
        await viewerPage.waitForTimeout(5000)
        
        const muxPlayer = viewerPage.locator('mux-player')
        const viewerMuxVisible = await muxPlayer.isVisible()
        console.log(`- Viewer can see stream: ${viewerMuxVisible ? '✅' : '❌'}`);
        
        await viewerPage.screenshot({ path: 'test-results/studio-test-04-viewer.png' });
        await viewerPage.close()
        
        // End stream
        await endStreamButton.click()
        console.log('- Ended stream');
      } else {
        console.log('- Broadcast result: ❌ Failed to start');
      }
    } else {
      console.log('- Go Live button: ❌ Not available (not connected)');
    }
    
    await page.screenshot({ path: 'test-results/studio-test-05-final.png', fullPage: true });
    
    // Test 6: Leave Studio
    console.log('\n📍 TEST 6: Leave Studio');
    const leaveButton = page.locator('button:has-text("Leave Studio")')
    const leaveButtonVisible = await leaveButton.isVisible()
    console.log(`- Leave button visible: ${leaveButtonVisible ? '✅' : '❌'}`);
    
    if (leaveButtonVisible) {
      await leaveButton.click()
      await page.waitForTimeout(2000)
      const leftStudio = !page.url().includes('/studio')
      console.log(`- Left studio successfully: ${leftStudio ? '✅' : '❌'}`);
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 STUDIO FUNCTIONALITY TEST SUMMARY:');
    console.log('='.repeat(50));
    
    const features = {
      'Page loads': isStudioPage,
      'Join Studio button': joinButtonVisible,
      'Video controls': videoButtonEnabled,
      'Audio controls': audioButtonEnabled,
      'Invite system': inviteInputVisible,
      'Copy invite link': false, // Set based on test
      'Go Live capability': goLiveVisible,
      'Leave Studio': leaveButtonVisible
    };
    
    const working = Object.values(features).filter(v => v).length;
    const total = Object.keys(features).length;
    
    console.log(`\nWorking features: ${working}/${total}`);
    Object.entries(features).forEach(([feature, works]) => {
      console.log(`- ${feature}: ${works ? '✅' : '❌'}`);
    });
    
    if (working < total) {
      console.log('\n⚠️  Required fixes:');
      if (!goLiveVisible) {
        console.log('1. LiveKit connection not working - check credentials');
      }
      if (!videoButtonEnabled || !audioButtonEnabled) {
        console.log('2. Media controls disabled - check camera/mic permissions');
      }
    } else {
      console.log('\n✅ All studio features are working correctly!');
    }
  });
});