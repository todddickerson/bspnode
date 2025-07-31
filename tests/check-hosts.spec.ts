import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test('check hosts and permissions', async ({ page }) => {
  console.log('🔍 Checking Hosts and Permissions\n');
  
  // Login
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[id="email"]', 'testuser@example.com')
  await page.fill('input[id="password"]', 'password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 10000 })
  console.log('✅ Logged in\n');
  
  // Get session info
  const session = await page.evaluate(async () => {
    const resp = await fetch('/api/auth/session');
    return await resp.json();
  });
  
  console.log('Current User:');
  console.log(`  ID: ${session.user.id}`);
  console.log(`  Name: ${session.user.name}`);
  console.log(`  Email: ${session.user.email}\n`);
  
  // Get streams
  const streams = await page.evaluate(async () => {
    const resp = await fetch('/api/streams');
    return await resp.json();
  });
  
  // Find a LIVEKIT stream
  const livekitStream = streams.find(s => s.streamType === 'LIVEKIT');
  
  if (!livekitStream) {
    console.log('No LIVEKIT stream found. Creating one...');
    const newStream = await page.evaluate(async () => {
      const resp = await fetch('/api/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Host Test Stream',
          description: 'Testing host permissions',
          streamType: 'LIVEKIT',
          maxHosts: 4
        }),
      });
      return await resp.json();
    });
    
    console.log(`Created stream: ${newStream.id}\n`);
    
    // Check hosts for new stream
    const hosts = await page.evaluate(async (streamId) => {
      const resp = await fetch(`/api/streams/${streamId}/hosts`);
      return {
        status: resp.status,
        ok: resp.ok,
        data: resp.ok ? await resp.json() : await resp.text()
      };
    }, newStream.id);
    
    console.log('Hosts API Response:');
    console.log(`  Status: ${hosts.status}`);
    console.log(`  OK: ${hosts.ok}`);
    console.log(`  Data: ${JSON.stringify(hosts.data, null, 2)}\n`);
    
    // Try to access studio directly
    console.log('Attempting to access studio...');
    await page.goto(`${BASE_URL}/stream/${newStream.id}/studio`);
    await page.waitForTimeout(2000);
    
    const finalUrl = page.url();
    console.log(`Final URL: ${finalUrl}`);
    console.log(`On studio: ${finalUrl.includes('/studio') ? '✅' : '❌'}`);
    
    // Debug: Check what the studio page is doing
    if (!finalUrl.includes('/studio')) {
      console.log('\n⚠️  Redirected away from studio. Checking console...');
      
      // Try again with console monitoring
      const logs = [];
      page.on('console', msg => logs.push(msg.text()));
      
      await page.goto(`${BASE_URL}/stream/${newStream.id}/studio`);
      await page.waitForTimeout(2000);
      
      console.log('\nConsole logs:');
      logs.forEach(log => console.log(`  ${log}`));
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('TEST COMPLETE');
});