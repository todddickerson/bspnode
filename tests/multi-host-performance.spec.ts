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
  }
}

async function login(page: Page, user: typeof TEST_USERS.owner) {
  await page.goto('/login')
  await page.fill('input[name="email"]', user.email)
  await page.fill('input[name="password"]', user.password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard')
}

async function measurePerformance(page: Page, action: () => Promise<void>) {
  const startTime = Date.now()
  await action()
  const endTime = Date.now()
  return endTime - startTime
}

test.describe('Performance Tests', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['camera', 'microphone'])
  })

  test('Studio page load performance', async ({ page }) => {
    await login(page, TEST_USERS.owner)
    
    // Measure dashboard to studio navigation
    const loadTime = await measurePerformance(page, async () => {
      await page.goto('/dashboard')
      await page.click('text=New Stream')
      await page.fill('input[placeholder="Stream title"]', 'Performance Test')
      await page.click('text=Multi-Host Collaboration')
      await page.click('button:has-text("Create Stream")')
      await page.waitForSelector('video', { timeout: 10000 })
    })
    
    console.log(`Studio load time: ${loadTime}ms`)
    expect(loadTime).toBeLessThan(10000) // Should load within 10 seconds
  })

  test('Video connection time', async ({ page }) => {
    await login(page, TEST_USERS.owner)
    
    await page.goto('/dashboard')
    await page.click('text=New Stream')
    await page.fill('input[placeholder="Stream title"]', 'Connection Speed Test')
    await page.click('text=Multi-Host Collaboration')
    
    const connectionTime = await measurePerformance(page, async () => {
      await page.click('button:has-text("Create Stream")')
      // Wait for video element to have actual video stream
      await page.waitForFunction(() => {
        const video = document.querySelector('video') as HTMLVideoElement
        return video && video.videoWidth > 0 && video.videoHeight > 0
      }, { timeout: 15000 })
    })
    
    console.log(`Video connection time: ${connectionTime}ms`)
    expect(connectionTime).toBeLessThan(15000) // Should connect within 15 seconds
  })

  test('Multi-host join time scaling', async ({ browser }) => {
    const ownerContext = await browser.newContext()
    const ownerPage = await ownerContext.newPage()
    
    await login(ownerPage, TEST_USERS.owner)
    await ownerPage.goto('/dashboard')
    await ownerPage.click('text=New Stream')
    await ownerPage.fill('input[placeholder="Stream title"]', 'Join Time Test')
    await ownerPage.click('text=Multi-Host Collaboration')
    await ownerPage.click('button:has-text("Create Stream")')
    await ownerPage.waitForSelector('video')
    
    const streamId = ownerPage.url().match(/\/stream\/(.+)\/studio/)?.[1]
    
    // Measure time for additional hosts to join
    const joinTimes: number[] = []
    
    for (let i = 0; i < 3; i++) {
      const hostContext = await browser.newContext()
      const hostPage = await hostContext.newPage()
      
      await login(hostPage, TEST_USERS.host1)
      
      const joinTime = await measurePerformance(hostPage, async () => {
        await hostPage.goto(`/stream/${streamId}/studio`)
        await hostPage.waitForSelector('video', { timeout: 15000 })
        // Wait for connection to stabilize
        await hostPage.waitForFunction(() => {
          const videos = document.querySelectorAll('video')
          return videos.length >= 2 // Should see at least owner's video
        }, { timeout: 10000 })
      })
      
      joinTimes.push(joinTime)
      console.log(`Host ${i + 1} join time: ${joinTime}ms`)
      
      // Keep context open to maintain connection
    }
    
    // Join times should not degrade significantly
    const avgJoinTime = joinTimes.reduce((a, b) => a + b, 0) / joinTimes.length
    console.log(`Average join time: ${avgJoinTime}ms`)
    expect(avgJoinTime).toBeLessThan(10000)
    
    // Check that later joins aren't significantly slower
    const firstJoin = joinTimes[0]
    const lastJoin = joinTimes[joinTimes.length - 1]
    expect(lastJoin).toBeLessThan(firstJoin * 2) // Should not be more than 2x slower
    
    await ownerContext.close()
  })

  test('Message latency in chat', async ({ browser }) => {
    const ownerContext = await browser.newContext()
    const host1Context = await browser.newContext()
    
    const ownerPage = await ownerContext.newPage()
    const host1Page = await host1Context.newPage()
    
    // Setup stream
    await login(ownerPage, TEST_USERS.owner)
    await ownerPage.goto('/dashboard')
    await ownerPage.click('text=New Stream')
    await ownerPage.fill('input[placeholder="Stream title"]', 'Chat Latency Test')
    await ownerPage.click('text=Multi-Host Collaboration')
    await ownerPage.click('button:has-text("Create Stream")')
    await ownerPage.waitForSelector('video')
    
    const streamId = ownerPage.url().match(/\/stream\/(.+)\/studio/)?.[1]
    
    // Join as host
    await login(host1Page, TEST_USERS.host1)
    await host1Page.goto(`/stream/${streamId}/studio`)
    await host1Page.waitForSelector('video')
    
    // Open chat
    await ownerPage.click('button[aria-label*="chat" i]')
    await host1Page.click('button[aria-label*="chat" i]')
    
    // Measure message delivery time
    const testMessage = `Latency test ${Date.now()}`
    
    const latency = await measurePerformance(host1Page, async () => {
      // Send message from owner
      await ownerPage.fill('textarea[placeholder*="message" i]', testMessage)
      await ownerPage.press('textarea[placeholder*="message" i]', 'Enter')
      
      // Wait for message to appear on host1's screen
      await host1Page.waitForSelector(`text=${testMessage}`, { timeout: 5000 })
    })
    
    console.log(`Chat message latency: ${latency}ms`)
    expect(latency).toBeLessThan(2000) // Should deliver within 2 seconds
    
    await ownerContext.close()
    await host1Context.close()
  })

  test('Resource usage with multiple video streams', async ({ page, browser }) => {
    // This test would ideally measure CPU/memory but Playwright doesn't expose those metrics
    // Instead, we'll test UI responsiveness with multiple streams
    
    await login(page, TEST_USERS.owner)
    await page.goto('/dashboard')
    await page.click('text=New Stream')
    await page.fill('input[placeholder="Stream title"]', 'Resource Test')
    await page.click('text=Multi-Host Collaboration')
    await page.click('button:has-text("Create Stream")')
    await page.waitForSelector('video')
    
    const streamId = page.url().match(/\/stream\/(.+)\/studio/)?.[1]
    
    // Add multiple hosts
    const contexts = []
    for (let i = 0; i < 3; i++) {
      const ctx = await browser.newContext()
      const p = await ctx.newPage()
      await login(p, TEST_USERS.host1)
      await p.goto(`/stream/${streamId}/studio`)
      await p.waitForSelector('video')
      contexts.push(ctx)
    }
    
    // Test UI responsiveness with all streams active
    const buttonClickTime = await measurePerformance(page, async () => {
      await page.click('button[aria-label*="video" i]') // Toggle video
      await page.waitForTimeout(100)
      await page.click('button[aria-label*="video" i]') // Toggle back
    })
    
    console.log(`UI response time with 4 streams: ${buttonClickTime}ms`)
    expect(buttonClickTime).toBeLessThan(500) // UI should remain responsive
    
    // Cleanup
    await Promise.all(contexts.map(ctx => ctx.close()))
  })

  test('Reconnection time after network drop', async ({ page, context }) => {
    await login(page, TEST_USERS.owner)
    await page.goto('/dashboard')
    await page.click('text=New Stream')
    await page.fill('input[placeholder="Stream title"]', 'Reconnection Test')
    await page.click('text=Multi-Host Collaboration')
    await page.click('button:has-text("Create Stream")')
    await page.waitForSelector('video')
    
    // Wait for stable connection
    await page.waitForTimeout(2000)
    
    // Measure reconnection time
    const reconnectTime = await measurePerformance(page, async () => {
      // Simulate network drop
      await context.setOffline(true)
      await page.waitForSelector('text=Reconnecting...', { timeout: 10000 })
      
      // Restore network
      await context.setOffline(false)
      await page.waitForSelector('text=Reconnected', { timeout: 30000 })
    })
    
    console.log(`Reconnection time: ${reconnectTime}ms`)
    expect(reconnectTime).toBeLessThan(30000) // Should reconnect within 30 seconds
  })

  test('Page memory stability over time', async ({ page }) => {
    // This test runs for a longer period to check for memory leaks
    test.setTimeout(120000) // 2 minute timeout
    
    await login(page, TEST_USERS.owner)
    await page.goto('/dashboard')
    await page.click('text=New Stream')
    await page.fill('input[placeholder="Stream title"]', 'Memory Stability Test')
    await page.click('text=Multi-Host Collaboration')
    await page.click('button:has-text("Create Stream")')
    await page.waitForSelector('video')
    
    // Perform repeated actions that could leak memory
    for (let i = 0; i < 10; i++) {
      // Toggle video
      await page.click('button[aria-label*="video" i]')
      await page.waitForTimeout(1000)
      await page.click('button[aria-label*="video" i]')
      await page.waitForTimeout(1000)
      
      // Toggle audio  
      await page.click('button[aria-label*="mic" i]')
      await page.waitForTimeout(1000)
      await page.click('button[aria-label*="mic" i]')
      await page.waitForTimeout(1000)
      
      // Open/close settings
      await page.click('button[aria-label*="settings" i]')
      await page.waitForTimeout(500)
      await page.click('button[aria-label*="settings" i]')
      await page.waitForTimeout(500)
    }
    
    // Page should still be responsive
    const finalResponseTime = await measurePerformance(page, async () => {
      await page.click('button[aria-label*="video" i]')
      await page.waitForTimeout(100)
    })
    
    console.log(`UI response after stress test: ${finalResponseTime}ms`)
    expect(finalResponseTime).toBeLessThan(500)
  })
})