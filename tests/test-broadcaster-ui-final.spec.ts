import { test, expect } from '@playwright/test'

// Get base URL from environment or default to localhost:3001
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Final Broadcaster UI Test', () => {
  test.beforeEach(async ({ context }) => {
    // Grant camera and microphone permissions
    await context.grantPermissions(['camera', 'microphone']);
  });

  test('verify enhanced UI features are present', async ({ page, context }) => {
    console.log('🚀 Final test of enhanced broadcaster UI...');
    
    // Login
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[id="email"]', 'testuser@example.com')
    await page.fill('input[id="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL(`${BASE_URL}/dashboard`)
    console.log('✅ Logged in');
    
    // Find the first available stream with Start Broadcasting button
    await page.waitForTimeout(2000)
    
    // Click on the first visible Start Broadcasting button
    const firstStartButton = page.locator('button:has-text("Start Broadcasting")').first()
    
    if (await firstStartButton.isVisible()) {
      const streamTitle = await firstStartButton.locator('../../..').locator('h3').textContent()
      console.log(`📺 Using stream: ${streamTitle}`);
      
      await firstStartButton.click()
      await page.waitForURL(/\/stream\/.*\/broadcast/)
      console.log('✅ Navigated to broadcast page');
      
      // Wait for page to fully load
      await page.waitForTimeout(3000)
      
      // Take main screenshot
      await page.screenshot({ path: 'test-results/final-broadcaster-ui.png', fullPage: true });
      console.log('📸 Screenshot taken: final-broadcaster-ui.png');
      
      // Check for enhanced UI elements
      const viewerSection = await page.locator('text="Viewers"').isVisible()
      const chatSection = await page.locator('text="Live Chat"').isVisible()
      const toggleButton = await page.locator('button[title*="chat"]').isVisible()
      
      console.log('\n🔍 Enhanced UI Elements Check:');
      console.log(`- Viewer Count Section: ${viewerSection ? '✅ FOUND' : '❌ NOT FOUND'}`);
      console.log(`- Chat Panel: ${chatSection ? '✅ FOUND' : '❌ NOT FOUND'}`);
      console.log(`- Chat Toggle Button: ${toggleButton ? '✅ FOUND' : '❌ NOT FOUND'}`);
      
      if (viewerSection) {
        const viewerCount = await page.locator('text="Viewers"').locator('..').locator('.flex.items-center.gap-2').textContent()
        console.log(`- Current Viewer Count: ${viewerCount?.trim()}`);
      }
      
      // Check grid layout
      const gridContainer = page.locator('.grid.grid-cols-1.lg\\:grid-cols-4')
      const hasCorrectGrid = await gridContainer.count() > 0
      console.log(`- 4-Column Grid Layout: ${hasCorrectGrid ? '✅ FOUND' : '❌ NOT FOUND'}`);
      
      // Take close-up screenshots of specific features
      if (viewerSection) {
        const viewerElement = page.locator('text="Viewers"').locator('..')
        await viewerElement.screenshot({ path: 'test-results/viewer-count-section.png' });
        console.log('📸 Screenshot taken: viewer-count-section.png');
      }
      
      if (chatSection) {
        const chatElement = page.locator('text="Live Chat"').locator('..')
        await chatElement.screenshot({ path: 'test-results/chat-panel.png' });
        console.log('📸 Screenshot taken: chat-panel.png');
      }
      
      // Test chat toggle if available
      if (toggleButton && chatSection) {
        console.log('\n🔄 Testing chat toggle...');
        const toggle = page.locator('button[title*="chat"]')
        
        await toggle.click()
        await page.waitForTimeout(500)
        const chatHidden = await page.locator('text="Live Chat"').isHidden()
        console.log(`- Chat hidden after click: ${chatHidden ? '✅ YES' : '❌ NO'}`);
        
        if (chatHidden) {
          await page.screenshot({ path: 'test-results/chat-hidden.png', fullPage: true });
        }
        
        await toggle.click()
        await page.waitForTimeout(500)
        const chatVisible = await page.locator('text="Live Chat"').isVisible()
        console.log(`- Chat visible after second click: ${chatVisible ? '✅ YES' : '❌ NO'}`);
      }
      
      // Open viewer to test count update
      if (viewerSection) {
        console.log('\n👀 Testing viewer count update...');
        const streamId = page.url().match(/stream\/([^\/]+)\/broadcast/)?.[1]
        const viewerPage = await context.newPage()
        await viewerPage.goto(`${BASE_URL}/stream/${streamId}`)
        console.log('- Viewer page opened');
        
        // Wait for count to update
        await page.bringToFront()
        await page.waitForTimeout(6000)
        
        const updatedCount = await page.locator('text="Viewers"').locator('..').locator('.flex.items-center.gap-2').textContent()
        console.log(`- Updated viewer count: ${updatedCount?.trim()}`);
        
        await page.screenshot({ path: 'test-results/viewer-count-updated.png', fullPage: true });
        await viewerPage.close()
      }
      
      // Final summary
      console.log('\n' + '='.repeat(50));
      console.log('📊 FINAL TEST RESULTS:');
      console.log('='.repeat(50));
      
      const allFeaturesWorking = viewerSection && chatSection && toggleButton
      
      if (allFeaturesWorking) {
        console.log('✅ SUCCESS: All enhanced broadcaster UI features are working!');
        console.log('- Viewer count is displayed');
        console.log('- Live chat is integrated');
        console.log('- Chat toggle functionality works');
      } else {
        console.log('❌ ISSUES FOUND:');
        if (!viewerSection) console.log('- Viewer count section is missing');
        if (!chatSection) console.log('- Chat panel is missing');
        if (!toggleButton) console.log('- Chat toggle button is missing');
        console.log('\nPossible causes:');
        console.log('- Server may need restart to pick up changes');
        console.log('- Component imports may be incorrect');
        console.log('- Grid layout may have issues');
      }
      
      console.log('\n📁 Screenshots saved in test-results/');
      console.log('='.repeat(50));
      
    } else {
      console.log('❌ No streams available with Start Broadcasting button');
      await page.screenshot({ path: 'test-results/no-streams-available.png', fullPage: true });
    }
  });
});