import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Studio Authenticated Test', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['camera', 'microphone']);
  });

  test('test studio with proper authentication', async ({ page, context }) => {
    console.log('🔐 Testing studio with authentication...\n');
    
    // Step 1: Login first
    console.log('📍 STEP 1: Login');
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[id="email"]', 'testuser@example.com')
    await page.fill('input[id="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    // Wait for dashboard or handle redirect
    await page.waitForTimeout(3000)
    const afterLogin = page.url()
    console.log(`- After login URL: ${afterLogin}`);
    console.log(`- Login successful: ${!afterLogin.includes('/login') ? '✅' : '❌'}`);
    
    // Step 2: Create a new stream with multi-host option
    console.log('\n📍 STEP 2: Create Multi-Host Stream');
    
    // Go to dashboard if not already there
    if (!afterLogin.includes('/dashboard')) {
      await page.goto(`${BASE_URL}/dashboard`)
      await page.waitForTimeout(2000)
    }
    
    // Try to find existing stream with studio access or create new one
    const studioStream = page.locator('text="Studio"').first()
    let streamId;
    
    if (await studioStream.isVisible()) {
      console.log('- Found existing studio stream');
      await studioStream.click()
      await page.waitForTimeout(2000)
      streamId = page.url().match(/stream\/([^\/]+)/)?.[1]
    } else {
      // Create new stream
      const createButton = page.locator('button:has-text("Create New Stream"), button:has-text("Create Stream")')
      if (await createButton.isVisible()) {
        await createButton.click()
        await page.fill('input[name="title"]', 'Studio Test Stream')
        await page.fill('textarea[name="description"]', 'Testing studio functionality')
        
        // Look for stream type selection
        const streamTypeOptions = page.locator('label:has-text("Multi-Host"), label:has-text("Collaborative")')
        if (await streamTypeOptions.isVisible()) {
          await streamTypeOptions.click()
        } else {
          // Fall back to browser streaming
          await page.locator('label:has-text("Browser")').click()
        }
        
        await page.click('button[type="submit"]')
        await page.waitForTimeout(3000)
        streamId = page.url().match(/stream\/([^\/]+)/)?.[1]
        console.log(`- Created new stream: ${streamId}`);
      }
    }
    
    // Step 3: Navigate to studio
    console.log('\n📍 STEP 3: Navigate to Studio');
    if (streamId && !page.url().includes('/studio')) {
      await page.goto(`${BASE_URL}/stream/${streamId}/studio`)
      await page.waitForTimeout(3000)
    }
    
    const isStudioPage = page.url().includes('/studio')
    console.log(`- On studio page: ${isStudioPage ? '✅' : '❌'}`);
    await page.screenshot({ path: 'test-results/studio-auth-01-studio-page.png', fullPage: true });
    
    if (!isStudioPage) {
      console.log('❌ Could not access studio page');
      return;
    }
    
    // Step 4: Test Join Studio
    console.log('\n📍 STEP 4: Join Studio');
    const joinButton = page.locator('button:has-text("Join Studio")')
    
    if (await joinButton.isVisible()) {
      // Monitor network requests
      const apiResponses = [];
      page.on('response', response => {
        if (response.url().includes('/api/')) {
          apiResponses.push({
            url: response.url(),
            status: response.status(),
            ok: response.ok()
          });
        }
      });
      
      await joinButton.click()
      console.log('- Clicked Join Studio');
      
      // Wait for connection
      await page.waitForTimeout(7000)
      
      // Check results
      const goLiveButton = page.locator('button:has-text("Go Live")')
      const errorToast = page.locator('[role="alert"]')
      const connectingSpinner = page.locator('text="Connecting"')
      
      console.log('\nAPI Calls:');
      apiResponses.forEach(r => {
        console.log(`- ${r.url.split('/api/')[1]}: ${r.status} ${r.ok ? '✅' : '❌'}`);
      });
      
      if (await errorToast.isVisible()) {
        const errorText = await errorToast.textContent()
        console.log(`\n- Connection result: ❌ Error - "${errorText}"`);
        
        // Check specific API failures
        const tokenFailed = apiResponses.some(r => r.url.includes('/token') && !r.ok)
        const startFailed = apiResponses.some(r => r.url.includes('/start') && !r.ok)
        
        if (tokenFailed) {
          console.log('  - Token generation failed');
          console.log('  - Check: LIVEKIT_API_KEY and LIVEKIT_API_SECRET in .env.local');
        }
        if (startFailed) {
          console.log('  - Stream initialization failed');
          console.log('  - Check: User permissions and stream status');
        }
      } else if (await goLiveButton.isVisible()) {
        console.log('\n- Connection result: ✅ Connected successfully!');
        
        // Test controls
        const videoButton = page.locator('button').filter({ has: page.locator('svg.lucide-video') }).first()
        const audioButton = page.locator('button').filter({ has: page.locator('svg.lucide-mic') }).first()
        
        console.log(`- Video control enabled: ${await videoButton.isEnabled() ? '✅' : '❌'}`);
        console.log(`- Audio control enabled: ${await audioButton.isEnabled() ? '✅' : '❌'}`);
        
        // Test broadcast
        console.log('\n📍 STEP 5: Test Broadcast');
        await goLiveButton.click()
        await page.waitForTimeout(5000)
        
        const liveIndicator = page.locator('text="LIVE"')
        const isLive = await liveIndicator.isVisible()
        console.log(`- Broadcasting: ${isLive ? '✅ LIVE!' : '❌ Failed'}`);
        
        await page.screenshot({ path: 'test-results/studio-auth-02-broadcasting.png', fullPage: true });
        
        if (isLive) {
          // Check viewer
          const viewerPage = await context.newPage()
          await viewerPage.goto(`${BASE_URL}/stream/${streamId}`)
          await viewerPage.waitForTimeout(5000)
          
          const muxPlayer = viewerPage.locator('mux-player')
          console.log(`- Viewer can see stream: ${await muxPlayer.isVisible() ? '✅' : '❌'}`);
          
          await viewerPage.screenshot({ path: 'test-results/studio-auth-03-viewer.png', fullPage: true });
          await viewerPage.close()
        }
      } else if (await connectingSpinner.isVisible()) {
        console.log('\n- Connection result: ⏳ Still connecting after 7 seconds');
      } else {
        console.log('\n- Connection result: ❓ Unknown state');
      }
    } else {
      console.log('- Join Studio button not found');
    }
    
    await page.screenshot({ path: 'test-results/studio-auth-04-final.png', fullPage: true });
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 AUTHENTICATED STUDIO TEST SUMMARY');
    console.log('='.repeat(50));
    console.log('\nIf connection fails, check:');
    console.log('1. .env.local has valid LiveKit credentials:');
    console.log('   - LIVEKIT_API_KEY');
    console.log('   - LIVEKIT_API_SECRET');
    console.log('   - NEXT_PUBLIC_LIVEKIT_URL');
    console.log('2. Stream type supports multi-host (LIVEKIT or BROWSER)');
    console.log('3. User has permission to be a host');
    console.log('4. No existing egress sessions blocking new ones');
  });
});