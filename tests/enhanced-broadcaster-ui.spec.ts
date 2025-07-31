import { test, expect, Page } from '@playwright/test'

// Get base URL from environment or default to localhost:3001
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Enhanced Broadcaster UI', () => {
  test.beforeEach(async ({ context }) => {
    // Grant camera and microphone permissions
    await context.grantPermissions(['camera', 'microphone']);
  });

  test('broadcaster can see viewer count and chat', async ({ page, context }) => {
    console.log('Starting enhanced broadcaster UI test...');
    
    // Login
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[id="email"]', 'testuser@example.com')
    await page.fill('input[id="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL(`${BASE_URL}/dashboard`)
    console.log('✅ Login successful');

    // Create a new stream for testing
    await page.click('text="Create Stream"')
    await page.fill('input[name="title"]', 'Test Enhanced UI Stream')
    await page.fill('textarea[name="description"]', 'Testing viewer count and chat features')
    await page.getByText('Browser Streaming').click()
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/stream\/.*\/broadcast/)
    
    const broadcastUrl = page.url()
    const streamId = broadcastUrl.match(/stream\/([^\/]+)\/broadcast/)?.[1]
    console.log('✅ Stream created:', streamId);

    // Wait for page to load
    await page.waitForTimeout(2000)
    
    // Take screenshot of initial state
    await page.screenshot({ path: 'test-results/enhanced-ui-initial.png', fullPage: true });
    
    // Check if viewer count is visible
    const viewerCountElement = page.locator('text="Viewers"').locator('..')
    await expect(viewerCountElement).toBeVisible()
    console.log('✅ Viewer count section visible');
    
    // Check initial viewer count (should be 0)
    const viewerCount = await page.locator('.flex.items-center.gap-2').filter({ hasText: /^\d+$/ }).textContent()
    console.log(`📊 Initial viewer count: ${viewerCount}`);
    
    // Check if chat toggle button is visible
    const chatToggleButton = page.locator('button[title*="chat"]')
    await expect(chatToggleButton).toBeVisible()
    console.log('✅ Chat toggle button visible');
    
    // Check if chat is visible by default
    const chatSection = page.locator('text="Live Chat"')
    await expect(chatSection).toBeVisible()
    console.log('✅ Chat section visible');
    
    // Request camera permissions if needed
    const permissionButton = page.locator('button:has-text("Request Camera Access"), button:has-text("Try Again")')
    if (await permissionButton.isVisible()) {
      await permissionButton.click()
      await page.waitForTimeout(3000)
    }
    
    // Start broadcasting
    const goLiveButton = page.locator('button:has-text("Go Live")')
    if (await goLiveButton.isVisible()) {
      await goLiveButton.click()
      console.log('🔴 Starting broadcast...')
      await page.waitForTimeout(5000)
      
      // Take screenshot while broadcasting
      await page.screenshot({ path: 'test-results/enhanced-ui-broadcasting.png', fullPage: true });
      
      // Open viewer page in new tab to simulate a viewer
      const viewerPage = await context.newPage()
      await viewerPage.goto(`${BASE_URL}/stream/${streamId}`)
      console.log('👀 Viewer page opened');
      
      // Wait for viewer count to update
      await page.waitForTimeout(6000) // Wait for 5-second refresh interval
      
      // Check updated viewer count
      const updatedViewerCount = await page.locator('.flex.items-center.gap-2').filter({ hasText: /^\d+$/ }).textContent()
      console.log(`📊 Updated viewer count: ${updatedViewerCount}`);
      
      // Test chat from viewer page
      const viewerChatInput = viewerPage.locator('input[placeholder="Type a message..."]')
      if (await viewerChatInput.isVisible()) {
        await viewerChatInput.fill('Hello from viewer!')
        await viewerPage.locator('button[type="submit"]').click()
        console.log('💬 Sent message from viewer');
        
        // Check if message appears in broadcaster's chat
        await page.waitForTimeout(2000)
        const broadcasterChat = page.locator('text="Hello from viewer!"')
        if (await broadcasterChat.isVisible()) {
          console.log('✅ Message received in broadcaster chat');
        }
      }
      
      // Toggle chat visibility
      await chatToggleButton.click()
      await page.waitForTimeout(500)
      const chatHidden = await chatSection.isHidden()
      console.log(`📌 Chat hidden after toggle: ${chatHidden}`);
      
      // Toggle back
      await chatToggleButton.click()
      await page.waitForTimeout(500)
      const chatVisible = await chatSection.isVisible()
      console.log(`📌 Chat visible after second toggle: ${chatVisible}`);
      
      // Take final screenshot
      await page.screenshot({ path: 'test-results/enhanced-ui-final.png', fullPage: true });
      
      // Clean up - stop broadcast
      const endButton = page.locator('button:has-text("End Broadcast")')
      if (await endButton.isVisible()) {
        await endButton.click()
        console.log('🛑 Broadcast ended');
      }
      
      await viewerPage.close()
    }
    
    console.log('✅ Enhanced broadcaster UI test completed');
  });
});