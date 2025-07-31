'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { StreamViewerSupabase } from '@/components/stream-viewer-supabase'
import { ChatSupabase } from '@/components/chat-supabase'

interface Stream {
  id: string
  title: string
  description: string | null
  status: string
  streamType: 'RTMP' | 'BROWSER' | 'LIVEKIT'
  muxPlaybackId: string | null
  liveKitRoomName: string | null
  viewerCount: number
  user: {
    id: string
    name: string
    image: string | null
  }
  startedAt: string | null
  endedAt: string | null
  recordingUrl: string | null
  recordingStatus: string | null
  duration: number | null
}

export default function StreamViewerPage() {
  const params = useParams()
  const streamId = params.id as string
  const [stream, setStream] = useState<Stream | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStream()
    // Refresh stream data more frequently when waiting for video
    const refreshInterval = stream?.status === 'LIVE' && !stream?.muxPlaybackId ? 2000 : 10000
    const interval = setInterval(fetchStream, refreshInterval)
    
    return () => {
      clearInterval(interval)
    }
  }, [streamId, stream?.status, stream?.muxPlaybackId])

  const fetchStream = async () => {
    try {
      const response = await fetch(`/api/streams/${streamId}`)
      if (response.ok) {
        const data = await response.json()
        setStream(data)
      }
    } catch (error) {
      console.error('Error fetching stream:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-600"></div>
      </div>
    )
  }

  if (!stream) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Stream Not Found</h1>
          <p className="text-gray-600">This stream does not exist.</p>
        </div>
      </div>
    )
  }

  // Show appropriate content for ended streams
  const hasRecording = stream.status === 'ENDED' && stream.recordingUrl && stream.recordingStatus === 'READY'
  const isProcessingRecording = stream.status === 'ENDED' && (stream.recordingStatus === 'UPLOADING' || stream.recordingStatus === 'PROCESSING')
  const recordingFailed = stream.status === 'ENDED' && stream.recordingStatus === 'FAILED'
  
  if (stream.status === 'ENDED' && !hasRecording) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h1 className="text-3xl font-bold mb-4">{stream.title}</h1>
            <div className="mb-6">
              <div className="flex items-center gap-2 justify-center mb-2">
                <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                  {stream.user.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <span className="font-medium">{stream.user.name}</span>
              </div>
              {stream.description && (
                <p className="text-gray-600 mb-4">{stream.description}</p>
              )}
            </div>
            
            {isProcessingRecording ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-blue-600">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                  <span className="font-medium">Recording is being processed...</span>
                </div>
                <p className="text-gray-600">
                  The stream has ended and the recording is being processed. Please check back in a few minutes.
                </p>
              </div>
            ) : recordingFailed ? (
              <div className="space-y-4">
                <div className="text-red-600 font-medium">Recording Processing Failed</div>
                <p className="text-gray-600">
                  Unfortunately, the recording for this stream could not be processed.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-gray-600 font-medium">Stream Ended</div>
                <p className="text-gray-600">
                  This live stream has ended.
                  {stream.duration && ` It lasted ${formatDuration(stream.duration)}.`}
                </p>
              </div>
            )}

            {/* Chat for ended stream */}
            <div className="mt-8">
              <div className="max-w-md mx-auto h-96">
                <ChatSupabase streamId={streamId} />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <StreamViewerSupabase stream={stream} />
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}