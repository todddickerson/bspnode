import { test, expect } from '@playwright/test';

test.describe('Studio Video Debug', () => {
  test('should render video player in studio', async ({ page, context }) => {
    // Grant permissions
    await context.grantPermissions(['camera', 'microphone']);
    
    // Enable console logging
    page.on('console', msg => {
      console.log(`Browser console [${msg.type()}]:`, msg.text());
    });

    // First login
    await page.goto('http://localhost:3001/login');
    await page.fill('input[id="email"]', 'testuser@example.com');
    await page.fill('input[id="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3001/dashboard');
    
    // Create a stream
    await page.click('text="Create New Stream"');
    await page.fill('input[name="title"]', 'Test Video Debug Stream');
    await page.fill('textarea[name="description"]', 'Testing video rendering');
    
    // Try to find multi-host option
    const multiHostOption = page.locator('text="Multi-Host Streaming", text="Collaborative Streaming"');
    if (await multiHostOption.isVisible()) {
      await multiHostOption.click();
    } else {
      await page.getByText('Browser Streaming').click();
    }
    
    await page.click('button[type="submit"]');
    
    // Wait for redirect
    await page.waitForURL(/\/stream\/.*\/(studio|broadcast)/);
    
    const currentUrl = page.url();
    const streamId = currentUrl.match(/stream\/([^\/]+)/)?.[1];
    console.log('Stream ID:', streamId);
    
    // Navigate to studio if not already there
    if (!currentUrl.includes('/studio')) {
      await page.goto(`http://localhost:3001/stream/${streamId}/studio`);
    }
    
    // Wait for the page to load
    await page.waitForLoadState('domcontentloaded');
    
    // Check if video container exists
    const videoContainer = await page.locator('[data-testid="video-container"]');
    await expect(videoContainer).toBeVisible();
    
    // Check if video element exists
    const videoElement = await page.locator('video');
    const videoExists = await videoElement.count() > 0;
    console.log('Video element exists:', videoExists);
    
    if (videoExists) {
      // Get video attributes
      const videoSrc = await videoElement.getAttribute('src');
      const videoPoster = await videoElement.getAttribute('poster');
      console.log('Video src:', videoSrc);
      console.log('Video poster:', videoPoster);
      
      // Check if Video.js is initialized
      const hasVideoJsClass = await videoElement.evaluate(el => el.classList.contains('video-js'));
      console.log('Has video-js class:', hasVideoJsClass);
      
      // Check for Video.js player instance
      const playerExists = await page.evaluate(() => {
        return typeof window.videojs !== 'undefined' && window.videojs.players && Object.keys(window.videojs.players).length > 0;
      });
      console.log('Video.js player initialized:', playerExists);
    }
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'studio-video-debug.png', fullPage: true });
    
    // Wait a bit to see if video loads
    await page.waitForTimeout(5000);
    
    // Check final state
    const finalVideoCount = await page.locator('video').count();
    console.log('Final video element count:', finalVideoCount);
  });
});