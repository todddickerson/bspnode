import { test, expect, Page } from '@playwright/test'
import { randomBytes } from 'crypto'

// Test accounts - you'll need to create these in your test database
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
  }
}

// Helper to login
async function login(page: Page, user: typeof TEST_USERS.owner) {
  await page.goto('/login')
  await page.fill('input[name="email"]', user.email)
  await page.fill('input[name="password"]', user.password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard')
}

// Helper to create a stream
async function createStream(page: Page) {
  await page.goto('/dashboard')
  await page.click('text=New Stream')
  
  const streamTitle = `Test Multi-Host ${randomBytes(4).toString('hex')}`
  await page.fill('input[placeholder="Stream title"]', streamTitle)
  await page.fill('textarea[placeholder="Stream description"]', 'Testing multi-host functionality')
  await page.click('text=Multi-Host Collaboration')
  await page.click('button:has-text("Create Stream")')
  
  // Wait for redirect to studio
  await page.waitForURL(/\/stream\/.*\/studio/)
  
  const streamId = page.url().match(/\/stream\/(.+)\/studio/)?.[1]
  return { streamId, streamTitle }
}

// Helper to generate invite link
async function generateInviteLink(page: Page): Promise<string> {
  // Click on invite hosts button
  await page.click('button:has-text("Invite Hosts")')
  await page.waitForSelector('text=Generate Invite Link')
  
  // Generate new invite
  await page.click('button:has-text("Generate New Invite")')
  await page.waitForSelector('input[readonly][value*="/stream/"]')
  
  // Copy the invite link
  const inviteInput = await page.locator('input[readonly][value*="/stream/"]').first()
  const inviteLink = await inviteInput.inputValue()
  
  // Close dialog
  await page.keyboard.press('Escape')
  
  return inviteLink
}

test.describe('Multi-Host Streaming', () => {
  test.beforeEach(async ({ context }) => {
    // Grant camera/microphone permissions
    await context.grantPermissions(['camera', 'microphone'])
  })

  test('Basic multi-host flow with 2 hosts', async ({ browser }) => {
    // Create two browser contexts for different users
    const ownerContext = await browser.newContext()
    const host1Context = await browser.newContext()
    
    const ownerPage = await ownerContext.newPage()
    const host1Page = await host1Context.newPage()
    
    // 1. Owner creates stream
    await login(ownerPage, TEST_USERS.owner)
    const { streamId } = await createStream(ownerPage)
    
    // Wait for studio to load
    await ownerPage.waitForSelector('video')
    await expect(ownerPage.locator('text=Current Hosts')).toBeVisible()
    
    // 2. Generate invite link
    const inviteLink = await generateInviteLink(ownerPage)
    expect(inviteLink).toContain('/join?token=')
    
    // 3. Host 1 joins via invite
    await login(host1Page, TEST_USERS.host1)
    await host1Page.goto(inviteLink)
    
    // Should see join page
    await expect(host1Page.locator('h1:has-text("Join as Co-Host")')).toBeVisible()
    await host1Page.click('button:has-text("Join as Co-Host")')
    
    // Should redirect to studio
    await host1Page.waitForURL(/\/stream\/.*\/studio/)
    await host1Page.waitForSelector('video')
    
    // 4. Verify both hosts see each other
    // Owner should see host1 joined notification
    await expect(ownerPage.locator('text=Host Joined').last()).toBeVisible()
    await expect(ownerPage.locator('text=Host One has joined the studio')).toBeVisible()
    
    // Check host list shows both users
    await expect(ownerPage.locator('text=Current Hosts')).toBeVisible()
    await expect(ownerPage.locator('text=Stream Owner')).toBeVisible()
    await expect(ownerPage.locator('text=Host One')).toBeVisible()
    
    // Check video grid has 2 videos
    const ownerVideos = await ownerPage.locator('.grid video').count()
    expect(ownerVideos).toBe(2)
    
    const host1Videos = await host1Page.locator('.grid video').count()
    expect(host1Videos).toBe(2)
    
    // 5. Host 1 leaves
    await host1Page.click('button:has-text("Leave Studio")')
    await host1Page.waitForURL('/dashboard')
    
    // Owner should see leave notification
    await expect(ownerPage.locator('text=Host Left').last()).toBeVisible()
    await expect(ownerPage.locator('text=Host One has left the studio')).toBeVisible()
    
    // Cleanup
    await ownerContext.close()
    await host1Context.close()
  })

  test('Host rejoin after leaving', async ({ browser }) => {
    const ownerContext = await browser.newContext()
    const host1Context = await browser.newContext()
    
    const ownerPage = await ownerContext.newPage()
    const host1Page = await host1Context.newPage()
    
    // Setup stream with host
    await login(ownerPage, TEST_USERS.owner)
    const { streamId } = await createStream(ownerPage)
    const inviteLink = await generateInviteLink(ownerPage)
    
    await login(host1Page, TEST_USERS.host1)
    await host1Page.goto(inviteLink)
    await host1Page.click('button:has-text("Join as Co-Host")')
    await host1Page.waitForURL(/\/stream\/.*\/studio/)
    
    // Host leaves
    await host1Page.click('button:has-text("Leave Studio")')
    await host1Page.waitForURL('/dashboard')
    
    // Host rejoins directly via studio URL (no invite needed)
    await host1Page.goto(`/stream/${streamId}/studio`)
    await host1Page.waitForSelector('video')
    
    // Should be able to access studio without new invite
    await expect(host1Page.locator('text=Current Hosts')).toBeVisible()
    await expect(ownerPage.locator('text=Host Joined').last()).toBeVisible()
    
    await ownerContext.close()
    await host1Context.close()
  })

  test('Multiple hosts (3+) with dynamic grid', async ({ browser }) => {
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(), 
      browser.newContext()
    ])
    
    const [ownerPage, host1Page, host2Page] = await Promise.all(
      contexts.map(ctx => ctx.newPage())
    )
    
    // Owner creates stream
    await login(ownerPage, TEST_USERS.owner)
    const { streamId } = await createStream(ownerPage)
    const inviteLink = await generateInviteLink(ownerPage)
    
    // Both hosts join
    await login(host1Page, TEST_USERS.host1)
    await host1Page.goto(inviteLink)
    await host1Page.click('button:has-text("Join as Co-Host")')
    await host1Page.waitForURL(/\/stream\/.*\/studio/)
    
    await login(host2Page, TEST_USERS.host2)
    await host2Page.goto(inviteLink)
    await host2Page.click('button:has-text("Join as Co-Host")')
    await host2Page.waitForURL(/\/stream\/.*\/studio/)
    
    // Check grid layout adjusts for 3 participants
    await ownerPage.waitForTimeout(2000) // Wait for all connections
    
    // All pages should show 3 videos
    for (const page of [ownerPage, host1Page, host2Page]) {
      const videoCount = await page.locator('.grid video').count()
      expect(videoCount).toBe(3)
      
      // Grid should have proper class for 3 participants
      await expect(page.locator('.grid.grid-cols-2')).toBeVisible()
    }
    
    // Check host list shows all 3
    await expect(ownerPage.locator('text=3 / ∞')).toBeVisible()
    
    await Promise.all(contexts.map(ctx => ctx.close()))
  })

  test('Host removal by owner', async ({ browser }) => {
    const ownerContext = await browser.newContext()
    const host1Context = await browser.newContext()
    
    const ownerPage = await ownerContext.newPage()
    const host1Page = await host1Context.newPage()
    
    // Setup
    await login(ownerPage, TEST_USERS.owner)
    const { streamId } = await createStream(ownerPage)
    const inviteLink = await generateInviteLink(ownerPage)
    
    await login(host1Page, TEST_USERS.host1)
    await host1Page.goto(inviteLink)
    await host1Page.click('button:has-text("Join as Co-Host")')
    await host1Page.waitForURL(/\/stream\/.*\/studio/)
    
    // Owner removes host
    await ownerPage.locator('button[title="Remove host"]').click()
    
    // Confirm removal
    await ownerPage.click('button:has-text("Remove")')
    
    // Host should be disconnected
    await expect(host1Page.locator('text=Disconnected')).toBeVisible()
    
    // Host cannot rejoin without new invite
    await host1Page.goto(`/stream/${streamId}/studio`)
    await expect(host1Page.locator('text=You are not a host of this stream')).toBeVisible()
    
    await ownerContext.close()
    await host1Context.close()
  })

  test('Connection status indicators', async ({ browser }) => {
    const ownerContext = await browser.newContext()
    const host1Context = await browser.newContext()
    
    const ownerPage = await ownerContext.newPage()
    const host1Page = await host1Context.newPage()
    
    // Setup
    await login(ownerPage, TEST_USERS.owner)
    const { streamId } = await createStream(ownerPage)
    const inviteLink = await generateInviteLink(ownerPage)
    
    // Check owner has green status
    await expect(ownerPage.locator('.bg-green-500').first()).toBeVisible()
    
    // Add host
    await login(host1Page, TEST_USERS.host1)
    await host1Page.goto(inviteLink)
    await host1Page.click('button:has-text("Join as Co-Host")')
    await host1Page.waitForURL(/\/stream\/.*\/studio/)
    
    // Both should show green for connected hosts
    await ownerPage.waitForTimeout(1000)
    const greenDots = await ownerPage.locator('.bg-green-500').count()
    expect(greenDots).toBe(2) // Both hosts connected
    
    await ownerContext.close()
    await host1Context.close()
  })

  test('Invalid invite scenarios', async ({ page }) => {
    await login(page, TEST_USERS.host1)
    
    // Try joining with no token
    await page.goto('/stream/fake-stream-id/join')
    await expect(page.locator('text=Valid Invite Required')).toBeVisible()
    
    // Try joining with invalid token
    await page.goto('/stream/fake-stream-id/join?token=invalid-token')
    await page.click('button:has-text("Join as Co-Host")')
    await expect(page.locator('text=Invalid invite')).toBeVisible()
  })
})

