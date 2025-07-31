import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test('direct studio navigation test', async ({ page, context }) => {
  await context.grantPermissions(['camera', 'microphone']);
  
  console.log('🔍 Direct Studio Navigation Test\n');
  
  // Step 1: Login
  console.log('1️⃣ Logging in...');
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[id="email"]', 'testuser@example.com')
  await page.fill('input[id="password"]', 'password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 10000 })
  console.log('✅ Login successful\n');
  
  // Step 2: Get any existing stream
  console.log('2️⃣ Finding existing streams...');
  
  const streams = await page.evaluate(async () => {
    const response = await fetch('/api/streams');
    if (response.ok) {
      return await response.json();
    }
    return [];
  });
  
  console.log(`Found ${streams.length} streams`);
  
  if (streams.length === 0) {
    console.log('❌ No streams found. Creating one...');
    
    const createResponse = await page.evaluate(async () => {
      const response = await fetch('/api/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Studio Stream',
          description: 'For testing',
          streamType: 'LIVEKIT',
          maxHosts: 4
        }),
      });
      return await response.json();
    });
    
    streams.push(createResponse);
  }
  
  const testStream = streams[0];
  console.log(`\nUsing stream: ${testStream.title} (${testStream.id})`);
  console.log(`Type: ${testStream.streamType}`);
  console.log(`Status: ${testStream.status}\n`);
  
  // Step 3: Navigate directly to studio
  console.log('3️⃣ Navigating directly to studio...');
  const studioUrl = `${BASE_URL}/stream/${testStream.id}/studio`;
  console.log(`URL: ${studioUrl}`);
  
  await page.goto(studioUrl);
  await page.waitForTimeout(3000);
  
  // Check where we ended up
  const currentUrl = page.url();
  console.log(`\nCurrent URL: ${currentUrl}`);
  console.log(`On studio page: ${currentUrl.includes('/studio') ? '✅ Yes' : '❌ No'}`);
  
  // Check page content
  const pageTitle = await page.title();
  const h1Text = await page.locator('h1').first().textContent().catch(() => 'No H1');
  
  console.log(`\nPage title: ${pageTitle}`);
  console.log(`H1 text: ${h1Text}`);
  
  // Look for studio elements
  const elements = {
    joinButton: await page.locator('button:has-text("Join Studio")').isVisible(),
    leaveButton: await page.locator('button:has-text("Leave Studio")').isVisible(),
    goLiveButton: await page.locator('button:has-text("Go Live")').isVisible(),
    controls: await page.locator('text="Controls"').isVisible(),
    inviteSection: await page.locator('text="Invite Co-hosts"').isVisible(),
    videoElement: await page.locator('video').first().isVisible(),
  };
  
  console.log('\n🎯 Studio Elements:');
  Object.entries(elements).forEach(([key, visible]) => {
    console.log(`   ${key}: ${visible ? '✅' : '❌'}`);
  });
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/studio-direct-nav.png', fullPage: true });
  
  // If we're not on studio page, check if we need different permissions
  if (!currentUrl.includes('/studio')) {
    console.log('\n⚠️  Not on studio page. Checking permissions...');
    
    // Check if user is host/owner
    const isAuthorized = await page.evaluate(async (streamId) => {
      const hostsResp = await fetch(`/api/streams/${streamId}/hosts`);
      if (hostsResp.ok) {
        const hosts = await hostsResp.json();
        return { hosts, count: hosts.length };
      }
      return { hosts: [], count: 0 };
    }, testStream.id);
    
    console.log(`\nHosts: ${isAuthorized.count}`);
    
    // Try to check stream ownership
    const userInfo = await page.evaluate(async () => {
      const resp = await fetch('/api/auth/session');
      if (resp.ok) {
        const session = await resp.json();
        return session?.user;
      }
      return null;
    });
    
    console.log(`\nCurrent user: ${userInfo?.name || 'Unknown'} (${userInfo?.id || 'No ID'})`);
    console.log(`Stream owner: ${testStream.userId}`);
    console.log(`Is owner: ${userInfo?.id === testStream.userId ? '✅' : '❌'}`);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('TEST COMPLETE');
  console.log('='.repeat(50));
});