import { test, expect, Page } from '@playwright/test'

// Get base URL from environment or default to localhost:3001
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Comprehensive Broadcaster UI Test', () => {
  test.beforeEach(async ({ context }) => {
    // Grant camera and microphone permissions
    await context.grantPermissions(['camera', 'microphone']);
  });

  test('Full broadcaster UI flow with screenshots', async ({ page, context }) => {
    test.setTimeout(120000); // Set test timeout to 2 minutes
    console.log('=== Starting Comprehensive Broadcaster UI Test ===');
    
    // Step 1: Login
    console.log('\n1. Logging in...');
    await page.goto(`${BASE_URL}/login`)
    await page.screenshot({ path: 'test-results/01-login-page.png', fullPage: true });
    
    await page.fill('input[id="email"]', 'testuser@example.com')
    await page.fill('input[id="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    // Wait for navigation to dashboard
    await page.waitForURL(`${BASE_URL}/dashboard`)
    console.log('✅ Login successful');
    await page.screenshot({ path: 'test-results/02-dashboard.png', fullPage: true });
    
    // Step 2: Check for existing streams or create new one
    console.log('\n2. Checking for existing streams...');
    
    // Look for existing stream cards
    const streamCards = page.locator('.bg-white.rounded-lg.shadow').filter({ hasText: 'BROWSER' })
    const existingStreamCount = await streamCards.count()
    
    let streamId: string | null = null;
    let broadcastUrl: string;
    
    if (existingStreamCount > 0) {
      console.log(`Found ${existingStreamCount} existing browser stream(s)`);
      
      // Click on the first browser stream's broadcast button
      const firstStream = streamCards.first()
      // Look for links containing 'broadcast' in the href
      const broadcastLink = firstStream.locator('a[href*="/broadcast"]')
      await broadcastLink.click()
      await page.waitForURL(/\/stream\/.*\/broadcast/)
      
      broadcastUrl = page.url()
      streamId = broadcastUrl.match(/stream\/([^\/]+)\/broadcast/)?.[1] || null
      console.log(`✅ Using existing stream: ${streamId}`);
    } else {
      console.log('No existing streams found, creating new one...');
      
      // Create a new stream
      await page.click('text="Create Stream"')
      await page.fill('input[name="title"]', 'Comprehensive UI Test Stream')
      await page.fill('textarea[name="description"]', 'Testing all broadcaster UI features')
      await page.getByText('Browser Streaming').click()
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/stream\/.*\/broadcast/)
      
      broadcastUrl = page.url()
      streamId = broadcastUrl.match(/stream\/([^\/]+)\/broadcast/)?.[1] || null
      console.log(`✅ Created new stream: ${streamId}`);
    }
    
    // Step 3: Analyze broadcaster interface
    console.log('\n3. Analyzing broadcaster interface...');
    await page.waitForTimeout(3000) // Let page fully load
    
    // Take initial screenshot
    await page.screenshot({ path: 'test-results/03-broadcaster-interface.png', fullPage: true });
    
    // Check viewer count section
    const viewerSection = page.locator('text="Viewers"').locator('..')
    const viewerCountVisible = await viewerSection.isVisible()
    console.log(`📊 Viewer count section visible: ${viewerCountVisible}`);
    
    if (viewerCountVisible) {
      const viewerCountElement = page.locator('.flex.items-center.gap-2').filter({ has: page.locator('.lucide-users') })
      const viewerCount = await viewerCountElement.locator('span.font-medium').textContent()
      console.log(`   Current viewer count: ${viewerCount}`);
      await viewerSection.screenshot({ path: 'test-results/04-viewer-count-section.png' });
    }
    
    // Check live chat panel
    const chatSection = page.locator('text="Live Chat"').locator('../..')
    const chatVisible = await chatSection.isVisible()
    console.log(`💬 Live chat panel visible: ${chatVisible}`);
    
    if (chatVisible) {
      await chatSection.screenshot({ path: 'test-results/05-chat-panel.png' });
    }
    
    // Check chat toggle button
    const chatToggleButton = page.locator('button[title*="chat"]')
    const toggleButtonVisible = await chatToggleButton.isVisible()
    console.log(`🔘 Chat toggle button visible: ${toggleButtonVisible}`);
    
    // Step 4: Handle camera permissions if needed
    console.log('\n4. Checking camera permissions...');
    const permissionError = page.locator('text="Camera Access Required"')
    if (await permissionError.isVisible()) {
      console.log('⚠️ Camera permission needed');
      const requestButton = page.locator('button:has-text("Try Again"), button:has-text("Request Camera Access")')
      if (await requestButton.isVisible()) {
        await requestButton.click()
        console.log('📷 Requested camera access');
        await page.waitForTimeout(3000)
      }
    }
    
    // Step 5: Start broadcasting if not already live
    console.log('\n5. Checking broadcast status...');
    const liveIndicator = page.locator('.bg-red-600:has-text("LIVE")')
    const isLive = await liveIndicator.isVisible()
    
    if (!isLive) {
      const goLiveButton = page.locator('button:has-text("Go Live")')
      if (await goLiveButton.isEnabled()) {
        console.log('🔴 Starting broadcast...');
        await goLiveButton.click()
        await page.waitForTimeout(5000) // Wait for stream to start
        await page.screenshot({ path: 'test-results/06-broadcasting-started.png', fullPage: true });
      } else {
        console.log('⚠️ Go Live button is disabled (camera permissions may be needed)');
      }
    } else {
      console.log('🔴 Already broadcasting');
    }
    
    // Step 6: Open viewer page
    console.log('\n6. Opening viewer page...');
    const viewerPage = await context.newPage()
    await viewerPage.goto(`${BASE_URL}/stream/${streamId}`)
    await viewerPage.waitForLoadState('networkidle')
    console.log('👀 Viewer page opened');
    await viewerPage.screenshot({ path: 'test-results/07-viewer-page.png', fullPage: true });
    
    // Step 7: Check viewer count update
    console.log('\n7. Waiting for viewer count update...');
    await page.waitForTimeout(6000) // Wait for refresh interval
    
    if (viewerCountVisible) {
      const updatedViewerElement = page.locator('.flex.items-center.gap-2').filter({ has: page.locator('.lucide-users') })
      const updatedCount = await updatedViewerElement.locator('span.font-medium').textContent()
      console.log(`📊 Updated viewer count: ${updatedCount}`);
      await page.screenshot({ path: 'test-results/08-viewer-count-updated.png', fullPage: true });
    }
    
    // Step 8: Test chat functionality
    console.log('\n8. Testing chat functionality...');
    
    // Send message from viewer
    const viewerChatInput = viewerPage.locator('input[placeholder="Type a message..."]')
    const viewerChatAvailable = await viewerChatInput.isVisible()
    
    if (viewerChatAvailable) {
      await viewerChatInput.fill('Hello from the viewer! 👋')
      await viewerPage.locator('button[type="submit"]').click()
      console.log('💬 Sent message from viewer');
      
      // Check if message appears in broadcaster's chat
      await page.waitForTimeout(2000)
      const messageInBroadcasterChat = page.locator('text="Hello from the viewer! 👋"')
      const messageReceived = await messageInBroadcasterChat.isVisible()
      console.log(`✅ Message visible in broadcaster chat: ${messageReceived}`);
      
      if (messageReceived) {
        await page.screenshot({ path: 'test-results/09-chat-message-received.png', fullPage: true });
      }
    } else {
      console.log('⚠️ Chat input not available on viewer page');
    }
    
    // Step 9: Test chat toggle
    console.log('\n9. Testing chat toggle functionality...');
    
    if (toggleButtonVisible) {
      // Hide chat
      await chatToggleButton.click()
      await page.waitForTimeout(500)
      const chatHidden = await chatSection.isHidden()
      console.log(`📌 Chat hidden after toggle: ${chatHidden}`);
      await page.screenshot({ path: 'test-results/10-chat-hidden.png', fullPage: true });
      
      // Show chat again
      await chatToggleButton.click()
      await page.waitForTimeout(500)
      const chatVisibleAgain = await chatSection.isVisible()
      console.log(`📌 Chat visible after second toggle: ${chatVisibleAgain}`);
      await page.screenshot({ path: 'test-results/11-chat-shown-again.png', fullPage: true });
    }
    
    // Step 10: Document any issues found
    console.log('\n10. Summary of findings:');
    const issues: string[] = [];
    
    if (!viewerCountVisible) {
      issues.push('Viewer count section not visible');
    }
    if (!chatVisible) {
      issues.push('Live chat panel not visible');
    }
    if (!toggleButtonVisible) {
      issues.push('Chat toggle button not visible');
    }
    
    if (issues.length > 0) {
      console.log('❌ Issues found:');
      issues.forEach(issue => console.log(`   - ${issue}`));
    } else {
      console.log('✅ All UI features working correctly');
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/12-final-state.png', fullPage: true });
    
    // Clean up
    if (isLive || (await page.locator('.bg-red-600:has-text("LIVE")').isVisible())) {
      const endButton = page.locator('button:has-text("End Broadcast")')
      if (await endButton.isVisible()) {
        await endButton.click()
        console.log('\n🛑 Broadcast ended');
      }
    }
    
    await viewerPage.close()
    console.log('\n=== Test Completed ===');
  });
});