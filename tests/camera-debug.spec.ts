import { test, expect, Page } from '@playwright/test'

// Get base URL from environment or default to localhost:3001
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Camera Access Debug', () => {
  test.beforeEach(async ({ context }) => {
    // Grant camera and microphone permissions
    await context.grantPermissions(['camera', 'microphone']);
  });

  test('debug camera access on broadcast page', async ({ page }) => {
    // Login first
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[id="email"]', 'testuser@example.com')
    await page.fill('input[id="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL(`${BASE_URL}/dashboard`)

    // Use an existing created stream - click Start Broadcasting on "Test Browser Stream"
    const startBroadcastingButton = page.locator('button:has-text("Start Broadcasting")').first()
    await startBroadcastingButton.click()
    await page.waitForURL(/\/broadcast/)

    // Take screenshot of broadcast page
    await page.screenshot({ path: 'test-results/broadcast-page-debug.png', fullPage: true })

    // Wait a bit for media initialization
    await page.waitForTimeout(5000)

    // Check for permission errors
    const permissionError = page.locator('text=/permission|camera|microphone/i')
    if (await permissionError.isVisible()) {
      console.log('Permission error found:', await permissionError.textContent())
      await page.screenshot({ path: 'test-results/permission-error.png', fullPage: true })
    }

    // Check if video element is present
    const video = page.locator('video')
    if (await video.isVisible()) {
      console.log('Video element found and visible')
      await page.screenshot({ path: 'test-results/video-visible.png', fullPage: true })
    } else {
      console.log('Video element not found or not visible')
      await page.screenshot({ path: 'test-results/no-video.png', fullPage: true })
    }

    // Check browser console for errors
    const logs: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        logs.push(`Console error: ${msg.text()}`)
      }
    })

    await page.waitForTimeout(2000)
    
    if (logs.length > 0) {
      console.log('Console errors found:', logs.join('\n'))
    }

    // Try to click start broadcast to see what happens
    const startButton = page.locator('button:has-text("Start Broadcast")')
    if (await startButton.isVisible()) {
      console.log('Start broadcast button is visible')
      await page.screenshot({ path: 'test-results/ready-to-broadcast.png', fullPage: true })
    } else {
      console.log('Start broadcast button not visible')
      await page.screenshot({ path: 'test-results/not-ready-to-broadcast.png', fullPage: true })
    }
  })
})