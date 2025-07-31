'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { VideoPlayer } from '@/components/video-player'
import { ChatSupabase } from '@/components/chat-supabase'
import { FloatingHearts } from '@/components/floating-hearts'
import { Users, Heart, Maximize2, Signal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSupabasePresence, useSupabaseStreamStats } from '@/lib/supabase-hooks'

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

interface StreamViewerSupabaseProps {
  stream: Stream
}

export function StreamViewerSupabase({ stream }: StreamViewerSupabaseProps) {
  const { data: session } = useSession()
  const [heartTrigger, setHeartTrigger] = useState(0)
  const [streamDuration, setStreamDuration] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  
  const { viewerCount } = useSupabasePresence(stream.id, false)
  const { stats, sendHeart } = useSupabaseStreamStats(stream.id)

  useEffect(() => {
    // Update stream duration every second if live
    if (stream.status === 'LIVE' && stream.startedAt) {
      const timer = setInterval(() => {
        const start = new Date(stream.startedAt!).getTime()
        const now = new Date().getTime()
        setStreamDuration(Math.floor((now - start) / 1000))
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [stream.status, stream.startedAt])

  const handleHeartClick = async () => {
    setHeartTrigger(prev => prev + 1)
    await sendHeart()
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && videoContainerRef.current) {
      videoContainerRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else if (document.exitFullscreen) {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const getTimeSince = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
    return `${Math.floor(seconds / 86400)} days ago`
  }

  const hasRecording = stream.status === 'ENDED' && stream.recordingUrl && stream.recordingStatus === 'READY'
  const isProcessingRecording = stream.status === 'ENDED' && (stream.recordingStatus === 'UPLOADING' || stream.recordingStatus === 'PROCESSING')
  const recordingFailed = stream.status === 'ENDED' && stream.recordingStatus === 'FAILED'
  const isWaitingForStream = stream.status === 'CREATED' && (stream.streamType === 'BROWSER' || stream.streamType === 'LIVEKIT')
  const isLiveStream = stream.status === 'LIVE'
  const canShowVideo = (stream.muxPlaybackId && (isLiveStream || hasRecording)) || hasRecording

  if (!canShowVideo && !isWaitingForStream && stream.status !== 'LIVE') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Stream Not Available</h1>
          <p className="text-gray-600">This stream is not currently available.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Video Player */}
          <div className="lg:col-span-2">
            <div 
              ref={videoContainerRef}
              className="aspect-video relative bg-black rounded-lg overflow-hidden cursor-pointer"
              onClick={handleHeartClick}
            >
              {isWaitingForStream ? (
                <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                  <div className="text-center text-white">
                    <h2 className="text-2xl font-bold mb-2">Waiting for Stream</h2>
                    <p className="text-gray-300">The broadcaster hasn't started yet.</p>
                  </div>
                </div>
              ) : stream.status === 'LIVE' && !stream.muxPlaybackId ? (
                <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                  <div className="text-center text-white">
                    <div className="animate-pulse mb-4">
                      <Signal className="h-12 w-12 mx-auto text-gray-400" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Connecting to Stream</h2>
                    <p className="text-gray-300">The video will appear in a moment...</p>
                    <p className="text-gray-500 text-sm mt-2">Stream is live, setting up video feed</p>
                  </div>
                </div>
              ) : (
                <>
                  <VideoPlayer
                    playbackId={hasRecording ? stream.recordingUrl! : stream.muxPlaybackId!}
                    title={stream.title}
                    isLive={stream.status === 'LIVE'}
                  />
                  
                  {/* Floating Hearts */}
                  <FloatingHearts triggerHeart={heartTrigger} />
                  
                  {/* Stream Overlay */}
                  {stream.status === 'LIVE' && (
                    <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/50 to-transparent pointer-events-none">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-red-600 text-white px-3 py-1 rounded-full flex items-center gap-2 text-sm font-medium">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            LIVE
                          </div>
                          <div className="bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                            {formatDuration(streamDuration)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pointer-events-auto">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-white hover:bg-white/20"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleFullscreen()
                            }}
                          >
                            <Maximize2 className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Click for hearts instruction */}
                  <div className="absolute bottom-4 left-4 pointer-events-none">
                    <div className="bg-black/50 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2 opacity-70">
                      <Heart className="h-4 w-4 fill-white" />
                      Tap to send love • {stats.heart_count || 0}
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {/* Stream Info */}
            <div className="bg-white rounded-lg shadow mt-4 p-6">
              <h1 className="text-2xl font-bold mb-2">{stream.title}</h1>
              {stream.description && (
                <p className="text-gray-600 mb-4">{stream.description}</p>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                      {stream.user.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className="font-medium">{stream.user.name}</span>
                  </div>
                  
                  <div className="flex items-center gap-1 text-gray-600">
                    <Users className="h-4 w-4" />
                    <span>{viewerCount} viewers</span>
                  </div>
                </div>
              
                {stream.status === 'LIVE' && stream.startedAt && (
                  <div className="text-sm text-gray-500">
                    Started {getTimeSince(stream.startedAt)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chat */}
          <div className="lg:col-span-1">
            <div className="h-[600px] lg:h-[calc(100vh-2rem)]">
              <ChatSupabase streamId={stream.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}