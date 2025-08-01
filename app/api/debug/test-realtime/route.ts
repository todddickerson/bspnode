import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing real-time subscription server-side')

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not available' }, { status: 500 })
    }

    // Create a test channel and try to subscribe
    const channel = supabaseAdmin.channel('server-test-channel')
    
    let subscriptionResult = 'pending'
    let subscriptionError = null

    const subscriptionPromise = new Promise((resolve) => {
      channel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: 'stream_id=eq.server-test'
          },
          (payload) => {
            console.log('🎉 Server-side real-time message received:', payload)
          }
        )
        .subscribe((status, err) => {
          console.log('🔌 Server-side subscription status:', status)
          if (err) {
            console.error('❌ Server-side subscription error:', err)
            subscriptionError = err
          }
          subscriptionResult = status
          resolve(status)
        })
    })

    // Wait for subscription status
    await Promise.race([
      subscriptionPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Subscription timeout')), 5000))
    ])

    // Clean up
    supabaseAdmin.removeChannel(channel)

    return NextResponse.json({ 
      success: true, 
      subscriptionResult,
      subscriptionError,
      message: 'Real-time test completed'
    })

  } catch (error) {
    console.error('❌ Real-time test error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}