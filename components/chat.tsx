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

    socket.emit('join-stream', { streamId, userId: session?.user?.id || `viewer-${Date.now()}`, isHost: false })

    // Load chat history
    loadChatHistory()

    socket.on('chat-message', (message: any) => {
      const formattedMessage: Message = {
        id: message.id,
        content: message.message,
        user: {
          name: message.userName,
          id: message.userId
        },
        createdAt: message.timestamp
      }
      setMessages((prev) => [...prev, formattedMessage])
    })
    
    socket.on('messages-history', (history: any[]) => {
      const formattedHistory = history.map(msg => ({
        id: msg.id,
        content: msg.message,
        user: {
          name: msg.userName,
          id: msg.userId
        },
        createdAt: msg.timestamp
      }))
      setMessages(formattedHistory)
    })
    
    // Request message history
    socket.emit('get-messages', { streamId })

    return () => {
      socket.off('chat-message')
      socket.off('messages-history')
      socket.emit('leave-stream', { streamId })
    }
  }, [streamId, socket, session?.user?.id])

  const loadChatHistory = async () => {
    // Message history is now loaded via Socket.io
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
      message: inputMessage,
      streamId
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