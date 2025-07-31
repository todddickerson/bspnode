import { test, expect } from '@playwright/test'

// Get base URL from environment or default to localhost:3001
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Test Enhanced UI on Existing Stream', () => {
  test.beforeEach(async ({ context }) => {
    // Grant camera and microphone permissions
    await context.grantPermissions(['camera', 'microphone']);
  });

  test('test enhanced UI features', async ({ page, context }) => {
    console.log('Testing enhanced UI on existing stream...');
    
    // Use the stream ID from the user's request
    const streamId = 'cmdq8qpay0001srblm80m3r2m';
    
    // Go directly to the broadcast page
    await page.goto(`${BASE_URL}/stream/${streamId}/broadcast`)
    console.log('📍 Navigated to broadcast page');
    
    // Wait for page to load
    await page.waitForTimeout(3000)
    
    // Take screenshot of broadcaster interface
    await page.screenshot({ path: 'test-results/enhanced-ui-screenshot.png', fullPage: true });
    console.log('📸 Screenshot taken');
    
    // Check if viewer count is visible
    const viewerSection = page.locator('text="Viewers"')
    const viewerCountVisible = await viewerSection.isVisible()
    console.log(`✅ Viewer count section visible: ${viewerCountVisible}`);
    
    if (viewerCountVisible) {
      // Get the viewer count
      const viewerCountElement = await page.locator('text="Viewers"').locator('..').locator('.flex.items-center')
      const viewerCountText = await viewerCountElement.textContent()
      console.log(`📊 Current viewer count: ${viewerCountText}`);
    }
    
    // Check if chat section is visible
    const chatSection = page.locator('text="Live Chat"')
    const chatVisible = await chatSection.isVisible()
    console.log(`✅ Chat section visible: ${chatVisible}`);
    
    // Check chat toggle button
    const chatToggleButton = page.locator('button').filter({ has: page.locator('svg.lucide-message-circle') })
    const toggleVisible = await chatToggleButton.isVisible()
    console.log(`✅ Chat toggle button visible: ${toggleVisible}`);
    
    // Check if we're already broadcasting
    const liveIndicator = page.locator('text="LIVE"')
    const isLive = await liveIndicator.isVisible()
    console.log(`🔴 Currently broadcasting: ${isLive}`);
    
    // Open viewer page in another tab
    const viewerPage = await context.newPage()
    await viewerPage.goto(`${BASE_URL}/stream/${streamId}`)
    console.log('👀 Viewer page opened');
    
    // Take screenshot of viewer page
    await viewerPage.screenshot({ path: 'test-results/viewer-page-screenshot.png', fullPage: true });
    
    // Wait for viewer count to potentially update
    await page.waitForTimeout(6000)
    
    // Check viewer count again
    if (viewerCountVisible) {
      const updatedCount = await page.locator('text="Viewers"').locator('..').locator('.flex.items-center').textContent()
      console.log(`📊 Updated viewer count: ${updatedCount}`);
    }
    
    // Test chat toggle
    if (toggleVisible && chatVisible) {
      await chatToggleButton.click()
      await page.waitForTimeout(500)
      const chatHidden = await chatSection.isHidden()
      console.log(`📌 Chat hidden after toggle: ${chatHidden}`);
      
      await chatToggleButton.click()
      await page.waitForTimeout(500)  
      const chatVisibleAgain = await chatSection.isVisible()
      console.log(`📌 Chat visible after second toggle: ${chatVisibleAgain}`);
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/enhanced-ui-final-state.png', fullPage: true });
    
    await viewerPage.close()
    console.log('✅ Enhanced UI test completed');
  });
});