test.describe('Edge Cases', () => {
  test('Stream ends when owner leaves with no other hosts', async ({ browser }) => {
    const ownerContext = await browser.newContext()
    const ownerPage = await ownerContext.newPage()
    
    await login(ownerPage, TEST_USERS.owner)
    const { streamId } = await createStream(ownerPage)
    
    // Start broadcast
    await ownerPage.click('button:has-text("Go Live")')
    await ownerPage.waitForSelector('text=End Broadcast')
    
    // Owner leaves
    await ownerPage.click('button:has-text("Leave Studio")')
    
    // Stream should end
    // Check via API or database that stream status is ENDED
    
    await ownerContext.close()
  })
  
  test('Rapid join/leave handling', async ({ browser }) => {
    const ownerContext = await browser.newContext()
    const host1Context = await browser.newContext()
    
    const ownerPage = await ownerContext.newPage()
    const host1Page = await host1Context.newPage()
    
    await login(ownerPage, TEST_USERS.owner)
    const { streamId } = await createStream(ownerPage)
    const inviteLink = await generateInviteLink(ownerPage)
    
    await login(host1Page, TEST_USERS.host1)
    
    // Rapidly join and leave multiple times
    for (let i = 0; i < 3; i++) {
      await host1Page.goto(inviteLink)
      await host1Page.click('button:has-text("Join as Co-Host")')
      await host1Page.waitForURL(/\/stream\/.*\/studio/)
      await host1Page.waitForTimeout(500)
      
      await host1Page.click('button:has-text("Leave Studio")')
      await host1Page.waitForURL('/dashboard')
      await host1Page.waitForTimeout(500)
    }
    
    // System should handle this gracefully
    // Final rejoin should work
    await host1Page.goto(`/stream/${streamId}/studio`)
    await expect(host1Page.locator('text=Current Hosts')).toBeVisible()
    
    await ownerContext.close()
    await host1Context.close()
  })
})