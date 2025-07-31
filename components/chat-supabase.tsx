'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send } from 'lucide-react'
import { useSupabaseChat } from '@/lib/supabase-hooks'

interface ChatProps {
  streamId: string
}

export function ChatSupabase({ streamId }: ChatProps) {
  const { data: session } = useSession()
  const [inputMessage, setInputMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { messages, loading, sendMessage } = useSupabaseChat(streamId)
  
  // If Supabase is not available, show a fallback
  const [supabaseAvailable, setSupabaseAvailable] = useState(true)

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim() || !session?.user) return

    const success = await sendMessage(inputMessage)
    if (success) {
      setInputMessage('')
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Live Chat</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h3 className="font-semibold">Live Chat</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 && (
          <p className="text-gray-500 text-sm text-center">No messages yet. Be the first to chat!</p>
        )}
        {messages.map((message) => (
          <div key={message.id} className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="font-medium text-sm">{message.user_name}</span>
              <span className="text-xs text-gray-500">
                {formatTime(message.created_at)}
              </span>
            </div>
            <p className="text-sm text-gray-700">{message.content}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {session ? (
        <form onSubmit={handleSendMessage} className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
              maxLength={500}
            />
            <Button type="submit" size="icon" disabled={!inputMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      ) : (
        <div className="p-4 border-t text-center text-sm text-gray-500">
          Please sign in to chat
        </div>
      )}
    </div>
  )
}