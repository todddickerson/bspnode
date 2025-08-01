import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_PUBLIC
  
  if (!url || !key) {
    return NextResponse.json({ error: 'Missing Supabase credentials' })
  }
  
  // Create a fresh client for testing
  const testClient = createClient(url, key)
  
  const results = {
    channelStatus: 'pending',
    subscriptionStatus: 'pending',
    receivedMessage: false,
    error: null,
    timestamp: new Date().toISOString()
  }
  
  try {
    // Create a channel with postgres_changes
    const channel = testClient
      .channel('db-messages-test')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          console.log('Postgres change received:', payload)
          results.receivedMessage = true
        }
      )
      
    // Subscribe and wait for status
    const status = await new Promise((resolve) => {
      channel.subscribe((status, error) => {
        if (error) {
          console.error('Subscription error:', error)
          results.error = error.message
        }
        resolve(status)
      })
      
      // Timeout after 3 seconds
      setTimeout(() => resolve('TIMEOUT'), 3000)
    })
    
    results.subscriptionStatus = status as string
    results.channelStatus = channel.state || 'unknown'
    
    // Keep the channel open for a moment to see if we get the CLOSED event
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Check final state
    results.channelStatus = channel.state || 'unknown'
    
    // Clean up
    testClient.removeChannel(channel)
    
  } catch (error) {
    results.error = error?.message || 'Unknown error'
  }
  
  return NextResponse.json(results)
}