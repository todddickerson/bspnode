import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Studio Issues Check', () => {
  test('check studio page accessibility and errors', async ({ page, context }) => {
    // Grant permissions
    await context.grantPermissions(['camera', 'microphone']);
    
    console.log('🔍 Checking studio page issues...');
    
    // Try to access a studio page directly
    const testStreamId = 'cmdqcaxe80009srbl6bo5cs2o'; // Use a known stream ID
    
    console.log(`📍 Navigating to studio: ${BASE_URL}/stream/${testStreamId}/studio`);
    await page.goto(`${BASE_URL}/stream/${testStreamId}/studio`)
    
    // Wait for page to load
    await page.waitForTimeout(3000)
    
    // Take screenshot of current state
    await page.screenshot({ path: 'test-results/studio-direct-access.png', fullPage: true });
    
    // Check what page we ended up on
    const currentUrl = page.url()
    console.log(`📍 Current URL: ${currentUrl}`);
    
    // Check for common error messages
    const unauthorizedError = page.locator('text="Unauthorized", text="Access Denied"')
    const notFoundError = page.locator('text="Not Found", text="Stream Not Found"')
    const loginForm = page.locator('input[id="email"]')
    
    if (await unauthorizedError.isVisible()) {
      console.log('❌ Unauthorized error - need to be logged in or be a host');
    } else if (await notFoundError.isVisible()) {
      console.log('❌ Stream not found');
    } else if (await loginForm.isVisible()) {
      console.log('🔐 Redirected to login page');
    } else if (currentUrl.includes('/studio')) {
      console.log('✅ Studio page loaded');
      
      // Check for studio elements
      const joinButton = page.locator('button:has-text("Join Studio")')
      const errorToast = page.locator('[role="alert"]')
      const videoGrid = page.locator('.grid')
      
      console.log('Studio Elements:');
      console.log(`- Join button visible: ${await joinButton.isVisible()}`);
      console.log(`- Error visible: ${await errorToast.isVisible()}`);
      console.log(`- Video grid visible: ${await videoGrid.isVisible()}`);
      
      if (await errorToast.isVisible()) {
        const errorText = await errorToast.textContent()
        console.log(`⚠️  Error message: ${errorText}`);
      }
    }
    
    // Check console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`🔴 Console error: ${msg.text()}`);
      }
    });
    
    page.on('pageerror', error => {
      console.log(`🔴 Page error: ${error.message}`);
    });
    
    // Wait to catch any delayed errors
    await page.waitForTimeout(2000);
    
    console.log('\n📋 Studio Issues Summary:');
    console.log('1. Check if LiveKit credentials are set in .env.local');
    console.log('2. Verify stream exists and user has permission');
    console.log('3. Check browser console for WebSocket or API errors');
  });
});