import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_PUBLIC
  
  if (!url || !key) {
    return NextResponse.json({ error: 'Missing Supabase credentials' })
  }
  
  // Create a fresh client for testing
  const testClient = createClient(url, key, {
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  })
  
  const results = {
    connection: 'pending',
    subscription: 'pending',
    error: null,
    timestamp: new Date().toISOString()
  }
  
  try {
    // Create a simple channel
    const channel = testClient
      .channel('test-minimal')
      .on('presence', { event: 'sync' }, () => {
        console.log('Presence sync')
      })
      
    // Subscribe and wait for status
    const status = await new Promise((resolve) => {
      channel.subscribe((status) => {
        resolve(status)
      })
      
      // Timeout after 3 seconds
      setTimeout(() => resolve('TIMEOUT'), 3000)
    })
    
    results.subscription = status as string
    
    // Try to get channel state
    results.connection = channel.state || 'unknown'
    
    // Clean up
    testClient.removeChannel(channel)
    
  } catch (error) {
    results.error = error?.message || 'Unknown error'
  }
  
  return NextResponse.json(results)
}