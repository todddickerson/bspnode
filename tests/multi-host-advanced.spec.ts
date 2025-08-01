import { test, expect, Page, BrowserContext } from '@playwright/test'
import { randomBytes } from 'crypto'

// Test accounts
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
  host2: {
    email: 'test-host2@example.com',
    password: 'test123456', 
    name: 'Host Two'
  },
  host3: {
    email: 'test-host3@example.com',
    password: 'test123456',
    name: 'Host Three'
  }
}

async function login(page: Page, user: typeof TEST_USERS.owner) {
  await page.goto('/login')
  await page.fill('input[name="email"]', user.email)
  await page.fill('input[name="password"]', user.password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard')
}

async function createStream(page: Page) {
  await page.goto('/dashboard')
  await page.click('text=New Stream')
  
  const streamTitle = `Test Multi-Host ${randomBytes(4).toString('hex')}`
  await page.fill('input[placeholder="Stream title"]', streamTitle)
  await page.fill('textarea[placeholder="Stream description"]', 'Testing multi-host functionality')
  await page.click('text=Multi-Host Collaboration')
  await page.click('button:has-text("Create Stream")')
  
  await page.waitForURL(/\/stream\/.*\/studio/)
  const streamId = page.url().match(/\/stream\/(.+)\/studio/)?.[1]
  return { streamId, streamTitle }
}

async function generateInviteLink(page: Page): Promise<string> {
  await page.click('button:has-text("Invite Hosts")')
  await page.waitForSelector('text=Generate Invite Link')
  await page.click('button:has-text("Generate New Invite")')
  await page.waitForSelector('input[readonly][value*="/stream/"]')
  
  const inviteInput = await page.locator('input[readonly][value*="/stream/"]').first()
  const inviteLink = await inviteInput.inputValue()
  await page.keyboard.press('Escape')
  
  return inviteLink
}

test.describe('Advanced Multi-Host Scenarios', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['camera', 'microphone'])
  })

  test('Network disconnection and reconnection', async ({ browser, context }) => {
    const ownerPage = await context.newPage()
    const host1Context = await browser.newContext()
    const host1Page = await host1Context.newPage()
    
    // Setup stream
    await login(ownerPage, TEST_USERS.owner)
    const { streamId } = await createStream(ownerPage)
    const inviteLink = await generateInviteLink(ownerPage)
    
    await login(host1Page, TEST_USERS.host1)
    await host1Page.goto(inviteLink)
    await host1Page.click('button:has-text("Join as Co-Host")')
    await host1Page.waitForURL(/\/stream\/.*\/studio/)
    
    // Verify both connected
    await expect(ownerPage.locator('.bg-green-500')).toHaveCount(2)
    
    // Simulate network disconnection for host1
    await host1Page.context().setOffline(true)
    
    // Should show reconnecting state
    await expect(host1Page.locator('text=Reconnecting...')).toBeVisible({ timeout: 10000 })
    
    // Owner should see host1 as disconnected
    await expect(ownerPage.locator('.bg-gray-500')).toBeVisible({ timeout: 10000 })
    
    // Reconnect
    await host1Page.context().setOffline(false)
    
    // Should reconnect
    await expect(host1Page.locator('text=Reconnected')).toBeVisible({ timeout: 15000 })
    
    // Both should show as connected again
    await expect(ownerPage.locator('.bg-green-500')).toHaveCount(2, { timeout: 10000 })
    
    await host1Context.close()
  })

  test('Stream continues when owner leaves with other hosts', async ({ browser }) => {
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext()
    ])
    
    const [ownerPage, host1Page] = await Promise.all(
      contexts.map(ctx => ctx.newPage())
    )
    
    // Setup
    await login(ownerPage, TEST_USERS.owner)
    const { streamId } = await createStream(ownerPage)
    const inviteLink = await generateInviteLink(ownerPage)
    
    // Start broadcast
    await ownerPage.click('button:has-text("Go Live")')
    await ownerPage.waitForSelector('text=End Broadcast')
    
    // Add host
    await login(host1Page, TEST_USERS.host1)
    await host1Page.goto(inviteLink)
    await host1Page.click('button:has-text("Join as Co-Host")')
    await host1Page.waitForURL(/\/stream\/.*\/studio/)
    
    // Owner leaves
    await ownerPage.click('button:has-text("Leave Studio")')
    await ownerPage.waitForURL('/dashboard')
    
    // Stream should continue with remaining host
    await expect(host1Page.locator('text=LIVE')).toBeVisible()
    await expect(host1Page.locator('text=End Broadcast')).toBeVisible()
    
    // Host can end the stream
    await host1Page.click('button:has-text("End Broadcast")')
    await host1Page.waitForURL(`/stream/${streamId}`)
    
    await Promise.all(contexts.map(ctx => ctx.close()))
  })

  test('Invite expiration handling', async ({ browser, page }) => {
    // This would require setting up an invite with a short expiration
    // For now, we'll test the UI behavior with an expired token
    
    await login(page, TEST_USERS.host1)
    
    // Simulate expired invite
    const fakeStreamId = 'test-stream-id'
    const expiredToken = 'expired-token-12345'
    
    await page.goto(`/stream/${fakeStreamId}/join?token=${expiredToken}`)
    await page.click('button:has-text("Join as Co-Host")')
    
    // Should show error
    await expect(page.locator('text=Invalid invite')).toBeVisible()
  })

  test('Maximum simultaneous hosts stress test', async ({ browser }) => {
    // Create 5 hosts to test the system
    const ownerContext = await browser.newContext()
    const ownerPage = await ownerContext.newPage()
    
    await login(ownerPage, TEST_USERS.owner)
    const { streamId } = await createStream(ownerPage)
    const inviteLink = await generateInviteLink(ownerPage)
    
    // Create multiple host contexts
    const hostContexts: BrowserContext[] = []
    const hostPages: Page[] = []
    
    // Add 4 additional hosts (5 total including owner)
    for (let i = 0; i < 4; i++) {
      const context = await browser.newContext()
      const page = await context.newPage()
      
      // Create test user for this host
      const testUser = {
        email: `test-host${i + 10}@example.com`,
        password: 'test123456',
        name: `Host ${i + 10}`
      }
      
      // For this test, we'll reuse existing users
      const userToUse = i === 0 ? TEST_USERS.host1 : 
                        i === 1 ? TEST_USERS.host2 : 
                        i === 2 ? TEST_USERS.host3 : TEST_USERS.host1
      
      await login(page, userToUse)
      await page.goto(inviteLink)
      await page.click('button:has-text("Join as Co-Host")')
      await page.waitForURL(/\/stream\/.*\/studio/)
      
      hostContexts.push(context)
      hostPages.push(page)
      
      // Wait a bit between joins to avoid overwhelming the system
      await page.waitForTimeout(1000)
    }
    
    // Check that all hosts see each other
    await ownerPage.waitForTimeout(3000) // Wait for all connections to stabilize
    
    // Owner should see 5 hosts total (including themselves)
    await expect(ownerPage.locator('text=5 / ∞')).toBeVisible()
    
    // Check video grid shows proper layout
    const videoCount = await ownerPage.locator('.grid video').count()
    expect(videoCount).toBe(5)
    
    // Should use 3-column grid for 5+ participants
    await expect(ownerPage.locator('.grid.grid-cols-3')).toBeVisible()
    
    // Clean up
    await ownerContext.close()
    await Promise.all(hostContexts.map(ctx => ctx.close()))
  })

  test('Audio/Video toggle synchronization', async ({ browser }) => {
    const ownerContext = await browser.newContext()
    const host1Context = await browser.newContext()
    
    const ownerPage = await ownerContext.newPage()
    const host1Page = await host1Context.newPage()
    
    await login(ownerPage, TEST_USERS.owner)
    const { streamId } = await createStream(ownerPage)
    const inviteLink = await generateInviteLink(ownerPage)
    
    await login(host1Page, TEST_USERS.host1)
    await host1Page.goto(inviteLink)
    await host1Page.click('button:has-text("Join as Co-Host")')
    await host1Page.waitForURL(/\/stream\/.*\/studio/)
    
    // Host1 toggles video off
    await host1Page.click('button[aria-label*="video" i]')
    
    // Owner should see host1's video as disabled (implementation dependent)
    // This would require checking video track state
    
    // Host1 toggles audio off
    await host1Page.click('button[aria-label*="mic" i]')
    
    // Clean up
    await ownerContext.close()
    await host1Context.close()
  })

  test('Chat functionality during multi-host stream', async ({ browser }) => {
    const ownerContext = await browser.newContext()
    const host1Context = await browser.newContext()
    
    const ownerPage = await ownerContext.newPage()
    const host1Page = await host1Context.newPage()
    
    await login(ownerPage, TEST_USERS.owner)
    const { streamId } = await createStream(ownerPage)
    const inviteLink = await generateInviteLink(ownerPage)
    
    await login(host1Page, TEST_USERS.host1)
    await host1Page.goto(inviteLink)
    await host1Page.click('button:has-text("Join as Co-Host")')
    await host1Page.waitForURL(/\/stream\/.*\/studio/)
    
    // Open chat on both sides
    await ownerPage.click('button[aria-label*="chat" i]')
    await host1Page.click('button[aria-label*="chat" i]')
    
    // Owner sends message
    const ownerMessage = `Test message from owner ${Date.now()}`
    await ownerPage.fill('textarea[placeholder*="message" i]', ownerMessage)
    await ownerPage.press('textarea[placeholder*="message" i]', 'Enter')
    
    // Both should see the message
    await expect(ownerPage.locator(`text=${ownerMessage}`)).toBeVisible()
    await expect(host1Page.locator(`text=${ownerMessage}`)).toBeVisible()
    
    // Host1 sends message
    const host1Message = `Test message from host1 ${Date.now()}`
    await host1Page.fill('textarea[placeholder*="message" i]', host1Message)
    await host1Page.press('textarea[placeholder*="message" i]', 'Enter')
    
    // Both should see the message
    await expect(ownerPage.locator(`text=${host1Message}`)).toBeVisible()
    await expect(host1Page.locator(`text=${host1Message}`)).toBeVisible()
    
    await ownerContext.close()
    await host1Context.close()
  })

  test('Hearts animation visibility toggle', async ({ browser }) => {
    const ownerContext = await browser.newContext()
    const host1Context = await browser.newContext()
    
    const ownerPage = await ownerContext.newPage()
    const host1Page = await host1Context.newPage()
    
    await login(ownerPage, TEST_USERS.owner)
    const { streamId } = await createStream(ownerPage)
    const inviteLink = await generateInviteLink(ownerPage)
    
    // Go live first
    await ownerPage.click('button:has-text("Go Live")')
    await ownerPage.waitForSelector('text=End Broadcast')
    
    // Add viewer
    await login(host1Page, TEST_USERS.host1)
    await host1Page.goto(`/stream/${streamId}`) // Join as viewer, not host
    
    // Viewer sends hearts
    await host1Page.click('.aspect-video') // Click video area to send heart
    await host1Page.waitForTimeout(500)
    
    // Owner should see heart count increase
    await expect(ownerPage.locator('text=/[1-9]\\d*/')).toBeVisible()
    
    // Toggle hearts off
    await ownerPage.click('button[title*="heart" i]')
    
    // Send more hearts
    await host1Page.click('.aspect-video')
    
    // Hearts should still count but not animate (UI dependent)
    
    await ownerContext.close()
    await host1Context.close()
  })

  test('Device switching during active stream', async ({ page }) => {
    await login(page, TEST_USERS.owner)
    const { streamId } = await createStream(page)
    
    // Open settings
    await page.click('button[aria-label*="settings" i]')
    
    // Should see device dropdowns
    await expect(page.locator('select:has-text("Camera")')).toBeVisible()
    await expect(page.locator('select:has-text("Microphone")')).toBeVisible()
    
    // Device switching would require actual devices or mocking
    // This test verifies the UI is present
  })

  test('Stream recording with multiple hosts', async ({ browser }) => {
    const ownerContext = await browser.newContext()
    const host1Context = await browser.newContext()
    
    const ownerPage = await ownerContext.newPage()
    const host1Page = await host1Context.newPage()
    
    await login(ownerPage, TEST_USERS.owner)
    const { streamId } = await createStream(ownerPage)
    const inviteLink = await generateInviteLink(ownerPage)
    
    await login(host1Page, TEST_USERS.host1)
    await host1Page.goto(inviteLink)
    await host1Page.click('button:has-text("Join as Co-Host")')
    await host1Page.waitForURL(/\/stream\/.*\/studio/)
    
    // Start broadcast (which should start recording)
    await ownerPage.click('button:has-text("Go Live")')
    await ownerPage.waitForSelector('text=End Broadcast')
    
    // Wait a bit for recording
    await ownerPage.waitForTimeout(5000)
    
    // End broadcast
    await ownerPage.click('button:has-text("End Broadcast")')
    
    // Should redirect to stream page
    await ownerPage.waitForURL(`/stream/${streamId}`)
    
    // Should show recording is processing
    await expect(ownerPage.locator('text=Recording is being processed')).toBeVisible()
    
    await ownerContext.close()
    await host1Context.close()
  })
})