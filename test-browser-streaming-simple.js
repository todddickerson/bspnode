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
    await page.waitForSelector('#email');
    await page.type('#email', 'test@example.com');
    await page.type('#password', 'password123');
    await page.click('button[type="submit"]');
    
    try {
      await page.waitForNavigation({ timeout: 5000 });
      console.log('✓ Login successful');
    } catch (e) {
      console.log('✗ Login failed, might need to register first');
      
      // Try to register
      await page.goto('http://localhost:3000/register');
      await page.waitForSelector('#name');
      await page.type('#name', 'Test User');
      await page.type('#email', 'test@example.com');
      await page.type('#password', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();
      console.log('✓ Registration successful');
    }
  }
  
  console.log('3. Navigating to dashboard...');
  await page.goto('http://localhost:3000/dashboard');
  await page.waitForSelector('body');
  console.log('✓ Dashboard loaded');
  
  // Look for create stream button
  console.log('4. Creating a new browser stream...');
  
  // Get all buttons and find the one with "Create" text
  const buttons = await page.$$('button');
  let createButton = null;
  
  for (const button of buttons) {
    const text = await page.evaluate(el => el.textContent, button);
    if (text && text.includes('Create') && text.includes('Stream')) {
      createButton = button;
      console.log(`Found button with text: "${text}"`);
      break;
    }
  }
  
  if (createButton) {
    await createButton.click();
    console.log('✓ Clicked create stream button');
    
    // Wait for form to appear
    await page.waitForTimeout(1000);
    
    // Fill in the form
    const titleInput = await page.$('#title');
    if (titleInput) {
      console.log('5. Filling in stream creation form...');
      await page.type('#title', 'Test Browser Stream');
      await page.type('#description', 'Testing browser streaming functionality');
      
      // Click on Browser streaming option
      const browserStreamButton = await page.$$eval('button', buttons => {
        const browserButton = buttons.find(b => b.textContent && b.textContent.includes('Stream from Browser'));
        if (browserButton) {
          browserButton.click();
          return true;
        }
        return false;
      });
      
      if (browserStreamButton) {
        console.log('✓ Selected browser streaming option');
      }
      
      // Submit the form
      await page.waitForTimeout(500);
      const submitButtons = await page.$$('button[type="submit"]');
      if (submitButtons.length > 0) {
        await submitButtons[0].click();
        console.log('✓ Submitted stream creation form');
        
        // Wait for navigation to broadcast page
        await page.waitForTimeout(3000);
      }
    }
  } else {
    console.log('✗ Could not find create stream button');
  }
  
  // Take a screenshot
  await page.screenshot({ path: 'current-page-screenshot.png' });
  console.log('✓ Screenshot saved as current-page-screenshot.png');
  
  // Check current URL to see if we were redirected
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);
  
  // If we're on a broadcast page, test camera access
  if (currentUrl.includes('/broadcast')) {
    console.log('6. Testing broadcast page...');
    
    // Wait for video element to appear
    try {
      await page.waitForSelector('video', { timeout: 10000 });
      const videoElement = await page.$('video');
      
      if (videoElement) {
        console.log('✓ Video element found');
        
        // Wait a bit for video to initialize
        await page.waitForTimeout(3000);
        
        // Check if video is playing
        const videoInfo = await page.evaluate(() => {
          const video = document.querySelector('video');
          return {
            isPlaying: !!(video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2),
            readyState: video.readyState,
            paused: video.paused,
            currentTime: video.currentTime,
            hasSource: !!video.srcObject || !!video.src
          };
        });
        
        console.log('Video info:', videoInfo);
        console.log(`Video playing: ${videoInfo.isPlaying ? '✓' : '✗'}`);
        
        // Take screenshot of broadcast page
        await page.screenshot({ path: 'broadcast-screenshot.png' });
        console.log('✓ Broadcast screenshot saved');
        
        // Look for recording buttons
        const recordButtons = await page.$$('button');
        for (const button of recordButtons) {
          const text = await page.evaluate(el => el.textContent, button);
          if (text && (text.includes('Start Recording') || text.includes('Stop Recording'))) {
            console.log(`✓ Found recording button: "${text}"`);
            
            // Try clicking start recording
            if (text.includes('Start Recording')) {
              await button.click();
              console.log('✓ Clicked Start Recording');
              await page.waitForTimeout(3000);
              
              // Take another screenshot
              await page.screenshot({ path: 'recording-screenshot.png' });
              console.log('✓ Recording screenshot saved');
            }
          }
        }
      }
    } catch (e) {
      console.log('✗ No video element found within timeout');
      console.log('Error:', e.message);
    }
  }
  
  // Test upload recording endpoint
  console.log('\n7. Testing upload recording endpoint...');
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
      
      const responseText = await response.text();
      
      return {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
        responseText: responseText.substring(0, 200) // First 200 chars
      };
    } catch (error) {
      return { error: error.message };
    }
  });
  
  if (uploadResponse.error) {
    console.log(`✗ Upload test failed: ${uploadResponse.error}`);
  } else {
    console.log(`Upload endpoint response: ${uploadResponse.status} ${uploadResponse.statusText}`);
    if (uploadResponse.responseText) {
      console.log(`Response preview: ${uploadResponse.responseText}`);
    }
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
  
  // List all screenshots created
  console.log('\nScreenshots created:');
  console.log('- current-page-screenshot.png');
  if (currentUrl.includes('/broadcast')) {
    console.log('- broadcast-screenshot.png');
    console.log('- recording-screenshot.png (if recording started)');
  }
  
  // Keep browser open for manual inspection
  console.log('\nKeeping browser open for manual inspection. Press Ctrl+C to close.');
  
})();