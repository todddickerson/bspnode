import { supabase } from './supabase'

export async function testBroadcastChannel() {
  if (!supabase) {
    console.error('Supabase client not available')
    return
  }

  console.log('🎙️ Testing broadcast channel...')
  
  // Create a broadcast channel
  const channel = supabase.channel('test-broadcast-channel')
  
  // Subscribe to broadcast events
  channel
    .on('broadcast', { event: 'test-message' }, (payload) => {
      console.log('🎉 Broadcast message received:', payload)
    })
    .subscribe((status) => {
      console.log('🎙️ Broadcast channel status:', status)
      
      if (status === 'SUBSCRIBED') {
        // Send a test broadcast
        channel.send({
          type: 'broadcast',
          event: 'test-message',
          payload: { message: 'Hello from broadcast!' }
        })
      }
    })
  
  // Clean up after 5 seconds
  setTimeout(() => {
    console.log('🧹 Cleaning up broadcast channel')
    supabase.removeChannel(channel)
  }, 5000)
}

// Export for use in components
export function useBroadcastChat(streamId: string) {
  const channel = supabase?.channel(`chat-broadcast-${streamId}`)
  
  const sendBroadcast = (message: any) => {
    if (!channel) return
    
    channel.send({
      type: 'broadcast',
      event: 'new-message',
      payload: message
    })
  }
  
  const subscribeToBroadcast = (onMessage: (payload: any) => void) => {
    if (!channel) return
    
    channel
      .on('broadcast', { event: 'new-message' }, onMessage)
      .subscribe((status) => {
        console.log('🎙️ Chat broadcast status:', status)
      })
    
    return () => {
      supabase?.removeChannel(channel)
    }
  }
  
  return { sendBroadcast, subscribeToBroadcast }
}