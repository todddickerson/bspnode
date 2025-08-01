import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import { RealtimeChannel, RealtimePresenceState } from '@supabase/supabase-js'
import { useSession } from 'next-auth/react'

interface Message {
  id: string
  stream_id: string
  user_id: string
  user_name: string
  content: string
  created_at: string
}

interface StreamStats {
  viewer_count: number
  heart_count: number
}

interface PresenceUser {
  user_id: string
  user_name: string
  is_host: boolean
  joined_at: string
}

export function useSupabaseChat(streamId: string) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    console.log('🔄 useSupabaseChat: Starting effect', {
      streamId,
      hasSupabase: !!supabase,
      hasSession: !!session
    })

    if (!streamId || !supabase) {
      console.log('❌ useSupabaseChat: Missing streamId or supabase client')
      setLoading(false)
      return
    }

    // Load initial messages
    const loadMessages = async () => {
      console.log('📥 Loading initial messages for stream:', streamId)
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('stream_id', streamId)
        .order('created_at', { ascending: true })
        .limit(100)

      if (error) {
        console.error('❌ Error loading messages:', error)
      } else {
        console.log('✅ Loaded messages:', data?.length || 0, 'messages')
        setMessages(data || [])
      }
      setLoading(false)
    }

    loadMessages()

    // Subscribe to new messages
    console.log('🔌 Setting up real-time subscription for stream:', streamId)
    const channel = supabase
      .channel(`chat:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `stream_id=eq.${streamId}`
        },
        (payload) => {
          console.log('📨 Real-time message received:', payload)
          console.log('📨 New message data:', payload.new)
          setMessages(current => {
            console.log('📨 Adding to current messages:', current.length, '+ 1')
            return [...current, payload.new as Message]
          })
        }
      )
      .subscribe((status, err) => {
        console.log('🔌 Subscription status changed:', status)
        if (err) {
          console.error('❌ Subscription error:', err)
        }
        
        // Additional debugging
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to real-time updates')
          console.log('📡 Channel state:', channel.state)
          console.log('📡 Channel topic:', channel.topic)
          
          // Test the connection with a ping
          channel.send({
            type: 'heartbeat',
            event: '',
            payload: {}
          })
        } else if (status === 'CLOSED') {
          console.log('❌ Channel closed unexpectedly')
          console.log('📡 Close reason:', (channel as any).closeReason)
        } else if (status === 'CHANNEL_ERROR') {
          console.log('❌ Channel error occurred')
        }
      })

    channelRef.current = channel

    return () => {
      console.log('🧹 Cleaning up chat subscription')
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [streamId])

  const sendMessage = useCallback(async (content: string) => {
    console.log('Supabase sendMessage called:', {
      hasSupabase: !!supabase,
      hasSession: !!session?.user,
      streamId,
      content
    })
    
    if (!session?.user || !content.trim() || !supabase) {
      console.log('Supabase sendMessage failed preconditions')
      return false
    }

    const message = {
      stream_id: streamId,
      user_id: session.user.id,
      user_name: session.user.name || 'Anonymous',
      content: content.trim()
    }

    console.log('Inserting message to Supabase:', message)
    
    const { data, error } = await supabase
      .from('messages')
      .insert([message])
      .select()

    if (error) {
      console.error('Error sending message:', error)
      return false
    }

    console.log('Message inserted successfully:', data)
    return true
  }, [streamId, session])

  return { messages, loading, sendMessage }
}

export function useSupabasePresence(streamId: string, isHost: boolean = false) {
  const { data: session } = useSession()
  const [viewerCount, setViewerCount] = useState(0)
  const [presenceState, setPresenceState] = useState<RealtimePresenceState>({})
  const channelRef = useRef<RealtimeChannel | null>(null)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!streamId || !supabase) return

    const userId = session?.user?.id || `viewer-${Date.now()}`
    const userName = session?.user?.name || 'Anonymous'

    // Join presence channel
    const channel = supabase.channel(`presence:${streamId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setPresenceState(state)
        
        // Calculate viewer count (excluding hosts)
        const viewers = Object.values(state).filter(
          (users) => users.some((user: any) => !user.is_host)
        ).length
        setViewerCount(viewers)
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key)
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track presence in database
          await channel.track({
            user_id: userId,
            user_name: userName,
            is_host: isHost,
            joined_at: new Date().toISOString(),
          })

          // Update presence in database table
          await updatePresenceInDB(streamId, userId, userName, isHost)

          // Set up heartbeat to keep presence alive
          heartbeatIntervalRef.current = setInterval(async () => {
            await updatePresenceInDB(streamId, userId, userName, isHost)
          }, 20000) // Every 20 seconds
        }
      })

    channelRef.current = channel

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }
      if (channelRef.current) {
        channelRef.current.untrack()
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [streamId, session, isHost])

  return { viewerCount, presenceState }
}

export function useSupabaseStreamStats(streamId: string) {
  const [stats, setStats] = useState<StreamStats>({ viewer_count: 0, heart_count: 0 })
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!streamId || !supabase) return

    // Load initial stats
    const loadStats = async () => {
      const { data } = await supabase
        .from('stream_stats')
        .select('viewer_count, heart_count')
        .eq('stream_id', streamId)
        .single()

      if (data) {
        setStats(data)
      }
    }

    loadStats()

    // Subscribe to stats updates
    const channel = supabase
      .channel(`stats:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'stream_stats',
          filter: `stream_id=eq.${streamId}`
        },
        (payload) => {
          setStats({
            viewer_count: payload.new.viewer_count,
            heart_count: payload.new.heart_count
          })
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [streamId])

  const sendHeart = useCallback(async () => {
    // Use service role client for this operation (would need server-side endpoint)
    const response = await fetch(`/api/streams/${streamId}/heart`, {
      method: 'POST'
    })
    return response.ok
  }, [streamId])

  return { stats, sendHeart }
}

// Helper function to update presence in database
async function updatePresenceInDB(
  streamId: string, 
  userId: string, 
  userName: string, 
  isHost: boolean
) {
  if (!supabase) return
  
  const { error } = await supabase
    .from('stream_presence')
    .upsert({
      stream_id: streamId,
      user_id: userId,
      user_name: userName,
      is_host: isHost,
      last_seen: new Date().toISOString()
    }, {
      onConflict: 'stream_id,user_id'
    })

  if (error) {
    console.error('Error updating presence:', error)
  }
}