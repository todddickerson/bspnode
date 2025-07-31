'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, X } from 'lucide-react'
import { useSupabaseChat } from '@/lib/supabase-hooks'

interface StudioChatSupabaseProps {
  streamId: string
  onClose: () => void
}

export function StudioChatSupabase({ streamId, onClose }: StudioChatSupabaseProps) {
  const { data: session } = useSession()
  const [inputMessage, setInputMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { messages, loading, sendMessage } = useSupabaseChat(streamId)

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

  return (
    <div className="h-full flex flex-col bg-gray-800 text-white">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold">Live Chat</h3>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          className="text-gray-400 hover:text-white hover:bg-gray-700"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-500 border-t-white"></div>
          </div>
        ) : messages.length === 0 ? (
          <p className="text-gray-400 text-sm text-center">No messages yet. Be the first to chat!</p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-sm text-purple-400">{message.user_name}</span>
                <span className="text-xs text-gray-500">
                  {formatTime(message.created_at)}
                </span>
              </div>
              <p className="text-sm text-gray-200">{message.content}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {session ? (
        <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-700">
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              maxLength={500}
            />
            <Button 
              type="submit" 
              size="icon"
              disabled={!inputMessage.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      ) : (
        <div className="p-4 border-t border-gray-700 text-center text-sm text-gray-400">
          Please sign in to chat
        </div>
      )}
    </div>
  )
}