import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test('capture all studio console logs', async ({ page, context }) => {
  await context.grantPermissions(['camera', 'microphone']);
  
  console.log('📝 Capturing All Studio Console Logs\n');
  
  // Capture ALL console messages with full detail
  page.on('console', async msg => {
    const type = msg.type();
    const text = msg.text();
    
    // Get args for more detail
    const args = msg.args();
    let fullText = text;
    
    // Try to get more detail from args
    if (args.length > 0) {
      try {
        const values = await Promise.all(args.map(arg => arg.jsonValue().catch(() => 'undefined')));
        if (values.length > 0 && values[0] !== text) {
          fullText = `${text} | Args: ${JSON.stringify(values)}`;
        }
      } catch (e) {
        // Ignore
      }
    }
    
    console.log(`[${type.toUpperCase()}] ${fullText}`);
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
  
  console.log('\n=== JOINING STUDIO ===\n');
  
  // Click Join Studio
  const joinButton = page.locator('button:has-text("Join Studio")');
  await joinButton.click();
  
  // Wait longer to capture all logs
  await page.waitForTimeout(10000);
  
  // Check connection state
  const connectionInfo = await page.evaluate(() => {
    const anyWindow = window as any;
    return {
      hasRoom: !!anyWindow.__livekitRoom,
      roomState: anyWindow.__livekitRoom?.state || 'no room',
      localParticipant: anyWindow.__livekitRoom?.localParticipant?.identity || 'no participant',
      videoElements: document.querySelectorAll('video').length,
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(Boolean)
    };
  });
  
  console.log('\n=== CONNECTION INFO ===');
  console.log(JSON.stringify(connectionInfo, null, 2));
  
  // Check if error toast appeared
  const errorToast = page.locator('[role="alert"]');
  if (await errorToast.isVisible()) {
    const errorText = await errorToast.textContent();
    console.log(`\n=== ERROR TOAST ===\n${errorText}`);
  }
  
  await page.screenshot({ path: 'test-results/studio-console-capture.png', fullPage: true });
  
  console.log('\n✅ Console capture complete');
});