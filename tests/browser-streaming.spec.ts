import { test, expect, Page } from '@playwright/test'

// Get base URL from environment or default to localhost:3001
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// Helper function to login
async function login(page: Page, email: string = 'test@example.com', password: string = 'password123') {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(`${BASE_URL}/dashboard`)
}

// Helper to create a browser stream
async function createBrowserStream(page: Page, title: string) {
  await page.click('a:has-text("Create Stream")')
  await page.fill('input[name="title"]', title)
  await page.fill('textarea[name="description"]', 'Test browser stream')
  await page.selectOption('select[name="streamType"]', 'BROWSER')
  await page.click('button:has-text("Create Stream")')
  await page.waitForURL(/\/stream\/.*/)
}

test.describe('Browser Streaming with LiveKit to Mux', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing test data
    await page.goto('/api/test/reset', { method: 'POST' }).catch(() => {})
  })

  test('complete browser streaming flow', async ({ page, context }) => {
    // Step 1: Login as broadcaster
    await login(page)
    
    // Step 2: Create a browser stream
    const streamTitle = `Browser Stream ${Date.now()}`
    await createBrowserStream(page, streamTitle)
    
    // Get stream ID from URL
    const streamUrl = page.url()
    const streamId = streamUrl.split('/stream/')[1]
    
    // Step 3: Navigate to broadcast page
    await page.click('a:has-text("Start Broadcasting")')
    await page.waitForURL(`/stream/${streamId}/broadcast`)
    
    // Step 4: Grant camera/microphone permissions and start broadcast
    // Grant permissions before clicking start
    await context.grantPermissions(['camera', 'microphone'])
    
    // Wait for video preview
    await page.waitForSelector('video', { timeout: 10000 })
    
    // Click start broadcast
    await page.click('button:has-text("Start Broadcast")')
    
    // Wait for live status
    await page.waitForSelector('text=Live!', { timeout: 10000 })
    await expect(page.locator('button:has-text("Stop Broadcast")')).toBeVisible()
    
    // Step 5: Open viewer page in new tab
    const viewerPage = await context.newPage()
    await viewerPage.goto(`${BASE_URL}/stream/${streamId}`)
    
    // Step 6: Verify viewer can see the stream
    // Wait for either Mux player or loading state
    await viewerPage.waitForSelector('[data-testid="mux-player"], text="Stream is Live"', { timeout: 30000 })
    
    // Verify stream info is displayed
    await expect(viewerPage.locator(`h1:has-text("${streamTitle}")`)).toBeVisible()
    await expect(viewerPage.locator('.text-red-600:has-text("LIVE")')).toBeVisible()
    
    // Step 7: Test chat functionality
    const chatMessage = `Test message ${Date.now()}`
    await viewerPage.fill('input[placeholder*="Type a message"]', chatMessage)
    await viewerPage.press('input[placeholder*="Type a message"]', 'Enter')
    
    // Verify message appears in chat
    await expect(viewerPage.locator(`text="${chatMessage}"`)).toBeVisible({ timeout: 5000 })
    
    // Step 8: Stop broadcast
    await page.click('button:has-text("Stop Broadcast")')
    
    // Confirm stop
    const confirmButton = page.locator('button:has-text("Yes, stop broadcast")')
    if (await confirmButton.isVisible()) {
      await confirmButton.click()
    }
    
    // Wait for redirect to dashboard or stream page
    await page.waitForURL(/\/(dashboard|stream\/.*)/, { timeout: 30000 })
    
    // Step 9: Verify stream has ended on viewer page
    await viewerPage.reload()
    await expect(viewerPage.locator('text=Stream Ended')).toBeVisible({ timeout: 10000 })
  })

  test('viewer experience with Mux HLS playback', async ({ page, context }) => {
    // Create a stream and start broadcasting
    await login(page)
    const streamTitle = `HLS Test ${Date.now()}`
    await createBrowserStream(page, streamTitle)
    
    const streamUrl = page.url()
    const streamId = streamUrl.split('/stream/')[1]
    
    // Start broadcasting
    await page.click('a:has-text("Start Broadcasting")')
    await context.grantPermissions(['camera', 'microphone'])
    await page.waitForSelector('video', { timeout: 10000 })
    await page.click('button:has-text("Start Broadcast")')
    await page.waitForSelector('text=Live!', { timeout: 10000 })
    
    // Open viewer page
    const viewerPage = await context.newPage()
    await viewerPage.goto(`${BASE_URL}/stream/${streamId}`)
    
    // Verify Mux player loads
    const muxPlayer = viewerPage.locator('mux-player')
    await expect(muxPlayer).toBeVisible({ timeout: 30000 })
    
    // Verify player attributes
    await expect(muxPlayer).toHaveAttribute('stream-type', 'live')
    await expect(muxPlayer).toHaveAttribute('autoplay', '')
    
    // Test viewer count updates
    const viewerCount = viewerPage.locator('text=/\\d+ viewer/')
    await expect(viewerCount).toBeVisible()
    
    // Test hearts/reactions
    await viewerPage.click('[data-testid="heart-button"], button:has-text("❤️")')
    
    // Clean up - stop broadcast
    await page.click('button:has-text("Stop Broadcast")')
  })

  test('error handling and recovery', async ({ page, context }) => {
    await login(page)
    
    // Create stream but don't grant permissions
    const streamTitle = `Error Test ${Date.now()}`
    await createBrowserStream(page, streamTitle)
    
    const streamUrl = page.url()
    const streamId = streamUrl.split('/stream/')[1]
    
    await page.click('a:has-text("Start Broadcasting")')
    
    // Deny permissions
    await context.grantPermissions([])
    
    // Try to start broadcast without permissions
    const startButton = page.locator('button:has-text("Start Broadcast")')
    
    // Verify permission error is handled gracefully
    if (await startButton.isVisible()) {
      // Some browsers might show the button but broadcasting will fail
      await expect(page.locator('text=/permission|camera|microphone/i')).toBeVisible({ timeout: 10000 })
    }
  })

  test('stream health monitoring', async ({ page, context }) => {
    // Create and start a stream
    await login(page)
    const streamTitle = `Health Test ${Date.now()}`
    await createBrowserStream(page, streamTitle)
    
    const streamUrl = page.url()
    const streamId = streamUrl.split('/stream/')[1]
    
    await page.click('a:has-text("Start Broadcasting")')
    await context.grantPermissions(['camera', 'microphone'])
    await page.waitForSelector('video')
    await page.click('button:has-text("Start Broadcast")')
    await page.waitForSelector('text=Live!')
    
    // Check stream health via API
    const response = await page.request.get(`/api/streams/${streamId}/health`)
    expect(response.ok()).toBeTruthy()
    
    const health = await response.json()
    expect(health.stream.status).toBe('LIVE')
    expect(health.livekit.hasRoom).toBeTruthy()
    expect(health.mux.hasStream).toBeTruthy()
    
    // Clean up
    await page.click('button:has-text("Stop Broadcast")')
  })
})