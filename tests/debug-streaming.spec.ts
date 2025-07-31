import { test, expect, Page } from '@playwright/test'

// Get base URL from environment or default to localhost:3001
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Debug Streaming Flow', () => {
  test.beforeEach(async ({ context }) => {
    // Grant camera and microphone permissions
    await context.grantPermissions(['camera', 'microphone']);
  });

  test('debug and fix streaming flow', async ({ page, context }) => {
    console.log('Starting streaming debug test...');
    
    // Login
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[id="email"]', 'testuser@example.com')
    await page.fill('input[id="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL(`${BASE_URL}/dashboard`)
    console.log('✅ Login successful');

    // Navigate directly to the broadcast page
    const streamId = 'cmdq7j69g0006xfr79xqbd6zo';
    await page.goto(`${BASE_URL}/stream/${streamId}/broadcast`);
    await page.waitForTimeout(3000);
    
    // Take screenshot of broadcast page
    await page.screenshot({ path: 'test-results/debug-broadcast-page.png', fullPage: true });
    console.log('📸 Screenshot taken of broadcast page');

    // Check if camera permission is needed
    const permissionButton = page.locator('button:has-text("Request Camera Access"), button:has-text("Try Again")');
    if (await permissionButton.isVisible()) {
      console.log('🎥 Requesting camera permissions...');
      await permissionButton.click();
      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'test-results/debug-after-permission.png', fullPage: true });
    }

    // Check if Go Live button is available
    const goLiveButton = page.locator('button:has-text("Go Live")');
    if (await goLiveButton.isVisible()) {
      console.log('🔴 Starting broadcast...');
      await goLiveButton.click();
      
      // Wait for broadcast to start
      await page.waitForTimeout(10000);
      
      // Take screenshot of live state
      await page.screenshot({ path: 'test-results/debug-broadcasting.png', fullPage: true });
      
      // Check for live indicators
      const liveIndicator = page.locator('text="Live", text="LIVE", button:has-text("End Broadcast")');
      if (await liveIndicator.isVisible()) {
        console.log('✅ Broadcast started successfully!');
        
        // Open viewer page in new tab
        const viewerPage = await context.newPage();
        await viewerPage.goto(`${BASE_URL}/stream/${streamId}`);
        await viewerPage.waitForTimeout(10000);
        
        // Take screenshot of viewer page
        await viewerPage.screenshot({ path: 'test-results/debug-viewer-page.png', fullPage: true });
        
        // Check if Mux player is visible
        const muxPlayer = viewerPage.locator('mux-player');
        const streamContent = viewerPage.locator('text="Stream is Live", text="Waiting for Stream"');
        
        if (await muxPlayer.isVisible()) {
          console.log('✅ Mux player found on viewer page');
        } else if (await streamContent.isVisible()) {
          const contentText = await streamContent.textContent();
          console.log(`ℹ️ Viewer page shows: ${contentText}`);
        } else {
          console.log('❌ No stream content found on viewer page');
        }
        
        // Check stream API status
        const response = await page.request.get(`${BASE_URL}/api/streams/${streamId}`);
        const streamData = await response.json();
        console.log('📊 Stream status:', streamData.status);
        console.log('📊 Mux playback ID:', streamData.muxPlaybackId);
        console.log('📊 Egress ID:', streamData.egressId);
        console.log('📊 Egress status:', streamData.egressStatus);
        
        await viewerPage.close();
        
        // Stop broadcast
        const endButton = page.locator('button:has-text("End Broadcast"), button:has-text("Stop")');
        if (await endButton.isVisible()) {
          console.log('🛑 Stopping broadcast...');
          await endButton.click();
          await page.waitForTimeout(3000);
          await page.screenshot({ path: 'test-results/debug-broadcast-ended.png', fullPage: true });
        }
        
      } else {
        console.log('❌ Broadcast did not start - no live indicators found');
        await page.screenshot({ path: 'test-results/debug-broadcast-failed.png', fullPage: true });
      }
    } else {
      console.log('❌ Go Live button not found');
      await page.screenshot({ path: 'test-results/debug-no-go-live.png', fullPage: true });
    }
  });
});