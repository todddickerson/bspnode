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
  
  console.log('1. Logging in...');
  await page.goto('http://localhost:3000/login');
  await page.waitForSelector('#email');
  await page.type('#email', 'test@example.com');
  await page.type('#password', 'password123');
  await page.click('button[type="submit"]');
  
  try {
    await page.waitForNavigation({ timeout: 5000 });
    console.log('✓ Login successful');
  } catch (e) {
    console.log('✗ Login failed');
    return;
  }
  
  console.log('\n2. Checking dashboard for existing streams...');
  await page.goto('http://localhost:3000/dashboard');
  await page.waitForSelector('body');
  
  // Debug: Print the page content
  const pageContent = await page.evaluate(() => {
    const body = document.body;
    return {
      hasCreateButton: !!document.querySelector('button'),
      buttonCount: document.querySelectorAll('button').length,
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent),
      hasForm: !!document.querySelector('form'),
      streamCards: document.querySelectorAll('.bg-white.rounded-lg.shadow').length
    };
  });
  
  console.log('Page analysis:', pageContent);
  
  // Try to find and click the first button (should be "Create New Stream")
  const firstButton = await page.$('button');
  if (firstButton) {
    const buttonText = await page.evaluate(el => el.textContent, firstButton);
    console.log(`\n3. Found button: "${buttonText}"`);
    
    if (buttonText.includes('Create')) {
      await firstButton.click();
      console.log('✓ Clicked create button');
      await new Promise(r => setTimeout(r, 1000));
      
      // Now fill the form if it appeared
      const titleInput = await page.$('#title');
      if (titleInput) {
        console.log('\n4. Filling stream creation form...');
        await page.type('#title', 'Test Browser Stream');
        await page.type('#description', 'Testing browser streaming');
        
        // Find and click the browser streaming option
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent, button);
          if (text && text.includes('Stream from Browser')) {
            await button.click();
            console.log('✓ Selected browser streaming');
            break;
          }
        }
        
        // Submit the form
        await new Promise(r => setTimeout(r, 500));
        const submitButton = await page.$('button[type="submit"]');
        if (submitButton) {
          await submitButton.click();
          console.log('✓ Submitted form');
          
          // Wait for redirect
          await new Promise(r => setTimeout(r, 5000));
          
          const newUrl = page.url();
          console.log(`\n5. Redirected to: ${newUrl}`);
          
          if (newUrl.includes('/broadcast')) {
            console.log('✓ Successfully reached broadcast page!');
            
            // Test camera
            await new Promise(r => setTimeout(r, 3000));
            const hasVideo = await page.$('video');
            console.log(`Video element present: ${hasVideo ? '✓' : '✗'}`);
            
            if (hasVideo) {
              const videoState = await page.evaluate(() => {
                const video = document.querySelector('video');
                return {
                  hasStream: !!video.srcObject,
                  width: video.videoWidth,
                  height: video.videoHeight,
                  readyState: video.readyState
                };
              });
              console.log('Video state:', videoState);
            }
            
            await page.screenshot({ path: 'broadcast-page.png' });
            console.log('✓ Screenshot saved: broadcast-page.png');
          }
        }
      }
    }
  }
  
  // Alternative: Look for existing browser streams
  const streamCards = await page.$$('.bg-white.rounded-lg.shadow');
  console.log(`\n6. Found ${streamCards.length} existing streams`);
  
  for (let i = 0; i < streamCards.length; i++) {
    const streamInfo = await page.evaluate((card) => {
      const title = card.querySelector('h3')?.textContent;
      const type = card.textContent?.includes('Browser Stream') ? 'BROWSER' : 'RTMP';
      const status = card.textContent?.match(/Status:\s*(\w+)/)?.[1];
      const buttons = Array.from(card.querySelectorAll('button')).map(b => b.textContent);
      return { title, type, status, buttons };
    }, streamCards[i]);
    
    console.log(`\nStream ${i + 1}:`, streamInfo);
    
    // If it's a browser stream that's created, try to broadcast
    if (streamInfo.type === 'BROWSER' && streamInfo.status === 'CREATED') {
      const broadcastButton = await streamCards[i].$('button');
      if (broadcastButton) {
        const buttonText = await page.evaluate(el => el.textContent, broadcastButton);
        if (buttonText.includes('Start Broadcasting')) {
          console.log('Found broadcast button, clicking...');
          await broadcastButton.click();
          await new Promise(r => setTimeout(r, 3000));
          console.log('Current URL:', page.url());
          break;
        }
      }
    }
  }
  
  console.log('\nTest completed. Browser remains open for inspection.');
  
})();