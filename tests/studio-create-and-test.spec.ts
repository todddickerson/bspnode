import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test('create stream and test studio', async ({ page, context }) => {
  await context.grantPermissions(['camera', 'microphone']);
  
  console.log('🎬 Create Stream and Test Studio\n');
  
  // Step 1: Login
  console.log('1️⃣ Logging in...');
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[id="email"]', 'testuser@example.com')
  await page.fill('input[id="password"]', 'password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 10000 })
  console.log('✅ Login successful');
  
  // Step 2: Create a new stream
  console.log('\n2️⃣ Creating new stream...');
  
  // Wait for dashboard to load
  await page.waitForTimeout(2000);
  
  // Find create button - try different selectors
  let createButton = page.locator('button:has-text("Create New Stream")').first();
  if (!await createButton.isVisible()) {
    createButton = page.locator('button:has-text("Create Stream")').first();
  }
  if (!await createButton.isVisible()) {
    createButton = page.locator('a:has-text("Create")').first();
  }
  
  if (await createButton.isVisible()) {
    await createButton.click();
    console.log('✅ Clicked create button');
    
    // Wait for form
    await page.waitForTimeout(2000);
    
    // Fill form - wait for each field
    await page.waitForSelector('input[name="title"]', { timeout: 5000 });
    await page.fill('input[name="title"]', 'Studio Test ' + Date.now());
    
    const descField = page.locator('textarea[name="description"]');
    if (await descField.isVisible()) {
      await descField.fill('Testing studio functionality');
    }
    
    // Select browser streaming
    const browserOption = page.locator('label:has-text("Browser")').first();
    if (await browserOption.isVisible()) {
      await browserOption.click();
      console.log('✅ Selected browser streaming');
    }
    
    // Submit form
    const submitButton = page.locator('button[type="submit"]:has-text("Create")').first();
    if (!await submitButton.isVisible()) {
      await page.locator('button[type="submit"]').first().click();
    } else {
      await submitButton.click();
    }
    
    console.log('⏳ Waiting for stream creation...');
    await page.waitForTimeout(3000);
    
    // Get stream ID from URL
    const currentUrl = page.url();
    const streamId = currentUrl.match(/stream\/([^\/]+)/)?.[1];
    
    if (streamId) {
      console.log(`✅ Stream created with ID: ${streamId}`);
      
      // Step 3: Navigate to studio
      console.log('\n3️⃣ Navigating to studio...');
      await page.goto(`${BASE_URL}/stream/${streamId}/studio`);
      await page.waitForTimeout(3000);
      
      // Check if on studio page
      if (page.url().includes('/studio')) {
        console.log('✅ On studio page');
        await page.screenshot({ path: 'test-results/studio-created-01.png', fullPage: true });
        
        // Test studio functionality
        console.log('\n4️⃣ Testing studio features...');
        
        const joinButton = page.locator('button:has-text("Join Studio")');
        const inviteLink = page.locator('input[readonly][value*="join"]');
        const controls = page.locator('text="Controls"');
        
        console.log(`- Join button: ${await joinButton.isVisible() ? '✅' : '❌'}`);
        console.log(`- Invite link: ${await inviteLink.isVisible() ? '✅' : '❌'}`);
        console.log(`- Controls: ${await controls.isVisible() ? '✅' : '❌'}`);
        
        if (await joinButton.isVisible()) {
          console.log('\n5️⃣ Testing LiveKit connection...');
          
          // Monitor errors
          const errors = [];
          page.on('response', resp => {
            if (resp.url().includes('/api/') && !resp.ok()) {
              errors.push(`${resp.url()}: ${resp.status()}`);
            }
          });
          
          await joinButton.click();
          console.log('⏳ Waiting for connection...');
          await page.waitForTimeout(10000);
          
          const goLive = page.locator('button:has-text("Go Live")');
          const errorToast = page.locator('[role="alert"]');
          
          if (await goLive.isVisible()) {
            console.log('✅ Connected to LiveKit successfully!');
            
            // Test broadcast
            await goLive.click();
            await page.waitForTimeout(5000);
            
            const liveStatus = page.locator('text="LIVE"');
            console.log(`- Broadcasting: ${await liveStatus.isVisible() ? '✅ LIVE!' : '❌'}`);
          } else if (await errorToast.isVisible()) {
            const errorText = await errorToast.textContent();
            console.log(`❌ Connection failed: ${errorText}`);
            
            if (errors.length > 0) {
              console.log('\nAPI Errors:');
              errors.forEach(e => console.log(`  - ${e}`));
            }
          } else {
            console.log('❓ Unknown state');
          }
          
          await page.screenshot({ path: 'test-results/studio-created-02-final.png', fullPage: true });
        }
      } else {
        console.log(`❌ Not on studio page. Current URL: ${page.url()}`);
      }
    } else {
      console.log('❌ Failed to get stream ID');
    }
  } else {
    console.log('❌ Create button not found');
    await page.screenshot({ path: 'test-results/studio-create-error.png', fullPage: true });
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('TEST COMPLETE');
  console.log('='.repeat(50));
});