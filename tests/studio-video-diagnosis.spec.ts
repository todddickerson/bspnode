import { test, expect, Page } from '@playwright/test'

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

let streamId: string | null = null

test.describe('Studio Video Diagnosis', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      console.log(`[Browser ${msg.type()}]: ${msg.text()}`)
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

  test('Complete studio video diagnosis flow', async ({ page }) => {
    console.log('=== Starting Studio Video Diagnosis ===')
    
    // Step 1: Login
    console.log('\n1. Logging in...')
    await page.goto('http://localhost:3001/login')
    await page.screenshot({ path: 'test-results/studio-diagnosis/01-login-page.png' })
    
    await page.fill('input[id="email"]', 'testuser@example.com')
    await page.fill('input[id="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    await page.waitForURL('**/dashboard')
    console.log('✓ Login successful')
    await page.screenshot({ path: 'test-results/studio-diagnosis/02-dashboard.png' })
    
    // Step 2: Check for existing LIVEKIT streams or create one
    console.log('\n2. Checking for existing streams...')
    
    // Look for LIVEKIT streams
    const livekitStreamExists = await page.locator('text=LIVEKIT').first().isVisible().catch(() => false)
    
    if (livekitStreamExists) {
      console.log('✓ Found existing LIVEKIT stream')
      // Click on the first LIVEKIT stream
      await page.click('text=LIVEKIT', { timeout: 5000 })
      await page.waitForURL('**/stream/**')
      streamId = page.url().split('/stream/')[1].split('/')[0]
      console.log(`  Stream ID: ${streamId}`)
    } else {
      console.log('No LIVEKIT stream found, creating one...')
      
      // Create a new stream
      await page.click('button:has-text("Create Stream")')
      await page.fill('input[name="title"]', 'Test Studio Video Stream')
      await page.fill('textarea[name="description"]', 'Testing video functionality')
      await page.selectOption('select[name="streamType"]', 'LIVEKIT')
      await page.fill('input[name="maxHosts"]', '4')
      await page.screenshot({ path: 'test-results/studio-diagnosis/03-create-stream-form.png' })
      
      await page.click('button[type="submit"]')
      await page.waitForURL('**/stream/**')
      streamId = page.url().split('/stream/')[1].split('/')[0]
      console.log(`✓ Created new stream with ID: ${streamId}`)
    }
    
    await page.screenshot({ path: 'test-results/studio-diagnosis/04-stream-page.png' })
    
    // Step 3: Navigate to studio
    console.log('\n3. Navigating to studio...')
    await page.goto(`http://localhost:3001/stream/${streamId}/studio`)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/studio-diagnosis/05-studio-initial.png' })
    
    // Step 4: Check initial DOM state
    console.log('\n4. Checking initial DOM state...')
    const localVideoElement = await page.locator('video').first()
    const videoExists = await localVideoElement.count() > 0
    console.log(`  Video element exists: ${videoExists}`)
    
    if (videoExists) {
      const videoDimensions = await localVideoElement.boundingBox()
      console.log(`  Video dimensions:`, videoDimensions)
      
      const videoAttributes = await localVideoElement.evaluate(el => ({
        autoplay: el.autoplay,
        muted: el.muted,
        playsInline: el.playsInline,
        src: el.src,
        srcObject: el.srcObject ? 'MediaStream' : null,
        readyState: el.readyState,
        paused: el.paused,
        currentTime: el.currentTime,
        width: el.clientWidth,
        height: el.clientHeight,
        display: window.getComputedStyle(el).display,
        visibility: window.getComputedStyle(el).visibility,
      }))
      console.log('  Video attributes:', videoAttributes)
    }
    
    // Step 5: Click Join Studio
    console.log('\n5. Clicking Join Studio...')
    const joinButton = page.locator('button:has-text("Join Studio")')
    await expect(joinButton).toBeVisible({ timeout: 10000 })
    
    // Set up promise to capture permission request
    const permissionPromise = page.waitForEvent('dialog', { timeout: 15000 }).catch(() => null)
    
    await joinButton.click()
    console.log('✓ Clicked Join Studio button')
    
    // Handle permission dialog if it appears
    const dialog = await permissionPromise
    if (dialog) {
      console.log('  Permission dialog appeared, accepting...')
      await dialog.accept()
    }
    
    // Wait for connection
    await page.waitForTimeout(3000) // Give time for LiveKit connection
    await page.screenshot({ path: 'test-results/studio-diagnosis/06-after-join-click.png' })
    
    // Step 6: Check connection status
    console.log('\n6. Checking connection status...')
    const connectingText = await page.locator('text=Connecting').isVisible().catch(() => false)
    const connectedControls = await page.locator('button[disabled=false]').filter({ hasText: /Video|Mic/ }).count()
    
    console.log(`  Connecting indicator visible: ${connectingText}`)
    console.log(`  Enabled controls count: ${connectedControls}`)
    
    // Wait for connection to complete
    if (connectingText) {
      console.log('  Waiting for connection to complete...')
      await page.waitForSelector('text=Connecting', { state: 'hidden', timeout: 30000 }).catch(() => {})
    }
    
    await page.screenshot({ path: 'test-results/studio-diagnosis/07-after-connection.png' })
    
    // Step 7: Check video state after connection
    console.log('\n7. Checking video state after connection...')
    await page.waitForTimeout(2000) // Give time for video to attach
    
    const videoStateAfter = await localVideoElement.evaluate(el => ({
      srcObject: el.srcObject ? 'MediaStream' : null,
      readyState: el.readyState,
      paused: el.paused,
      currentTime: el.currentTime,
      videoWidth: el.videoWidth,
      videoHeight: el.videoHeight,
      error: el.error ? el.error.message : null,
    }))
    console.log('  Video state after connection:', videoStateAfter)
    
    // Check if video is playing
    const isVideoPlaying = await localVideoElement.evaluate(video => {
      return !!(video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2)
    })
    console.log(`  Video is playing: ${isVideoPlaying}`)
    
    // Step 8: Check for error overlays
    console.log('\n8. Checking for error overlays...')
    const videoOffIcon = await page.locator('.absolute.inset-0 svg').isVisible().catch(() => false)
    const waitingMessage = await page.locator('text=Click "Join Studio" to start').isVisible().catch(() => false)
    
    console.log(`  Video off icon visible: ${videoOffIcon}`)
    console.log(`  Waiting message visible: ${waitingMessage}`)
    
    // Step 9: Test video controls
    console.log('\n9. Testing video controls...')
    const videoButton = page.locator('button').filter({ has: page.locator('svg') }).first()
    const videoButtonEnabled = await videoButton.isEnabled()
    console.log(`  Video button enabled: ${videoButtonEnabled}`)
    
    if (videoButtonEnabled) {
      await videoButton.click()
      await page.waitForTimeout(1000)
      await page.screenshot({ path: 'test-results/studio-diagnosis/08-after-video-toggle.png' })
      
      // Toggle back
      await videoButton.click()
      await page.waitForTimeout(1000)
    }
    
    // Step 10: Check device settings
    console.log('\n10. Checking device settings...')
    const settingsButton = page.locator('button').filter({ has: page.locator('svg[class*="Settings"]') })
    if (await settingsButton.isVisible()) {
      await settingsButton.click()
      await page.waitForTimeout(500)
      
      const cameraSelect = await page.locator('select').first().isVisible()
      const micSelect = await page.locator('select').nth(1).isVisible()
      
      console.log(`  Camera selector visible: ${cameraSelect}`)
      console.log(`  Microphone selector visible: ${micSelect}`)
      
      if (cameraSelect) {
        const cameraOptions = await page.locator('select').first().locator('option').count()
        console.log(`  Available cameras: ${cameraOptions}`)
      }
      
      await page.screenshot({ path: 'test-results/studio-diagnosis/09-device-settings.png' })
    }
    
    // Step 11: Check MediaStream tracks
    console.log('\n11. Checking MediaStream tracks...')
    const mediaStreamInfo = await page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement
      if (!video || !video.srcObject) return { hasStream: false }
      
      const stream = video.srcObject as MediaStream
      const videoTracks = stream.getVideoTracks()
      const audioTracks = stream.getAudioTracks()
      
      return {
        hasStream: true,
        videoTracks: videoTracks.map(track => ({
          id: track.id,
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          settings: track.getSettings(),
        })),
        audioTracks: audioTracks.map(track => ({
          id: track.id,
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
        })),
      }
    })
    console.log('  MediaStream info:', JSON.stringify(mediaStreamInfo, null, 2))
    
    // Step 12: Final diagnosis
    console.log('\n=== DIAGNOSIS SUMMARY ===')
    console.log(`Stream ID: ${streamId}`)
    console.log(`Video element exists: ${videoExists}`)
    console.log(`Video is playing: ${isVideoPlaying}`)
    console.log(`Has MediaStream: ${mediaStreamInfo.hasStream}`)
    console.log(`Video tracks: ${mediaStreamInfo.hasStream ? mediaStreamInfo.videoTracks.length : 0}`)
    console.log(`Controls enabled: ${connectedControls > 0}`)
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/studio-diagnosis/10-final-state.png', fullPage: true })
    
    // Generate diagnosis report
    const report = {
      timestamp: new Date().toISOString(),
      streamId,
      videoElementExists: videoExists,
      videoPlaying: isVideoPlaying,
      mediaStream: mediaStreamInfo,
      videoState: videoStateAfter,
      issues: []
    }
    
    if (!videoExists) {
      report.issues.push('Video element not found in DOM')
    }
    if (!mediaStreamInfo.hasStream) {
      report.issues.push('No MediaStream attached to video element')
    }
    if (mediaStreamInfo.hasStream && mediaStreamInfo.videoTracks.length === 0) {
      report.issues.push('MediaStream has no video tracks')
    }
    if (!isVideoPlaying) {
      report.issues.push('Video element is not playing')
    }
    if (videoStateAfter.error) {
      report.issues.push(`Video error: ${videoStateAfter.error}`)
    }
    
    console.log('\nDiagnosis Report:', JSON.stringify(report, null, 2))
    
    // Assert that video should be working
    expect(report.issues.length).toBe(0)
  })
  
  test.afterEach(async ({ page }) => {
    // Clean up - end stream if it was created
    if (streamId) {
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
    }
  })
})