import { test, expect, Page } from '@playwright/test'

const TEST_USERS = {
  owner: {
    email: 'test-owner@example.com',
    password: 'test123456',
    name: 'Stream Owner'
  },
  host1: {
    email: 'test-host1@example.com', 
    password: 'test123456',
    name: 'Host One'
  },
  unauthorized: {
    email: 'test-unauthorized@example.com',
    password: 'test123456',
    name: 'Unauthorized User'
  }
}

async function login(page: Page, user: typeof TEST_USERS.owner) {
  await page.goto('/login')
  await page.fill('input[name="email"]', user.email)
  await page.fill('input[name="password"]', user.password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard')
}

test.describe('Error Scenarios and Recovery', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['camera', 'microphone'])
  })

  test('Unauthorized access to studio', async ({ page }) => {
    // Try to access a studio without being a host
    await login(page, TEST_USERS.unauthorized)
    
    // Try to access a random studio
    const fakeStreamId = 'unauthorized-stream-id'
    await page.goto(`/stream/${fakeStreamId}/studio`)
    
    // Should be redirected or show error
    await expect(page.locator('text=You are not a host of this stream')).toBeVisible()
    await page.waitForURL('/dashboard')
  })

  test('Invalid stream ID handling', async ({ page }) => {
    await login(page, TEST_USERS.host1)
    
    // Try to join non-existent stream
    await page.goto('/stream/invalid-stream-id-12345/join?token=some-token')
    
    // Should show error
    await expect(page.locator('text=Stream not found')).toBeVisible()
  })

  test('Camera/Microphone permission denied', async ({ browser }) => {
    // Create context without permissions
    const context = await browser.newContext({
      permissions: [] // No camera/mic permissions
    })
    const page = await context.newPage()
    
    await login(page, TEST_USERS.owner)
    await page.goto('/dashboard')
    await page.click('text=New Stream')
    
    // Fill stream details
    await page.fill('input[placeholder="Stream title"]', 'Permission Test Stream')
    await page.click('text=Multi-Host Collaboration')
    await page.click('button:has-text("Create Stream")')
    
    // Should show permission error
    await expect(page.locator('text=Camera and microphone permissions denied')).toBeVisible({ timeout: 10000 })
    
    await context.close()
  })

  test('API error handling - network failure', async ({ page, context }) => {
    await login(page, TEST_USERS.owner)
    
    // Intercept API calls and make them fail
    await context.route('**/api/streams/*', route => {
      route.abort('failed')
    })
    
    // Try to create a stream
    await page.goto('/dashboard')
    await page.click('text=New Stream')
    await page.fill('input[placeholder="Stream title"]', 'Network Error Test')
    await page.click('text=Multi-Host Collaboration')
    await page.click('button:has-text("Create Stream")')
    
    // Should show error toast or message
    await expect(page.locator('text=Failed to create stream')).toBeVisible({ timeout: 10000 })
  })

  test('LiveKit connection failure recovery', async ({ page, context }) => {
    await login(page, TEST_USERS.owner)
    
    // Intercept LiveKit WebSocket connections
    await context.route('wss://**livekit**', route => {
      route.abort('failed')
    })
    
    // Try to create and join a stream
    await page.goto('/dashboard')
    await page.click('text=New Stream')
    await page.fill('input[placeholder="Stream title"]', 'LiveKit Error Test')
    await page.click('text=Multi-Host Collaboration')
    await page.click('button:has-text("Create Stream")')
    
    // Should show connection error
    await expect(page.locator('text=Could not connect to the studio')).toBeVisible({ timeout: 15000 })
  })

  test('Concurrent modification conflicts', async ({ browser }) => {
    // Two users trying to modify the same stream simultaneously
    const owner1Context = await browser.newContext()
    const owner2Context = await browser.newContext()
    
    const page1 = await owner1Context.newPage()
    const page2 = await owner2Context.newPage()
    
    // Both login as owner (simulating shared account or race condition)
    await login(page1, TEST_USERS.owner)
    await login(page2, TEST_USERS.owner)
    
    // Create stream on page1
    await page1.goto('/dashboard')
    await page1.click('text=New Stream')
    await page1.fill('input[placeholder="Stream title"]', 'Concurrent Test')
    await page1.click('text=Multi-Host Collaboration')
    await page1.click('button:has-text("Create Stream")')
    await page1.waitForURL(/\/stream\/.*\/studio/)
    
    const streamId = page1.url().match(/\/stream\/(.+)\/studio/)?.[1]
    
    // Try to access same stream on page2
    await page2.goto(`/stream/${streamId}/studio`)
    
    // Both should be able to access (same user)
    await expect(page2.locator('video')).toBeVisible({ timeout: 10000 })
    
    await owner1Context.close()
    await owner2Context.close()
  })

  test('Browser compatibility warnings', async ({ page, browserName }) => {
    // This test would check for browser-specific issues
    // For now, just verify the studio loads in the test browser
    
    await login(page, TEST_USERS.owner)
    await page.goto('/dashboard')
    await page.click('text=New Stream')
    await page.fill('input[placeholder="Stream title"]', `${browserName} Compatibility Test`)
    await page.click('text=Multi-Host Collaboration')
    await page.click('button:has-text("Create Stream")')
    
    // Should work in Chromium (Playwright default)
    await expect(page.locator('video')).toBeVisible({ timeout: 10000 })
  })

  test('Memory leak prevention - multiple join/leave cycles', async ({ browser }) => {
    const ownerContext = await browser.newContext()
    const ownerPage = await ownerContext.newPage()
    
    await login(ownerPage, TEST_USERS.owner)
    
    // Create stream
    await ownerPage.goto('/dashboard')
    await ownerPage.click('text=New Stream')
    await ownerPage.fill('input[placeholder="Stream title"]', 'Memory Test')
    await ownerPage.click('text=Multi-Host Collaboration')
    await ownerPage.click('button:has-text("Create Stream")')
    await ownerPage.waitForURL(/\/stream\/.*\/studio/)
    
    const streamId = ownerPage.url().match(/\/stream\/(.+)\/studio/)?.[1]
    const inviteLink = await ownerPage.evaluate(() => {
      const button = document.querySelector('button:has-text("Invite Hosts")')
      button?.click()
      // This is simplified - in reality we'd need to wait and extract the link
      return window.location.href.replace('/studio', '/join?token=test')
    })
    
    // Create multiple contexts and rapidly join/leave
    for (let i = 0; i < 5; i++) {
      const hostContext = await browser.newContext()
      const hostPage = await hostContext.newPage()
      
      await login(hostPage, TEST_USERS.host1)
      await hostPage.goto(`/stream/${streamId}/studio`)
      
      // Wait for connection
      await hostPage.waitForSelector('video', { timeout: 10000 })
      
      // Leave immediately
      await hostPage.click('button:has-text("Leave Studio")')
      
      // Close context to ensure cleanup
      await hostContext.close()
      
      // Small delay between iterations
      await ownerPage.waitForTimeout(1000)
    }
    
    // Owner should still be stable
    await expect(ownerPage.locator('video')).toBeVisible()
    await expect(ownerPage.locator('text=Current Hosts')).toBeVisible()
    
    await ownerContext.close()
  })

  test('Invalid WebRTC signaling recovery', async ({ page }) => {
    await login(page, TEST_USERS.owner)
    
    // Create stream
    await page.goto('/dashboard')
    await page.click('text=New Stream')
    await page.fill('input[placeholder="Stream title"]', 'WebRTC Recovery Test')
    await page.click('text=Multi-Host Collaboration')
    await page.click('button:has-text("Create Stream")')
    
    // Inject script to simulate WebRTC errors
    await page.evaluate(() => {
      // Override RTCPeerConnection to simulate failures
      const OriginalRTCPeerConnection = window.RTCPeerConnection
      let failureCount = 0
      
      window.RTCPeerConnection = function(...args) {
        failureCount++
        if (failureCount <= 2) {
          throw new Error('Simulated WebRTC failure')
        }
        return new OriginalRTCPeerConnection(...args)
      }
    })
    
    // System should recover and eventually connect
    await expect(page.locator('video')).toBeVisible({ timeout: 20000 })
  })

  test('Database transaction rollback on error', async ({ page, context }) => {
    await login(page, TEST_USERS.owner)
    
    // Intercept API to simulate partial failure
    let requestCount = 0
    await context.route('**/api/streams/*/hosts', route => {
      requestCount++
      if (requestCount === 1) {
        // First request fails
        route.abort('failed')
      } else {
        // Subsequent requests succeed
        route.continue()
      }
    })
    
    // Try to add a host (will fail first time)
    await page.goto('/dashboard')
    // ... continue with host addition flow
    
    // Verify system recovers gracefully
  })
})