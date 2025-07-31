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

test.describe('Direct Studio Video Diagnosis', () => {
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

  test('Direct navigation to studio and video check', async ({ page }) => {
    console.log('=== Starting Direct Studio Video Diagnosis ===')
    
    // Step 1: Login
    console.log('\n1. Logging in...')
    await page.goto('http://localhost:3001/login')
    await page.waitForLoadState('networkidle')
    
    await page.fill('#email', 'testuser@example.com')
    await page.fill('#password', 'password123')
    await page.click('button[type="submit"]')
    
    await page.waitForURL('**/dashboard', { timeout: 10000 })
    console.log('✓ Login successful')
    
    // Step 2: Get stream list and find a LIVEKIT stream
    console.log('\n2. Finding LIVEKIT stream...')
    const response = await page.request.get('http://localhost:3001/api/streams')
    const streams = await response.json()
    const livekitStream = streams.find(s => s.streamType === 'LIVEKIT')
    
    if (!livekitStream) {
      console.log('No LIVEKIT stream found, creating one...')
      
      // Create a new stream
      const createResponse = await page.request.post('http://localhost:3001/api/streams', {
        data: {
          title: 'Test Studio Video Stream',
          description: 'Testing video functionality',
          streamType: 'LIVEKIT',
          maxHosts: 4
        }
      })
      
      const newStream = await createResponse.json()
      console.log(`✓ Created new stream with ID: ${newStream.id}`)
      
      // Navigate directly to studio
      await page.goto(`http://localhost:3001/stream/${newStream.id}/studio`)
    } else {
      console.log(`✓ Found existing LIVEKIT stream: ${livekitStream.id}`)
      // Navigate directly to studio
      await page.goto(`http://localhost:3001/stream/${livekitStream.id}/studio`)
    }
    
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/studio-diagnosis/direct-01-studio-initial.png' })
    
    // Step 3: Check initial DOM state
    console.log('\n3. Checking initial DOM state...')
    const videoElement = page.locator('video').first()
    const videoExists = await videoElement.count() > 0
    console.log(`  Video element exists: ${videoExists}`)
    
    if (videoExists) {
      const videoBounds = await videoElement.boundingBox()
      console.log(`  Video bounds:`, videoBounds)
      
      const videoInfo = await videoElement.evaluate(el => {
        const video = el as HTMLVideoElement
        const computedStyle = window.getComputedStyle(video)
        
        return {
          // Basic attributes
          autoplay: video.autoplay,
          muted: video.muted,
          playsInline: video.playsInline,
          src: video.src,
          srcObject: video.srcObject ? 'Present' : 'None',
          
          // State
          readyState: video.readyState,
          paused: video.paused,
          currentTime: video.currentTime,
          duration: video.duration,
          
          // Dimensions
          clientWidth: video.clientWidth,
          clientHeight: video.clientHeight,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          
          // Style
          display: computedStyle.display,
          visibility: computedStyle.visibility,
          opacity: computedStyle.opacity,
          position: computedStyle.position,
          
          // Parent info
          parentDisplay: video.parentElement ? window.getComputedStyle(video.parentElement).display : 'N/A',
          inViewport: video.getBoundingClientRect().top < window.innerHeight
        }
      })
      console.log('  Video element info:', JSON.stringify(videoInfo, null, 2))
    }
    
    // Step 4: Click Join Studio
    console.log('\n4. Clicking Join Studio...')
    const joinButton = page.locator('button:has-text("Join Studio")')
    
    // Check if button exists and is visible
    const buttonExists = await joinButton.count() > 0
    const buttonVisible = buttonExists ? await joinButton.isVisible() : false
    console.log(`  Join button exists: ${buttonExists}, visible: ${buttonVisible}`)
    
    if (buttonVisible) {
      await joinButton.click()
      console.log('✓ Clicked Join Studio button')
      
      // Wait for connection
      await page.waitForTimeout(5000) // Give LiveKit time to connect
      await page.screenshot({ path: 'test-results/studio-diagnosis/direct-02-after-join.png' })
      
      // Check if still connecting
      const connectingVisible = await page.locator('text=Connecting').isVisible().catch(() => false)
      if (connectingVisible) {
        console.log('  Still connecting, waiting longer...')
        await page.waitForSelector('text=Connecting', { state: 'hidden', timeout: 30000 }).catch(() => {})
      }
      
      // Check video state after connection
      console.log('\n5. Checking video state after connection...')
      await page.waitForTimeout(2000) // Give time for video to attach
      
      const videoStateAfter = await videoElement.evaluate(el => {
        const video = el as HTMLVideoElement
        const stream = video.srcObject as MediaStream | null
        
        return {
          srcObject: video.srcObject ? 'Present' : 'None',
          readyState: video.readyState,
          paused: video.paused,
          currentTime: video.currentTime,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          playing: !video.paused && video.readyState > 2,
          error: video.error ? { code: video.error.code, message: video.error.message } : null,
          
          // MediaStream info
          streamActive: stream ? stream.active : null,
          videoTracks: stream ? stream.getVideoTracks().map(track => ({
            id: track.id,
            label: track.label,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState
          })) : [],
          audioTracks: stream ? stream.getAudioTracks().map(track => ({
            id: track.id,
            label: track.label,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState
          })) : []
        }
      })
      console.log('  Video state after connection:', JSON.stringify(videoStateAfter, null, 2))
      
      // Check for overlays blocking video
      const overlayCheck = await page.evaluate(() => {
        const video = document.querySelector('video')
        if (!video) return { videoFound: false }
        
        const rect = video.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        const elementAtCenter = document.elementFromPoint(centerX, centerY)
        
        return {
          videoFound: true,
          elementAtCenter: elementAtCenter?.tagName,
          isVideo: elementAtCenter === video,
          overlayPresent: elementAtCenter !== video
        }
      })
      console.log('  Overlay check:', overlayCheck)
      
      // Test video controls
      console.log('\n6. Testing video controls...')
      const videoToggleButton = page.locator('button').filter({ has: page.locator('svg') }).first()
      if (await videoToggleButton.isEnabled()) {
        await videoToggleButton.click()
        await page.waitForTimeout(1000)
        console.log('  Toggled video off')
        
        await videoToggleButton.click()
        await page.waitForTimeout(1000)
        console.log('  Toggled video on')
      }
      
      // Final state screenshot
      await page.screenshot({ path: 'test-results/studio-diagnosis/direct-03-final-state.png', fullPage: true })
      
      // Check LiveKit specific debug info
      const livekitDebug = await page.evaluate(() => {
        // @ts-ignore
        const room = window.livekit_room // If room is exposed for debugging
        if (room) {
          return {
            roomFound: true,
            state: room.state,
            participants: room.participants?.size || 0,
            localParticipant: {
              identity: room.localParticipant?.identity,
              videoEnabled: room.localParticipant?.isCameraEnabled,
              audioEnabled: room.localParticipant?.isMicrophoneEnabled,
              tracks: room.localParticipant?.tracks?.size || 0
            }
          }
        }
        return { roomFound: false }
      })
      console.log('\n7. LiveKit debug info:', livekitDebug)
      
      // Generate diagnosis summary
      console.log('\n=== DIAGNOSIS SUMMARY ===')
      console.log(`Video element exists: ${videoExists}`)
      console.log(`Video has srcObject: ${videoStateAfter.srcObject === 'Present'}`)
      console.log(`Video is playing: ${videoStateAfter.playing}`)
      console.log(`Video tracks: ${videoStateAfter.videoTracks.length}`)
      console.log(`Stream active: ${videoStateAfter.streamActive}`)
      
      if (videoStateAfter.error) {
        console.log(`VIDEO ERROR: ${JSON.stringify(videoStateAfter.error)}`)
      }
      
      if (videoStateAfter.videoTracks.length === 0) {
        console.log('ISSUE: No video tracks in MediaStream')
      }
      
      if (overlayCheck.overlayPresent) {
        console.log('ISSUE: Overlay element blocking video')
      }
      
      if (!videoStateAfter.playing && videoStateAfter.srcObject === 'Present') {
        console.log('ISSUE: Video has stream but is not playing')
      }
    } else {
      console.log('ERROR: Join Studio button not found or not visible')
      
      // Check for error messages
      const errorMessages = await page.locator('.text-red-500, .text-destructive').allTextContents()
      if (errorMessages.length > 0) {
        console.log('Error messages found:', errorMessages)
      }
    }
  })
})