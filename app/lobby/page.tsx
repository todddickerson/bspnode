'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Video, Users, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Stream {
  id: string
  title: string
  description: string | null
  status: string
  viewerCount: number
  user: {
    id: string
    name: string
    image: string | null
  }
  startedAt: string | null
  createdAt: string
}

export default function LobbyPage() {
  const [streams, setStreams] = useState<Stream[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchStreams()
    // Refresh streams every 10 seconds
    const interval = setInterval(fetchStreams, 10000)
    return () => clearInterval(interval)
  }, [])

  const fetchStreams = async () => {
    try {
      const response = await fetch('/api/streams')
      if (response.ok) {
        const data = await response.json()
        setStreams(data)
      }
    } catch (error) {
      console.error('Error fetching streams:', error)
    } finally {
      setLoading(false)
    }
  }

  const liveStreams = streams.filter(stream => stream.status === 'LIVE')
  const upcomingStreams = streams.filter(stream => stream.status === 'CREATED')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading streams...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Stream Lobby</h1>
          <p className="text-gray-600">Discover live and upcoming streams</p>
        </div>

        {/* Live Streams */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
            Live Now
          </h2>
          
          {liveStreams.length === 0 ? (
            <p className="text-gray-500">No live streams at the moment</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {liveStreams.map((stream) => (
                <StreamCard key={stream.id} stream={stream} />
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Streams */}
        <div>
          <h2 className="text-2xl font-semibold mb-6">Upcoming Streams</h2>
          
          {upcomingStreams.length === 0 ? (
            <p className="text-gray-500">No upcoming streams</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {upcomingStreams.map((stream) => (
                <StreamCard key={stream.id} stream={stream} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StreamCard({ stream }: { stream: Stream }) {
  const router = useRouter()
  const isLive = stream.status === 'LIVE'

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
         onClick={() => router.push(`/stream/${stream.id}`)}>
      <div className="aspect-video bg-gray-200 relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <Video className="h-12 w-12 text-gray-400" />
        </div>
        {isLive && (
          <div className="absolute top-4 left-4 bg-red-600 text-white px-2 py-1 rounded text-sm font-semibold">
            LIVE
          </div>
        )}
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-1">{stream.title}</h3>
        {stream.description && (
          <p className="text-gray-600 text-sm mb-2 line-clamp-2">{stream.description}</p>
        )}
        
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-4">
            <span className="font-medium text-gray-700">{stream.user.name}</span>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{stream.viewerCount}</span>
            </div>
          </div>
          
          {stream.startedAt && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{getTimeSince(stream.startedAt)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getTimeSince(date: string) {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000)
  
  if (seconds < 60) return 'Just started'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}