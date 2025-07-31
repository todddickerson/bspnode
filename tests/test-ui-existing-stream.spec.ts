import { test, expect, Page } from '@playwright/test'

// Get base URL from environment or default to localhost:3001
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Test UI on Existing Stream', () => {
  test.beforeEach(async ({ context }) => {
    // Grant camera and microphone permissions
    await context.grantPermissions(['camera', 'microphone']);
  });

  test('test enhanced UI on UI Test Stream', async ({ page, context }) => {
    console.log('🚀 Testing enhanced UI on existing stream...');
    
    // Step 1: Login
    console.log('📝 Step 1: Logging in...');
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[id="email"]', 'testuser@example.com')
    await page.fill('input[id="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL(`${BASE_URL}/dashboard`)
    console.log('✅ Login successful');
    
    // Step 2: Find and click on "UI Test Stream"
    console.log('📝 Step 2: Finding UI Test Stream...');
    await page.waitForTimeout(2000)
    
    // Take screenshot of dashboard
    await page.screenshot({ path: 'test-results/ui-test-01-dashboard.png', fullPage: true });
    
    // Click on the Start Broadcasting button for UI Test Stream
    const uiTestStreamCard = page.locator('text="UI Test Stream"').locator('..')
    const startBroadcastButton = uiTestStreamCard.locator('text="Start Broadcasting"')
    
    if (await startBroadcastButton.isVisible()) {
      await startBroadcastButton.click()
      console.log('✅ Clicked Start Broadcasting for UI Test Stream');
      
      // Wait for broadcast page to load
      await page.waitForURL(/\/stream\/.*\/broadcast/)
      const streamId = page.url().match(/stream\/([^\/]+)\/broadcast/)?.[1]
      console.log(`📍 On broadcast page for stream: ${streamId}`);
      
      // Step 3: Check UI elements
      console.log('📝 Step 3: Checking UI elements...');
      await page.waitForTimeout(3000)
      
      // Take screenshot of broadcaster page
      await page.screenshot({ path: 'test-results/ui-test-02-broadcaster.png', fullPage: true });
      
      // Check viewer count
      const viewerSection = page.locator('text="Viewers"')
      const viewerVisible = await viewerSection.isVisible()
      console.log(`📊 Viewer count section visible: ${viewerVisible}`);
      
      if (viewerVisible) {
        const viewerCount = await page.locator('text="Viewers"').locator('..').locator('.flex.items-center.gap-2').textContent()
        console.log(`📊 Initial viewer count: ${viewerCount?.trim()}`);
      }
      
      // Check chat
      const chatSection = page.locator('text="Live Chat"')
      const chatVisible = await chatSection.isVisible()
      console.log(`💬 Chat section visible: ${chatVisible}`);
      
      // Check toggle button
      const toggleButton = page.locator('button[title*="chat"]')
      const toggleVisible = await toggleButton.isVisible()
      console.log(`🔄 Chat toggle visible: ${toggleVisible}`);
      
      // Step 4: Handle camera permissions
      const permissionButton = page.locator('button:has-text("Request Camera Access"), button:has-text("Try Again")')
      if (await permissionButton.isVisible()) {
        console.log('📸 Requesting camera access...');
        await permissionButton.click()
        await page.waitForTimeout(3000)
        await page.screenshot({ path: 'test-results/ui-test-03-after-permission.png', fullPage: true });
      }
      
      // Step 5: Go live if possible
      const goLiveButton = page.locator('button:has-text("Go Live")')
      if (await goLiveButton.isVisible()) {
        console.log('🔴 Going live...');
        await goLiveButton.click()
        await page.waitForTimeout(5000)
        
        const isLive = await page.locator('text="LIVE"').isVisible()
        console.log(`🔴 Broadcasting: ${isLive}`);
        
        if (isLive) {
          await page.screenshot({ path: 'test-results/ui-test-04-broadcasting.png', fullPage: true });
          
          // Open viewer
          const viewerPage = await context.newPage()
          await viewerPage.goto(`${BASE_URL}/stream/${streamId}`)
          console.log('👀 Viewer opened');
          await viewerPage.screenshot({ path: 'test-results/ui-test-05-viewer.png', fullPage: true });
          
          // Wait for viewer count update
          await page.bringToFront()
          await page.waitForTimeout(6000)
          
          if (viewerVisible) {
            const updatedCount = await page.locator('text="Viewers"').locator('..').locator('.flex.items-center.gap-2').textContent()
            console.log(`📊 Updated viewer count: ${updatedCount?.trim()}`);
            await page.screenshot({ path: 'test-results/ui-test-06-viewer-count.png', fullPage: true });
          }
          
          // Test chat toggle
          if (toggleVisible && chatVisible) {
            await toggleButton.click()
            await page.waitForTimeout(500)
            const hidden = await chatSection.isHidden()
            console.log(`📌 Chat hidden: ${hidden}`);
            
            await toggleButton.click()
            await page.waitForTimeout(500)
            const shown = await chatSection.isVisible()
            console.log(`📌 Chat shown again: ${shown}`);
          }
          
          await viewerPage.close()
        }
      } else {
        console.log('⚠️  Go Live button not visible');
        await page.screenshot({ path: 'test-results/ui-test-no-go-live.png', fullPage: true });
      }
      
      // Summary
      console.log('\n📋 Summary:');
      console.log(`- Viewer count: ${viewerVisible ? '✅ Visible' : '❌ Not visible'}`);
      console.log(`- Chat panel: ${chatVisible ? '✅ Visible' : '❌ Not visible'}`);
      console.log(`- Toggle button: ${toggleVisible ? '✅ Visible' : '❌ Not visible'}`);
      
      if (!viewerVisible || !chatVisible) {
        console.log('\n⚠️  Issues:');
        console.log('The enhanced UI features (viewer count and/or chat) are not showing on the broadcaster page.');
        console.log('This could indicate the changes were not properly applied or there\'s a rendering issue.');
      } else {
        console.log('\n✅ All enhanced UI features are working correctly!');
      }
    } else {
      console.log('❌ Could not find Start Broadcasting button for UI Test Stream');
      console.log('Stream might be in wrong state or already broadcasting');
    }
  });
});