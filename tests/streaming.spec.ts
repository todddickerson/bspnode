import { test, expect } from '@playwright/test';

// Get base URL from environment or default to ${BASE_URL}
const BASE_URL = process.env.BASE_URL || 'http://${BASE_URL}';

test.describe('BSPNode Streaming Tests', () => {
  let testUser: { email: string; password: string; name: string };

  test.beforeAll(async () => {
    // Use a static test user that's already created in the database
    testUser = {
      email: 'testuser@example.com',
      password: 'password123',
      name: 'Test User'
    };
  });

  test.beforeEach(async ({ page }) => {
    // Grant camera and microphone permissions
    await page.context().grantPermissions(['camera', 'microphone']);
  });

  async function loginUser(page: any) {
    // Clear any existing cookies/session
    await page.context().clearCookies();
    
    // Go to login page
    await page.goto(`${BASE_URL}/login`);
    
    // Login with the pre-created test user
    await page.fill('input[id="email"]', testUser.email);
    await page.fill('input[id="password"]', testUser.password);
    await page.click('button[type="submit"]');
    
    // Wait for either redirect to dashboard or error
    try {
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      console.log('Login successful, redirected to dashboard');
    } catch (error) {
      console.log('Login failed, checking for error messages');
      // Check if there's an error message
      const errorMessages = await page.locator('[role="alert"], .text-red-600, .text-destructive').allTextContents();
      console.log('Error messages:', errorMessages);
      
      // Take a screenshot of the current state
      await page.screenshot({ path: 'test-results/login-failed-debug.png', fullPage: true });
      throw new Error(`Login failed. Current URL: ${page.url()}. Error messages: ${errorMessages.join(', ')}`);
    }
  }

  test('should load the homepage', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/BSPNode/);
    await page.screenshot({ path: 'test-results/homepage.png', fullPage: true });
  });

  test('should login user', async ({ page }) => {
    await loginUser(page);
    await expect(page.locator('h1')).toContainText('Dashboard');
    await page.screenshot({ path: 'test-results/dashboard.png', fullPage: true });
  });

  test('should create a new stream', async ({ page }) => {
    await loginUser(page);
    
    // Click to open the create stream form
    await page.click('button:has-text("Create New Stream")');
    
    // Wait for form to appear and fill stream details
    await page.fill('input[placeholder="My awesome stream"]', 'Test Browser Stream');
    
    // Select Solo Browser Stream option (this should be already selected)
    await page.click('text=Solo Browser Stream');
    
    // Submit form
    await page.click('button:has-text("Create Stream")');
    
    // Wait for redirect to stream page
    await page.waitForURL('**/stream/*/broadcast');
    await page.screenshot({ path: 'test-results/stream-created.png', fullPage: true });
  });

  test('should show broadcast interface with camera preview', async ({ page }) => {
    await loginUser(page);
    
    // Create a new browser stream
    await page.click('button:has-text("Create New Stream")');
    await page.fill('input[placeholder="My awesome stream"]', 'Camera Test Stream');
    await page.click('text=Solo Browser Stream');
    await page.click('button:has-text("Create Stream")');
    
    // Wait for broadcast page
    await page.waitForURL('**/stream/*/broadcast');
    
    // Wait for camera permissions and preview
    await page.waitForSelector('video', { timeout: 10000 });
    
    // Check that video element is present and playing
    const video = page.locator('video');
    await expect(video).toBeVisible();
    
    // Check that Go Live button is enabled (after permissions granted)
    await page.waitForSelector('button:has-text("Go Live"):not([disabled])', { timeout: 5000 });
    
    await page.screenshot({ path: 'test-results/broadcast-interface.png', fullPage: true });
  });

  test('should start and stop a browser stream', async ({ page }) => {
    await loginUser(page);
    
    // Create and navigate to browser stream
    await page.click('button:has-text("Create New Stream")');
    await page.fill('input[placeholder="My awesome stream"]', 'Live Test Stream');
    await page.click('text=Solo Browser Stream');
    await page.click('button:has-text("Create Stream")');
    
    // Wait for broadcast page and camera
    await page.waitForURL('**/stream/*/broadcast');
    await page.waitForSelector('video', { timeout: 10000 });
    
    // Start streaming
    await page.waitForSelector('button:has-text("Go Live"):not([disabled])');
    await page.click('button:has-text("Go Live")');
    
    // Wait for live indicator - look for the red live badge specifically
    await page.waitForSelector('.bg-red-600:has-text("LIVE")', { timeout: 5000 });
    await expect(page.locator('.bg-red-600:has-text("LIVE")')).toBeVisible();
    
    await page.screenshot({ path: 'test-results/stream-live.png', fullPage: true });
    
    // Stop streaming after a few seconds
    await page.waitForTimeout(3000);
    await page.click('button:has-text("End Broadcast")');
    
    // Wait for redirect to ended page
    await page.waitForURL('**/stream/*/ended', { timeout: 10000 });
    await page.screenshot({ path: 'test-results/stream-ended.png', fullPage: true });
  });

  test('should test chat functionality', async ({ page, context }) => {
    // Create a new page for viewer
    const viewerPage = await context.newPage();
    await viewerPage.context().grantPermissions(['camera', 'microphone']);
    
    // Broadcaster: Create and start stream
    await loginUser(page);
    await page.click('button:has-text("Create New Stream")');
    await page.fill('input[placeholder="My awesome stream"]', 'Chat Test Stream');
    await page.click('text=Solo Browser Stream');
    await page.click('button:has-text("Create Stream")');
    
    // Get stream URL from broadcast page
    await page.waitForURL('**/stream/*/broadcast');
    const url = page.url();
    const streamId = url.match(/stream\/([^\/]+)\/broadcast/)?.[1];
    const viewerUrl = `http://${BASE_URL}/stream/${streamId}`;
    
    // Start the stream
    await page.waitForSelector('video', { timeout: 10000 });
    await page.waitForSelector('button:has-text("Go Live"):not([disabled])');
    await page.click('button:has-text("Go Live")');
    await page.waitForSelector('text=LIVE');
    
    // Viewer: Navigate to stream
    await viewerPage.goto(viewerUrl);
    await viewerPage.waitForSelector('text=Live Chat');
    
    // Test chat - viewer sends message
    await viewerPage.fill('input[placeholder="Type a message..."]', 'Hello from viewer!');
    await viewerPage.press('input[placeholder="Type a message..."]', 'Enter');
    
    // Verify message appears in chat
    await viewerPage.waitForSelector('text=Hello from viewer!');
    await expect(viewerPage.locator('text=Hello from viewer!')).toBeVisible();
    
    await page.screenshot({ path: 'test-results/chat-broadcaster.png', fullPage: true });
    await viewerPage.screenshot({ path: 'test-results/chat-viewer.png', fullPage: true });
    
    // Test that chat history persists - refresh viewer page
    await viewerPage.reload();
    await viewerPage.waitForSelector('text=Live Chat');
    
    // Message should still be there (loaded from database)
    await expect(viewerPage.locator('text=Hello from viewer!')).toBeVisible();
    
    await viewerPage.screenshot({ path: 'test-results/chat-persistence.png', fullPage: true });
  });
});