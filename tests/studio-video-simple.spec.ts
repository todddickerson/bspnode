import { test } from '@playwright/test'

// Test configuration to ensure proper permissions
test.use({
  permissions: ['camera', 'microphone'],
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  },
})

test('Studio video diagnosis - simple flow', async ({ page }) => {
  console.log('=== Starting Simple Studio Video Test ===')
  
  // Enable console logging
  page.on('console', msg => {
    if (!msg.text().includes('React DevTools')) {
      console.log(`[Browser]: ${msg.text()}`)
    }
  })
  
  page.on('pageerror', error => {
    console.error('[Page Error]:', error.message)
  })
  
  // Step 1: Login
  console.log('\n1. Logging in...')
  await page.goto('http://localhost:3001/login')
  await page.fill('#email', 'testuser@example.com')
  await page.fill('#password', 'password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard')
  console.log('✓ Logged in')
  
  // Step 2: Click on the LiveKit Studio Test stream
  console.log('\n2. Finding LiveKit stream...')
  await page.waitForTimeout(2000) // Let page load
  
  // Click on the specific LiveKit stream card (the first one)
  const streamCard = page.locator('.bg-white').filter({ hasText: 'LiveKit Studio Test' }).first()
  const enterStudioButton = streamCard.locator('button:has-text("Enter Studio")')
  
  console.log('  Clicking Enter Studio...')
  await enterStudioButton.click()
  
  // Wait for navigation to studio
  await page.waitForURL('**/studio', { timeout: 10000 })
  console.log('✓ Navigated to studio')
  
  // Step 3: Take initial screenshot
  await page.screenshot({ path: 'test-results/studio-simple/01-studio-initial.png' })
  
  // Step 4: Check for video element
  console.log('\n3. Checking video element...')
  const videoCount = await page.locator('video').count()
  console.log(`  Found ${videoCount} video element(s)`)
  
  if (videoCount > 0) {
    const videoInfo = await page.locator('video').first().evaluate(el => {
      const video = el as HTMLVideoElement
      return {
        exists: true,
        width: video.clientWidth,
        height: video.clientHeight,
        hasStream: !!video.srcObject,
        paused: video.paused,
        muted: video.muted,
        autoplay: video.autoplay
      }
    })
    console.log('  Video info:', videoInfo)
  }
  
  // Step 5: Check for Join Studio button
  console.log('\n4. Looking for Join Studio button...')
  const joinButton = page.locator('button:has-text("Join Studio")')
  const joinVisible = await joinButton.isVisible({ timeout: 5000 }).catch(() => false)
  console.log(`  Join Studio button visible: ${joinVisible}`)
  
  if (joinVisible) {
    console.log('  Clicking Join Studio...')
    await joinButton.click()
    
    // Wait for connection
    console.log('  Waiting for connection...')
    await page.waitForTimeout(5000)
    
    // Take screenshot after joining
    await page.screenshot({ path: 'test-results/studio-simple/02-after-join.png' })
    
    // Check video state again
    if (videoCount > 0) {
      const videoStateAfter = await page.locator('video').first().evaluate(el => {
        const video = el as HTMLVideoElement
        const stream = video.srcObject as MediaStream | null
        
        return {
          hasStream: !!stream,
          streamActive: stream?.active,
          videoTracks: stream ? stream.getVideoTracks().map(t => ({
            enabled: t.enabled,
            readyState: t.readyState,
            label: t.label
          })) : [],
          playing: !video.paused && video.readyState > 2,
          readyState: video.readyState,
          currentTime: video.currentTime,
          error: video.error ? video.error.message : null
        }
      })
      console.log('\n5. Video state after joining:', JSON.stringify(videoStateAfter, null, 2))
      
      // Check what's visible on the video element
      const videoVisibility = await page.locator('video').first().evaluate(el => {
        const rect = el.getBoundingClientRect()
        const style = window.getComputedStyle(el)
        
        return {
          visible: rect.width > 0 && rect.height > 0,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        }
      })
      console.log('  Video visibility:', videoVisibility)
      
      // Check for overlays
      const overlayText = await page.locator('.absolute.inset-0').allTextContents()
      if (overlayText.length > 0) {
        console.log('  Overlay text found:', overlayText)
      }
    }
    
    // Try toggling video
    console.log('\n6. Testing video toggle...')
    const videoToggle = page.locator('button').filter({ has: page.locator('svg') }).first()
    if (await videoToggle.isEnabled()) {
      await videoToggle.click()
      console.log('  Toggled video')
      await page.waitForTimeout(1000)
      await page.screenshot({ path: 'test-results/studio-simple/03-video-toggled.png' })
    }
  } else {
    // Check what's on the page if Join Studio is not visible
    const pageText = await page.locator('body').textContent()
    console.log('  Page contains:', pageText?.substring(0, 200))
    
    const buttons = await page.locator('button').allTextContents()
    console.log('  Available buttons:', buttons)
  }
  
  // Final screenshot
  await page.screenshot({ path: 'test-results/studio-simple/04-final.png', fullPage: true })
  
  console.log('\n=== Test Complete ===')
})