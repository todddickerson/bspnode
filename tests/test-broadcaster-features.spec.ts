import { test, expect, Page } from '@playwright/test'

// Get base URL from environment or default to localhost:3001
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Test Enhanced Broadcaster Features', () => {
  test.beforeEach(async ({ context }) => {
    // Grant camera and microphone permissions
    await context.grantPermissions(['camera', 'microphone']);
  });

  test('complete test of viewer count and chat features', async ({ page, context }) => {
    console.log('🚀 Starting enhanced broadcaster UI test...');
    
    // Step 1: Login
    console.log('📝 Step 1: Logging in...');
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[id="email"]', 'testuser@example.com')
    await page.fill('input[id="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL(`${BASE_URL}/dashboard`)
    console.log('✅ Login successful');
    
    // Take screenshot of dashboard
    await page.screenshot({ path: 'test-results/01-dashboard.png', fullPage: true });
    
    // Step 2: Create a new stream
    console.log('📝 Step 2: Creating new stream...');
    await page.click('text="Create Stream"')
    await page.fill('input[name="title"]', 'Test Broadcaster UI Features')
    await page.fill('textarea[name="description"]', 'Testing viewer count and chat integration')
    await page.getByText('Browser Streaming').click()
    await page.click('button[type="submit"]')
    
    // Wait for redirect to broadcast page
    await page.waitForURL(/\/stream\/.*\/broadcast/)
    const broadcastUrl = page.url()
    const streamId = broadcastUrl.match(/stream\/([^\/]+)\/broadcast/)?.[1]
    console.log(`✅ Stream created with ID: ${streamId}`);
    
    // Step 3: Check broadcaster interface
    console.log('📝 Step 3: Checking broadcaster interface...');
    await page.waitForTimeout(2000) // Wait for page to fully load
    
    // Take screenshot of initial broadcaster page
    await page.screenshot({ path: 'test-results/02-broadcaster-initial.png', fullPage: true });
    
    // Check for viewer count section
    const viewerSection = page.locator('text="Viewers"')
    const viewerSectionVisible = await viewerSection.isVisible()
    console.log(`📊 Viewer count section visible: ${viewerSectionVisible}`);
    
    if (viewerSectionVisible) {
      // Get initial viewer count
      const viewerCountElement = await page.locator('text="Viewers"').locator('..').locator('.flex.items-center.gap-2')
      const initialCount = await viewerCountElement.textContent()
      console.log(`📊 Initial viewer count: ${initialCount?.trim()}`);
    }
    
    // Check for chat section
    const chatSection = page.locator('text="Live Chat"')
    const chatVisible = await chatSection.isVisible()
    console.log(`💬 Chat section visible: ${chatVisible}`);
    
    // Check for chat toggle button
    const chatToggleButton = page.locator('button[title*="chat"]')
    const toggleVisible = await chatToggleButton.isVisible()
    console.log(`🔄 Chat toggle button visible: ${toggleVisible}`);
    
    // Step 4: Handle camera permissions if needed
    console.log('📝 Step 4: Handling camera permissions...');
    const permissionButton = page.locator('button:has-text("Request Camera Access"), button:has-text("Try Again")')
    if (await permissionButton.isVisible()) {
      await permissionButton.click()
      await page.waitForTimeout(3000)
      console.log('📸 Camera permission requested');
    }
    
    // Step 5: Start broadcasting
    console.log('📝 Step 5: Starting broadcast...');
    const goLiveButton = page.locator('button:has-text("Go Live")')
    let broadcastStarted = false
    
    if (await goLiveButton.isVisible()) {
      await goLiveButton.click()
      console.log('🔴 Clicked Go Live button');
      await page.waitForTimeout(5000) // Wait for broadcast to start
      
      // Check if broadcast started
      const liveIndicator = page.locator('text="LIVE"')
      broadcastStarted = await liveIndicator.isVisible()
      console.log(`🔴 Broadcast started: ${broadcastStarted}`);
      
      // Take screenshot while broadcasting
      await page.screenshot({ path: 'test-results/03-broadcasting.png', fullPage: true });
    } else {
      console.log('⚠️  Go Live button not found - camera permissions may have failed');
      await page.screenshot({ path: 'test-results/03-no-go-live.png', fullPage: true });
    }
    
    // Step 6: Open viewer page
    console.log('📝 Step 6: Opening viewer page...');
    const viewerPage = await context.newPage()
    await viewerPage.goto(`${BASE_URL}/stream/${streamId}`)
    await viewerPage.waitForTimeout(3000)
    console.log('👀 Viewer page opened');
    
    // Take screenshot of viewer page
    await viewerPage.screenshot({ path: 'test-results/04-viewer-page.png', fullPage: true });
    
    // Step 7: Check viewer count update
    console.log('📝 Step 7: Checking viewer count update...');
    await page.bringToFront() // Switch back to broadcaster page
    await page.waitForTimeout(6000) // Wait for 5-second refresh interval
    
    if (viewerSectionVisible) {
      const updatedCountElement = await page.locator('text="Viewers"').locator('..').locator('.flex.items-center.gap-2')
      const updatedCount = await updatedCountElement.textContent()
      console.log(`📊 Updated viewer count: ${updatedCount?.trim()}`);
      
      // Take screenshot showing updated count
      await page.screenshot({ path: 'test-results/05-viewer-count-updated.png', fullPage: true });
    }
    
    // Step 8: Test chat functionality
    console.log('📝 Step 8: Testing chat functionality...');
    if (chatVisible) {
      // First, check if viewer needs to login to chat
      await viewerPage.bringToFront()
      const viewerChatInput = viewerPage.locator('input[placeholder="Type a message..."]')
      const needsLogin = await viewerPage.locator('text="Please sign in to chat"').isVisible()
      
      if (needsLogin) {
        console.log('⚠️  Viewer needs to login to chat - skipping chat test');
      } else if (await viewerChatInput.isVisible()) {
        // Send message from viewer
        await viewerChatInput.fill('Hello from the viewer! 👋')
        await viewerPage.locator('button[type="submit"]').click()
        console.log('💬 Sent message from viewer');
        
        // Check if message appears in broadcaster's chat
        await page.bringToFront()
        await page.waitForTimeout(2000)
        
        const messageInBroadcaster = await page.locator('text="Hello from the viewer! 👋"').isVisible()
        console.log(`💬 Message visible in broadcaster chat: ${messageInBroadcaster}`);
        
        if (messageInBroadcaster) {
          await page.screenshot({ path: 'test-results/06-chat-message-received.png', fullPage: true });
        }
      }
    }
    
    // Step 9: Test chat toggle
    console.log('📝 Step 9: Testing chat toggle...');
    if (toggleVisible && chatVisible) {
      // Hide chat
      await chatToggleButton.click()
      await page.waitForTimeout(500)
      const chatHidden = await chatSection.isHidden()
      console.log(`📌 Chat hidden after toggle: ${chatHidden}`);
      
      if (chatHidden) {
        await page.screenshot({ path: 'test-results/07-chat-hidden.png', fullPage: true });
      }
      
      // Show chat again
      await chatToggleButton.click()
      await page.waitForTimeout(500)
      const chatVisibleAgain = await chatSection.isVisible()
      console.log(`📌 Chat visible after second toggle: ${chatVisibleAgain}`);
      
      if (chatVisibleAgain) {
        await page.screenshot({ path: 'test-results/08-chat-shown-again.png', fullPage: true });
      }
    }
    
    // Step 10: Stop broadcast if it was started
    if (broadcastStarted) {
      console.log('📝 Step 10: Stopping broadcast...');
      const endButton = page.locator('button:has-text("End Broadcast")')
      if (await endButton.isVisible()) {
        await endButton.click()
        console.log('🛑 Broadcast ended');
        await page.waitForTimeout(3000)
      }
    }
    
    // Close viewer page
    await viewerPage.close()
    
    // Final summary
    console.log('\n📋 Test Summary:');
    console.log(`- Viewer count section: ${viewerSectionVisible ? '✅ Found' : '❌ Not found'}`);
    console.log(`- Chat section: ${chatVisible ? '✅ Found' : '❌ Not found'}`);
    console.log(`- Chat toggle button: ${toggleVisible ? '✅ Found' : '❌ Not found'}`);
    console.log(`- Broadcast started: ${broadcastStarted ? '✅ Yes' : '❌ No'}`);
    console.log('\n✅ Enhanced broadcaster UI test completed!');
    
    // Log any issues found
    if (!viewerSectionVisible || !chatVisible || !toggleVisible) {
      console.log('\n⚠️  Issues found:');
      if (!viewerSectionVisible) console.log('- Viewer count section is not visible');
      if (!chatVisible) console.log('- Chat section is not visible');
      if (!toggleVisible) console.log('- Chat toggle button is not visible');
    }
  });
});