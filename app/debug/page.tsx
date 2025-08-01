'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useSupabaseChat } from '@/lib/supabase-hooks'
import { testBroadcastChannel } from '@/lib/supabase-broadcast-test'

export default function DebugPage() {
  const [debugInfo, setDebugInfo] = useState<any>({})
  const [testStreamId] = useState('test-stream-debug-fixed')
  const [testMessage, setTestMessage] = useState('')
  
  // Use the actual chat hook to test it
  const { messages, loading, sendMessage } = useSupabaseChat(testStreamId)

  useEffect(() => {
    // Test Supabase connection
    const testSupabase = async () => {
      const info: any = {
        hasSupabase: !!supabase,
        testStreamId,
        messagesCount: messages.length,
        loading
      }

      if (supabase) {
        try {
          // Test basic connection
          const { data, error } = await supabase.from('messages').select('count').limit(1)
          info.connectionTest = { success: !error, error: error?.message }
          
          // Test realtime
          const channel = supabase.channel('test-channel')
          info.realtimeTest = { channelCreated: !!channel }
          
          const subscriptionStatus = await new Promise((resolve) => {
            channel.subscribe((status) => {
              console.log('Test channel status:', status)
              resolve(status)
            })
          })
          
          info.realtimeStatus = subscriptionStatus
          
          // Clean up test channel
          supabase.removeChannel(channel)
          
        } catch (err) {
          info.error = err
        }
      }
      
      setDebugInfo(info)
    }

    testSupabase()
  }, [testStreamId, messages.length, loading])

  const handleSendTestMessage = async () => {
    if (!testMessage.trim()) return
    
    console.log('Sending test message:', testMessage)
    const success = await sendMessage(testMessage)
    console.log('Send result:', success)
    
    if (success) {
      setTestMessage('')
    }
  }

  const handleTestBroadcast = () => {
    console.log('🎙️ Testing broadcast channel...')
    testBroadcastChannel()
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Supabase Debug Info</h1>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Connection Test</h2>
        <pre className="bg-gray-100 p-4 rounded text-sm">
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      </div>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Chat Test</h2>
        <div className="bg-white border rounded p-4">
          <div className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Type test message..."
                className="flex-1 border rounded px-3 py-2"
                onKeyDown={(e) => e.key === 'Enter' && handleSendTestMessage()}
              />
              <button
                onClick={handleSendTestMessage}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                disabled={!testMessage.trim()}
              >
                Send
              </button>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h3 className="font-medium mb-2">Messages ({messages.length}):</h3>
            {loading ? (
              <div>Loading...</div>
            ) : messages.length === 0 ? (
              <div className="text-gray-500">No messages yet</div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {messages.map((msg, i) => (
                  <div key={msg.id || i} className="text-sm">
                    <strong>{msg.user_name}:</strong> {msg.content}
                    <span className="text-gray-400 ml-2 text-xs">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Broadcast Test</h2>
        <div className="bg-white border rounded p-4">
          <p className="text-sm text-gray-600 mb-3">
            Test Supabase broadcast channels as an alternative to database real-time
          </p>
          <button
            onClick={handleTestBroadcast}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Test Broadcast Channel
          </button>
          <p className="text-xs text-gray-500 mt-2">
            Check browser console for broadcast logs
          </p>
        </div>
      </div>
    </div>
  )
}