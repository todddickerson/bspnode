import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test('studio video display test', async ({ page, context }) => {
  await context.grantPermissions(['camera', 'microphone']);
  
  console.log('🎥 Testing Studio Video Display\n');
  
  // Login
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[id="email"]', 'testuser@example.com');
  await page.fill('input[id="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  
  // Navigate to studio
  const enterStudioButton = page.locator('button:has-text("Enter Studio")').first();
  await enterStudioButton.click();
  await page.waitForLoadState('networkidle');
  
  // Take screenshot before joining
  await page.screenshot({ path: 'test-results/studio-before-join.png', fullPage: true });
  
  // Click Join Studio
  const joinButton = page.locator('button:has-text("Join Studio")');
  await joinButton.click();
  
  // Wait for connection
  await page.waitForTimeout(5000);
  
  // Take screenshot after joining
  await page.screenshot({ path: 'test-results/studio-after-join.png', fullPage: true });
  
  // Check if video element has content
  const videoState = await page.evaluate(() => {
    const video = document.querySelector('video') as HTMLVideoElement;
    if (!video) return null;
    
    return {
      srcObject: !!video.srcObject,
      readyState: video.readyState,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      currentTime: video.currentTime,
      paused: video.paused,
      muted: video.muted,
      // Check computed styles
      computedStyle: {
        display: getComputedStyle(video).display,
        visibility: getComputedStyle(video).visibility,
        width: getComputedStyle(video).width,
        height: getComputedStyle(video).height,
        opacity: getComputedStyle(video).opacity
      },
      // Check parent container
      parentStyle: video.parentElement ? {
        display: getComputedStyle(video.parentElement).display,
        visibility: getComputedStyle(video.parentElement).visibility,
        width: getComputedStyle(video.parentElement).width,
        height: getComputedStyle(video.parentElement).height
      } : null
    };
  });
  
  console.log('Video Element State:', JSON.stringify(videoState, null, 2));
  
  // Check if Go Live button is visible (indicates successful connection)
  const goLiveButton = page.locator('button:has-text("Go Live")');
  const isConnected = await goLiveButton.isVisible();
  console.log('\nConnection successful:', isConnected);
  
  // Check for any overlays
  const overlayText = await page.locator('.absolute.inset-0').textContent().catch(() => null);
  if (overlayText) {
    console.log('Overlay text found:', overlayText);
  }
  
  // Take final annotated screenshot
  await page.screenshot({ path: 'test-results/studio-final-state.png', fullPage: true });
  
  console.log('\n✅ Visual test complete - check test-results folder for screenshots');
});