import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test('capture studio connection error', async ({ page, context }) => {
  await context.grantPermissions(['camera', 'microphone']);
  
  console.log('🔍 Capturing Studio Connection Error\n');
  
  // Capture ALL console messages
  const allLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    allLogs.push({ type, text, location: msg.location() });
    
    // Print errors and warnings immediately
    if (type === 'error' || type === 'warning') {
      console.log(`[${type.toUpperCase()}] ${text}`);
    }
  });
  
  // Capture network errors
  page.on('requestfailed', request => {
    console.log(`[NETWORK FAILED] ${request.method()} ${request.url()}: ${request.failure()?.errorText}`);
  });
  
  // Capture page errors
  page.on('pageerror', error => {
    console.log(`[PAGE ERROR] ${error.message}`);
  });
  
  // Login
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[id="email"]', 'testuser@example.com');
  await page.fill('input[id="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  
  // Navigate to studio
  const enterStudioButton = page.locator('button:has-text("Enter Studio")').first();
  await enterStudioButton.click();
  await page.waitForLoadState('networkidle');
  
  console.log('📍 On studio page, attempting to join...\n');
  
  // Clear logs before join attempt
  allLogs.length = 0;
  
  // Click Join Studio
  const joinButton = page.locator('button:has-text("Join Studio")');
  await joinButton.click();
  
  // Wait for error toast or connection
  await Promise.race([
    page.waitForSelector('[role="alert"]', { timeout: 10000 }),
    page.waitForSelector('button:has-text("Go Live")', { timeout: 10000 }),
    page.waitForTimeout(10000)
  ]);
  
  // Capture error toast if present
  const errorToast = page.locator('[role="alert"]');
  if (await errorToast.isVisible()) {
    const errorText = await errorToast.textContent();
    console.log(`\n🚨 ERROR TOAST: ${errorText}\n`);
  }
  
  // Check API responses
  console.log('\n📡 Checking API responses...');
  
  // Check /start endpoint
  const startResponse = await page.evaluate(async (streamId) => {
    try {
      const response = await fetch(`/api/streams/${streamId}/start`, { method: 'POST' });
      const data = await response.json();
      return { status: response.status, ok: response.ok, data };
    } catch (e) {
      return { error: e.message };
    }
  }, page.url().split('/stream/')[1].split('/')[0]);
  
  console.log('Start API:', JSON.stringify(startResponse, null, 2));
  
  // Check /token endpoint
  const tokenResponse = await page.evaluate(async (streamId) => {
    try {
      const response = await fetch(`/api/streams/${streamId}/token`, { method: 'POST' });
      const data = await response.json();
      return { status: response.status, ok: response.ok, data };
    } catch (e) {
      return { error: e.message };
    }
  }, page.url().split('/stream/')[1].split('/')[0]);
  
  console.log('\nToken API:', JSON.stringify(tokenResponse, null, 2));
  
  // Print all console logs
  console.log('\n📝 All Console Logs:');
  allLogs.forEach((log, i) => {
    console.log(`${i + 1}. [${log.type}] ${log.text}`);
    if (log.location.url) {
      console.log(`   at ${log.location.url}:${log.location.lineNumber}`);
    }
  });
  
  // Check LiveKit environment variables
  console.log('\n🔧 Checking LiveKit configuration...');
  const envCheck = await page.evaluate(() => {
    return {
      hasLiveKitUrl: !!(window as any).NEXT_PUBLIC_LIVEKIT_URL || !!process.env.NEXT_PUBLIC_LIVEKIT_URL,
      liveKitUrl: (window as any).NEXT_PUBLIC_LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL || 'NOT SET'
    };
  });
  console.log('LiveKit URL configured:', envCheck);
  
  // Take final screenshot
  await page.screenshot({ path: 'test-results/studio-error-state.png', fullPage: true });
  
  console.log('\n✅ Error capture complete');
});