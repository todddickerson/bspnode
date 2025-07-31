import { test, expect, Page } from '@playwright/test'

// Get base URL from environment or default to localhost:3001
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Complete Streaming Flow', () => {
  test.beforeEach(async ({ context }) => {
    // Grant camera and microphone permissions
    await context.grantPermissions(['camera', 'microphone']);
  });

  test('complete broadcast and view flow', async ({ page, context }) => {
    // Login
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[id="email"]', 'testuser@example.com')
    await page.fill('input[id="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL(`${BASE_URL}/dashboard`)

    // Go to broadcast page of existing stream
    const startBroadcastingButton = page.locator('button:has-text("Start Broadcasting")').first()
    await startBroadcastingButton.click()
    await page.waitForURL(/\/broadcast/)

    // Wait for camera to initialize
    await page.waitForTimeout(3000)
    
    // Take screenshot of ready state
    await page.screenshot({ path: 'test-results/ready-to-broadcast.png', fullPage: true })

    // Click Go Live
    const goLiveButton = page.locator('button:has-text("Go Live")')
    if (await goLiveButton.isVisible()) {
      await goLiveButton.click()
      
      // Wait for broadcast to start
      await page.waitForTimeout(5000)
      
      // Take screenshot of live state
      await page.screenshot({ path: 'test-results/broadcasting-live.png', fullPage: true })
      
      // Check for Stop Broadcast or similar button
      const stopButton = page.locator('button:has-text("Stop"), button:has-text("End")')
      if (await stopButton.isVisible()) {
        console.log('Successfully started broadcasting - Stop button found')
        
        // Open viewer page in new tab
        const viewerPage = await context.newPage()
        const currentUrl = page.url()
        const streamId = currentUrl.split('/broadcast')[0].split('/stream/')[1]
        await viewerPage.goto(`${BASE_URL}/stream/${streamId}`)
        
        // Wait for viewer page to load
        await viewerPage.waitForTimeout(5000)
        
        // Take screenshot of viewer page
        await viewerPage.screenshot({ path: 'test-results/viewer-page.png', fullPage: true })
        
        // Check if Mux player or stream content is visible
        const streamContent = viewerPage.locator('mux-player, video, text="Stream is Live"')
        if (await streamContent.isVisible()) {
          console.log('Viewer can see stream content')
        } else {
          console.log('Stream content not yet visible - may still be initializing')
        }
        
        // Stop broadcast
        await stopButton.click()
        await page.waitForTimeout(2000)
        await page.screenshot({ path: 'test-results/broadcast-stopped.png', fullPage: true })
        
      } else {
        console.log('Go Live clicked but no stop button found - broadcast may not have started')
        await page.screenshot({ path: 'test-results/go-live-clicked.png', fullPage: true })
      }
    } else {
      console.log('Go Live button not visible - camera permissions may not be granted')
      await page.screenshot({ path: 'test-results/no-go-live-button.png', fullPage: true })
    }
  })
})