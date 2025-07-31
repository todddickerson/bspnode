import { test, expect } from '@playwright/test'

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

test.describe('Studio Video Test', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      const type = msg.type()
      const text = msg.text()
      
      // Filter out React DevTools message
      if (text.includes('React DevTools')) return
      
      console.log(`[Browser ${type}]: ${text}`)
    })
    
    // Log any page errors
    page.on('pageerror', error => {
      console.error('[Page Error]:', error.message)
    })

    // Capture network requests/responses for debugging
    page.on('request', request => {
      if (request.url().includes('api/') || request.url().includes('livekit')) {
        console.log(`[Network Request]: ${request.method()} ${request.url()}`)
      }
    })
    
    page.on('response', response => {
      if (response.url().includes('api/') || response.url().includes('livekit')) {
        console.log(`[Network Response]: ${response.status()} ${response.url()}`)
      }
    })
  })

  test('Test studio video functionality', async ({ page }) => {
    console.log('=== Starting Studio Video Test ===')
    
    // Step 1: Login
    console.log('\n1. Logging in...')
    await page.goto('http://localhost:3001/login')
    await page.waitForLoadState('networkidle')
    
    await page.fill('#email', 'testuser@example.com')
    await page.fill('#password', 'password123')
    await page.click('button[type="submit"]')
    
    await page.waitForURL('**/dashboard', { timeout: 10000 })
    console.log('✓ Login successful')
    await page.screenshot({ path: 'test-results/studio-video-test/01-dashboard.png' })
    
    // Step 2: Create a new LIVEKIT stream
    console.log('\n2. Creating new LIVEKIT stream...')
    await page.click('button:has-text("Create New Stream")')
    await page.waitForTimeout(1000)
    
    await page.fill('input[name="title"]', 'Video Test Stream ' + Date.now())
    await page.fill('textarea[name="description"]', 'Testing video functionality in studio')
    await page.selectOption('select[name="streamType"]', 'LIVEKIT')
    await page.fill('input[name="maxHosts"]', '4')
    
    await page.screenshot({ path: 'test-results/studio-video-test/02-create-form.png' })
    
    await page.click('button[type="submit"]')
    await page.waitForURL('**/stream/**', { timeout: 10000 })
    
    const streamId = page.url().split('/stream/')[1].split('/')[0]
    console.log(`✓ Created stream with ID: ${streamId}`)
    await page.screenshot({ path: 'test-results/studio-video-test/03-stream-page.png' })
    
    // Step 3: Navigate to studio
    console.log('\n3. Navigating to studio...')
    
    // Check if we need to click Enter Studio or if we're already there
    const enterStudioButton = page.locator('button:has-text("Enter Studio")')
    if (await enterStudioButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await enterStudioButton.click()
      await page.waitForURL('**/studio', { timeout: 10000 })
    } else {
      // Navigate directly
      await page.goto(`http://localhost:3001/stream/${streamId}/studio`)
    }
    
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/studio-video-test/04-studio-initial.png' })
    
    // Step 4: Check video element
    console.log('\n4. Checking video element...')
    const videoElement = page.locator('video').first()
    const videoExists = await videoElement.count() > 0
    console.log(`  Video element exists: ${videoExists}`)
    
    if (!videoExists) {
      console.log('ERROR: No video element found in DOM!')
      
      // Check the DOM structure
      const domInfo = await page.evaluate(() => {
        const container = document.querySelector('.bg-gray-800.rounded-lg.overflow-hidden')
        return {
          containerExists: !!container,
          containerHTML: container ? container.innerHTML.substring(0, 200) : 'Not found',
          allVideos: document.querySelectorAll('video').length
        }
      })
      console.log('  DOM info:', domInfo)
    } else {
      const videoInfo = await videoElement.evaluate(el => {
        const video = el as HTMLVideoElement
        return {
          attributes: {
            autoplay: video.autoplay,
            muted: video.muted,
            playsInline: video.playsInline
          },
          dimensions: {
            width: video.clientWidth,
            height: video.clientHeight
          },
          state: {
            srcObject: !!video.srcObject,
            readyState: video.readyState,
            paused: video.paused
          }
        }
      })
      console.log('  Video info:', JSON.stringify(videoInfo, null, 2))
    }
    
    // Step 5: Click Join Studio
    console.log('\n5. Joining studio...')
    const joinButton = page.locator('button:has-text("Join Studio")')
    const joinButtonVisible = await joinButton.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (!joinButtonVisible) {
      console.log('ERROR: Join Studio button not visible!')
      
      // Check what buttons are available
      const buttons = await page.locator('button').allTextContents()
      console.log('  Available buttons:', buttons)
    } else {
      await joinButton.click()
      console.log('✓ Clicked Join Studio')
      
      // Wait for connection
      console.log('  Waiting for connection...')
      await page.waitForTimeout(5000)
      
      // Check if still connecting
      const connectingVisible = await page.locator('text=Connecting').isVisible().catch(() => false)
      if (connectingVisible) {
        console.log('  Still connecting, waiting more...')
        await page.waitForSelector('text=Connecting', { state: 'hidden', timeout: 30000 }).catch(() => {
          console.log('  Connection timeout!')
        })
      }
      
      await page.screenshot({ path: 'test-results/studio-video-test/05-after-join.png' })
      
      // Step 6: Check video state after joining
      console.log('\n6. Checking video after joining...')
      
      if (videoExists) {
        const videoState = await videoElement.evaluate(el => {
          const video = el as HTMLVideoElement
          const stream = video.srcObject as MediaStream | null
          
          return {
            hasStream: !!stream,
            streamActive: stream?.active,
            videoTracks: stream ? stream.getVideoTracks().length : 0,
            audioTracks: stream ? stream.getAudioTracks().length : 0,
            playing: !video.paused && video.readyState > 2,
            currentTime: video.currentTime,
            error: video.error ? video.error.message : null
          }
        })
        console.log('  Video state:', JSON.stringify(videoState, null, 2))
        
        // Check for overlay blocking video
        const overlayPresent = await page.locator('.absolute.inset-0').filter({ hasText: 'Join Studio' }).isVisible().catch(() => false)
        console.log(`  Overlay present: ${overlayPresent}`)
        
        // Check console for LiveKit errors
        const errors = await page.evaluate(() => {
          return (window as any).__livekitErrors || []
        })
        if (errors.length > 0) {
          console.log('  LiveKit errors:', errors)
        }
        
        // Final diagnosis
        console.log('\n=== DIAGNOSIS ===')
        if (!videoState.hasStream) {
          console.log('❌ No MediaStream attached to video element')
        } else if (videoState.videoTracks === 0) {
          console.log('❌ MediaStream has no video tracks')
        } else if (!videoState.streamActive) {
          console.log('❌ MediaStream is not active')
        } else if (!videoState.playing) {
          console.log('❌ Video is not playing')
        } else {
          console.log('✅ Video should be working!')
        }
        
        if (overlayPresent) {
          console.log('⚠️  Overlay is blocking the video view')
        }
      }
      
      // Step 7: Test video controls
      console.log('\n7. Testing video controls...')
      const videoToggle = page.locator('button[disabled=false]').filter({ has: page.locator('svg') }).first()
      if (await videoToggle.isEnabled()) {
        await videoToggle.click()
        await page.waitForTimeout(1000)
        console.log('  Toggled video')
        await page.screenshot({ path: 'test-results/studio-video-test/06-video-toggled.png' })
      }
    }
    
    // Final full page screenshot
    await page.screenshot({ path: 'test-results/studio-video-test/07-final-state.png', fullPage: true })
    
    // Clean up - end the stream
    console.log('\n8. Cleaning up...')
    try {
      await page.goto(`http://localhost:3001/stream/${streamId}`)
      const endButton = page.locator('button:has-text("End Stream")')
      if (await endButton.isVisible({ timeout: 5000 })) {
        await endButton.click()
        console.log('✓ Ended test stream')
      }
    } catch (error) {
      console.log('Could not clean up stream:', error)
    }
  })
})