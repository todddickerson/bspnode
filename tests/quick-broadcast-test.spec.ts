import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Quick Broadcast Test', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['camera', 'microphone']);
  });

  test('Navigate to broadcast page and take screenshots', async ({ page, context }) => {
    test.setTimeout(60000);
    
    console.log('1. Logging in...');
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[id="email"]', 'testuser@example.com')
    await page.fill('input[id="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL(`${BASE_URL}/dashboard`)
    console.log('✅ Login successful');
    
    // Take screenshot of dashboard
    await page.screenshot({ path: 'test-results/quick-01-dashboard.png', fullPage: true });
    
    // Try to find stream cards more generically
    console.log('2. Looking for streams...');
    const streamLinks = page.locator('a[href*="/stream/"][href*="/broadcast"]')
    const linkCount = await streamLinks.count()
    console.log(`Found ${linkCount} broadcast links`);
    
    if (linkCount > 0) {
      // Click the first broadcast link
      await streamLinks.first().click()
      await page.waitForLoadState('networkidle')
      
      const url = page.url()
      console.log(`Navigated to: ${url}`);
      
      // Wait a bit for everything to load
      await page.waitForTimeout(5000)
      
      // Take screenshots of key elements
      console.log('3. Taking screenshots...');
      await page.screenshot({ path: 'test-results/quick-02-broadcast-page.png', fullPage: true });
      
      // Look for viewer count
      const viewerElements = page.locator('text=/Viewer/i')
      if (await viewerElements.count() > 0) {
        console.log('✅ Found viewer-related elements');
        const viewerSection = viewerElements.first().locator('..')
        await viewerSection.screenshot({ path: 'test-results/quick-03-viewer-section.png' });
      }
      
      // Look for chat
      const chatElements = page.locator('text=/Chat/i')
      if (await chatElements.count() > 0) {
        console.log('✅ Found chat-related elements');
        const chatSection = chatElements.first().locator('../..')
        await chatSection.screenshot({ path: 'test-results/quick-04-chat-section.png' });
      }
      
      // Look for message circle icon (chat toggle)
      const messageCircleButtons = page.locator('button svg.lucide-message-circle').locator('..')
      if (await messageCircleButtons.count() > 0) {
        console.log('✅ Found chat toggle button');
        await messageCircleButtons.first().screenshot({ path: 'test-results/quick-05-chat-toggle.png' });
        
        // Test toggle
        await messageCircleButtons.first().click()
        await page.waitForTimeout(1000)
        await page.screenshot({ path: 'test-results/quick-06-after-toggle.png', fullPage: true });
      }
      
      // Open viewer page
      const streamId = url.match(/stream\/([^\/]+)\/broadcast/)?.[1]
      if (streamId) {
        console.log(`4. Opening viewer page for stream ${streamId}...`);
        const viewerPage = await context.newPage()
        await viewerPage.goto(`${BASE_URL}/stream/${streamId}`)
        await viewerPage.waitForLoadState('networkidle')
        await viewerPage.screenshot({ path: 'test-results/quick-07-viewer-page.png', fullPage: true });
        
        // Wait for viewer count to update
        await page.waitForTimeout(6000)
        await page.screenshot({ path: 'test-results/quick-08-after-viewer-joins.png', fullPage: true });
        
        await viewerPage.close()
      }
    } else {
      console.log('No broadcast links found, creating a new stream...');
      await page.click('text="Create Stream"')
      await page.fill('input[name="title"]', 'Quick Test Stream')
      await page.getByText('Browser Streaming').click()
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/stream\/.*\/broadcast/)
      await page.waitForTimeout(5000)
      await page.screenshot({ path: 'test-results/quick-new-stream-broadcast.png', fullPage: true });
    }
    
    console.log('✅ Test completed');
  });
});