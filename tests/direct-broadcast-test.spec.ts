import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Direct Broadcast Test', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['camera', 'microphone']);
  });

  test('Test broadcaster UI features directly', async ({ page, context }) => {
    test.setTimeout(120000);
    
    console.log('=== Direct Broadcast UI Test ===\n');
    
    // Step 1: Login
    console.log('1. Logging in...');
    await page.goto(`${BASE_URL}/login`)
    await page.screenshot({ path: 'test-results/01-login.png', fullPage: true });
    
    await page.fill('input[id="email"]', 'testuser@example.com')
    await page.fill('input[id="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 })
    console.log('✅ Login successful');
    
    // Step 2: Navigate directly to a broadcast page
    // Using a known stream ID or creating a new one
    console.log('\n2. Navigating to broadcast page...');
    
    // First, let's create a new stream via API to ensure we have a valid one
    const createResponse = await page.request.post(`${BASE_URL}/api/streams`, {
      data: {
        title: 'UI Test Stream',
        description: 'Testing broadcaster UI features',
        streamType: 'BROWSER'
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (createResponse.ok()) {
      const stream = await createResponse.json();
      const streamId = stream.id;
      console.log(`✅ Created new stream: ${streamId}`);
      
      // Navigate to broadcast page
      await page.goto(`${BASE_URL}/stream/${streamId}/broadcast`)
      await page.waitForLoadState('networkidle')
      console.log('✅ Navigated to broadcast page');
      
      // Wait for page to fully load
      await page.waitForTimeout(5000)
      
      // Step 3: Take screenshot of broadcaster interface
      console.log('\n3. Analyzing broadcaster interface...');
      await page.screenshot({ path: 'test-results/02-broadcaster-interface.png', fullPage: true });
      
      // Check viewer count section
      console.log('\n📊 Checking viewer count section...');
      const viewerText = await page.locator('text="Viewers"').count();
      if (viewerText > 0) {
        console.log('✅ Viewer count section found');
        const viewerSection = page.locator('text="Viewers"').locator('..')
        await viewerSection.screenshot({ path: 'test-results/03-viewer-count.png' });
        
        // Get actual viewer count
        const viewerCountSpan = page.locator('span.font-medium.text-lg')
        const count = await viewerCountSpan.textContent()
        console.log(`   Current viewer count: ${count}`);
      } else {
        console.log('❌ Viewer count section not found');
      }
      
      // Check chat panel
      console.log('\n💬 Checking chat panel...');
      const chatText = await page.locator('text="Live Chat"').count();
      if (chatText > 0) {
        console.log('✅ Chat panel found');
        const chatSection = page.locator('text="Live Chat"').locator('../..')
        await chatSection.screenshot({ path: 'test-results/04-chat-panel.png' });
      } else {
        console.log('❌ Chat panel not found');
      }
      
      // Check chat toggle button
      console.log('\n🔘 Checking chat toggle...');
      const chatToggle = page.locator('button').filter({ has: page.locator('svg.lucide-message-circle') })
      const toggleCount = await chatToggle.count()
      if (toggleCount > 0) {
        console.log('✅ Chat toggle button found');
        
        // Test toggle functionality
        await chatToggle.first().click()
        await page.waitForTimeout(1000)
        const chatHidden = await page.locator('text="Live Chat"').isHidden()
        console.log(`   Chat hidden after toggle: ${chatHidden}`);
        await page.screenshot({ path: 'test-results/05-chat-hidden.png', fullPage: true });
        
        // Toggle back
        await chatToggle.first().click()
        await page.waitForTimeout(1000)
        const chatVisible = await page.locator('text="Live Chat"').isVisible()
        console.log(`   Chat visible after second toggle: ${chatVisible}`);
        await page.screenshot({ path: 'test-results/06-chat-visible.png', fullPage: true });
      } else {
        console.log('❌ Chat toggle button not found');
      }
      
      // Step 4: Handle camera permissions
      console.log('\n📷 Checking camera status...');
      const cameraError = await page.locator('text="Camera Access Required"').count()
      if (cameraError > 0) {
        console.log('⚠️  Camera permission needed');
        const tryAgainButton = page.locator('button:has-text("Try Again")')
        if (await tryAgainButton.count() > 0) {
          await tryAgainButton.click()
          await page.waitForTimeout(3000)
        }
      }
      
      // Step 5: Try to start broadcasting
      console.log('\n🔴 Attempting to start broadcast...');
      const goLiveButton = page.locator('button:has-text("Go Live")')
      const goLiveCount = await goLiveButton.count()
      
      if (goLiveCount > 0 && await goLiveButton.isEnabled()) {
        await goLiveButton.click()
        console.log('   Clicked Go Live button');
        await page.waitForTimeout(5000)
        
        const liveIndicator = await page.locator('text="LIVE"').count()
        if (liveIndicator > 0) {
          console.log('✅ Broadcasting started successfully');
          await page.screenshot({ path: 'test-results/07-broadcasting.png', fullPage: true });
        }
      } else {
        console.log('⚠️  Go Live button not available or disabled');
      }
      
      // Step 6: Open viewer page
      console.log('\n👀 Opening viewer page...');
      const viewerPage = await context.newPage()
      await viewerPage.goto(`${BASE_URL}/stream/${streamId}`)
      await viewerPage.waitForLoadState('networkidle')
      await viewerPage.screenshot({ path: 'test-results/08-viewer-page.png', fullPage: true });
      
      // Step 7: Wait and check viewer count update
      console.log('\n⏳ Waiting for viewer count update...');
      await page.waitForTimeout(6000)
      
      const updatedCount = await page.locator('span.font-medium.text-lg').textContent()
      console.log(`📊 Updated viewer count: ${updatedCount}`);
      await page.screenshot({ path: 'test-results/09-viewer-count-updated.png', fullPage: true });
      
      // Step 8: Test chat from viewer
      console.log('\n💬 Testing chat from viewer...');
      const chatInput = viewerPage.locator('input[placeholder="Type a message..."]')
      if (await chatInput.count() > 0) {
        await chatInput.fill('Hello from viewer! Testing chat.')
        await viewerPage.locator('button[type="submit"]').click()
        console.log('   Message sent from viewer');
        
        // Check if message appears in broadcaster
        await page.waitForTimeout(2000)
        const messageVisible = await page.locator('text="Hello from viewer! Testing chat."').count()
        if (messageVisible > 0) {
          console.log('✅ Message received in broadcaster chat');
          await page.screenshot({ path: 'test-results/10-chat-message-received.png', fullPage: true });
        } else {
          console.log('❌ Message not visible in broadcaster chat');
        }
      }
      
      // Final summary
      console.log('\n=== Test Summary ===');
      console.log('Viewer count section:', viewerText > 0 ? '✅' : '❌');
      console.log('Chat panel:', chatText > 0 ? '✅' : '❌');
      console.log('Chat toggle:', toggleCount > 0 ? '✅' : '❌');
      
      // Clean up
      await viewerPage.close()
      
      // End broadcast if live
      const endButton = page.locator('button:has-text("End Broadcast")')
      if (await endButton.count() > 0) {
        await endButton.click()
        console.log('\n🛑 Broadcast ended');
      }
      
    } else {
      console.log('❌ Failed to create stream');
      const errorText = await createResponse.text();
      console.log('Error:', errorText);
    }
    
    console.log('\n=== Test Completed ===');
  });
});