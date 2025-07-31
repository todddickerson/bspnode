const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--allow-file-access-from-files'
    ]
  });
  
  const page = await browser.newPage();
  
  // Grant camera and microphone permissions
  const context = browser.defaultBrowserContext();
  await context.overridePermissions('http://localhost:3000', ['camera', 'microphone']);
  
  console.log('1. Testing homepage accessibility...');
  await page.goto('http://localhost:3000');
  await page.waitForSelector('body');
  console.log('✓ Homepage loaded successfully');
  
  // Check if we need to login
  const loginButton = await page.$('a[href="/login"]');
  if (loginButton) {
    console.log('2. Need to login first...');
    await loginButton.click();
    await page.waitForNavigation();
    
    // Fill in login form
    await page.type('input[id="email"]', 'test@example.com');
    await page.type('input[id="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    try {
      await page.waitForNavigation({ timeout: 5000 });
      console.log('✓ Login successful');
    } catch (e) {
      console.log('✗ Login failed, might need to register first');
      
      // Try to register
      await page.goto('http://localhost:3000/register');
      await page.type('input[id="name"]', 'Test User');
      await page.type('input[id="email"]', 'test@example.com');
      await page.type('input[id="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();
      console.log('✓ Registration successful');
    }
  }
  
  console.log('3. Navigating to dashboard...');
  await page.goto('http://localhost:3000/dashboard');
  await page.waitForSelector('body');
  console.log('✓ Dashboard loaded');
  
  // Look for create stream button - try multiple selectors
  console.log('4. Creating a new browser stream...');
  let createButton = await page.$('button:has(span:has-text("Create Browser Stream"))') || 
                     await page.$('button:has(span:has-text("Create Stream"))') ||
                     await page.$('button');
                     
  if (createButton) {
    // Get button text to verify
    const buttonText = await page.evaluate(el => el.textContent, createButton);
    console.log(`Found button with text: "${buttonText}"`);
    
    if (buttonText.includes('Create')) {
      await createButton.click();
      console.log('✓ Clicked create stream button');
      
      // Wait for navigation or modal
      await page.waitForTimeout(2000);
    }
  } else {
    console.log('✗ Could not find create stream button');
  }
  
  // Take a screenshot
  await page.screenshot({ path: 'dashboard-screenshot.png' });
  console.log('✓ Dashboard screenshot saved');
  
  // Check current URL to see if we were redirected
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);
  
  // If we're on a broadcast page, test camera access
  if (currentUrl.includes('/broadcast')) {
    console.log('5. Testing broadcast page...');
    
    // Wait for video element to appear
    try {
      await page.waitForSelector('video', { timeout: 5000 });
      const videoElement = await page.$('video');
      
      if (videoElement) {
        console.log('✓ Video element found');
        
        // Check if video is playing
        const isPlaying = await page.evaluate(() => {
          const video = document.querySelector('video');
          return !!(video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2);
        });
        
        console.log(`Video playing: ${isPlaying ? '✓' : '✗'}`);
        
        // Take screenshot of broadcast page
        await page.screenshot({ path: 'broadcast-screenshot.png' });
        console.log('✓ Broadcast screenshot saved');
        
        // Check for recording button
        const recordButton = await page.$('button:has(span:has-text("Start Recording"))') ||
                           await page.$('button:has(span:has-text("Stop Recording"))');
        if (recordButton) {
          console.log('✓ Recording button found');
        }
      }
    } catch (e) {
      console.log('✗ No video element found within timeout');
    }
  }
  
  // Test upload recording endpoint
  console.log('\n6. Testing upload recording endpoint...');
  const uploadResponse = await page.evaluate(async () => {
    try {
      // Create a test blob
      const blob = new Blob(['test video data'], { type: 'video/webm' });
      const formData = new FormData();
      formData.append('recording', blob, 'test-recording.webm');
      
      // Get a stream ID from the URL if we're on a stream page
      const urlParts = window.location.pathname.split('/');
      const streamId = urlParts[2] || 'test-stream-id';
      
      const response = await fetch(`/api/streams/${streamId}/upload-recording`, {
        method: 'POST',
        body: formData
      });
      
      return {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      };
    } catch (error) {
      return { error: error.message };
    }
  });
  
  if (uploadResponse.error) {
    console.log(`✗ Upload test failed: ${uploadResponse.error}`);
  } else {
    console.log(`Upload endpoint response: ${uploadResponse.status} ${uploadResponse.statusText}`);
    if (uploadResponse.ok) {
      console.log('✓ Upload endpoint accessible');
    } else {
      console.log('✗ Upload endpoint returned error');
    }
  }
  
  console.log('\nTest Summary:');
  console.log('- Server is accessible: ✓');
  console.log('- Homepage loads: ✓');
  console.log('- Dashboard accessible: ✓');
  console.log('- Screenshots saved for manual review');
  console.log(`- Current URL: ${currentUrl}`);
  
  // Keep browser open for manual inspection
  console.log('\nKeeping browser open for manual inspection. Press Ctrl+C to close.');
  
})();