'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getSocket } from '@/lib/socket'
import { Send } from 'lucide-react'

interface Message {
  id: string
  content: string
  user: {
    name: string
    id: string
  }
  createdAt: string
}

interface ChatProps {
  streamId: string
}

export function Chat({ streamId }: ChatProps) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const socket = getSocket()

  useEffect(() => {
    if (!socket.connected) {
      socket.connect()
    }

    socket.emit('join-stream', streamId)

    // Load chat history
    loadChatHistory()

    socket.on('new-message', (message: Message) => {
      setMessages((prev) => [...prev, message])
    })

    return () => {
      socket.off('new-message')
      socket.emit('leave-stream', streamId)
    }
  }, [streamId, socket])

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`/api/streams/${streamId}/messages`)
      if (response.ok) {
        const historyMessages = await response.json()
        setMessages(historyMessages)
      }
    } catch (error) {
      console.error('Error loading chat history:', error)
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim() || !session?.user) return

    socket.emit('send-message', {
      content: inputMessage,
      streamId,
      user: {
        id: session.user.id,
        name: session.user.name || 'Anonymous'
      }
    })

    setInputMessage('')
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
              <span className="font-medium text-sm">{message.user.name}</span>
              <span className="text-xs text-gray-500">
                {new Date(message.createdAt).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-sm text-gray-700">{message.content}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {session ? (
        <form onSubmit={sendMessage} className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
            />
            <Button type="submit" size="icon">
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