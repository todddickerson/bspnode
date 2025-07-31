'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { VideoPlayer } from '@/components/video-player'
import { Chat } from '@/components/chat'
import { FloatingHearts } from '@/components/floating-hearts'
import { Users, Heart, Maximize2, Signal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Room, RoomEvent, RemoteParticipant, RemoteTrackPublication, RemoteTrack, Track } from 'livekit-client'

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
  const [heartTrigger, setHeartTrigger] = useState(0)
  const [viewerCount, setViewerCount] = useState(0)
  const [streamDuration, setStreamDuration] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [room, setRoom] = useState<Room | null>(null)
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(new Map())
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const liveKitVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    fetchStream()
    // Refresh stream data every 10 seconds for better real-time updates
    const interval = setInterval(fetchStream, 10000)
    return () => clearInterval(interval)
  }, [streamId])

  useEffect(() => {
    // Update stream duration every second if live
    if (stream?.status === 'LIVE' && stream.startedAt) {
      const timer = setInterval(() => {
        const start = new Date(stream.startedAt!).getTime()
        const now = new Date().getTime()
        setStreamDuration(Math.floor((now - start) / 1000))
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [stream?.status, stream?.startedAt])

  useEffect(() => {
    // Disabled - Regular viewers should not connect to LiveKit
    // Only invited participants should connect to LiveKit
    // Viewers watch via Mux HLS distribution
    
    // Cleanup on unmount
    return () => {
      if (room) {
        room.disconnect()
      }
    }
  }, [stream, room])

  const fetchStream = async () => {
    try {
      const response = await fetch(`/api/streams/${streamId}`)
      if (response.ok) {
        const data = await response.json()
        setStream(data)
        setViewerCount(data.viewerCount || 0)
      }
    } catch (error) {
      console.error('Error fetching stream:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleHeartClick = () => {
    setHeartTrigger(prev => prev + 1)
    // TODO: Send heart event to server via Socket.io
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

  const connectToLiveKitAsViewer = async () => {
    // Disabled for regular viewers - LiveKit should only be used for invited participants
    return
  }

  const handleTrackSubscribed = (
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) => {
    console.log('Track subscribed:', track.kind, 'from', participant.identity)
    if (track.kind === Track.Kind.Video && liveKitVideoRef.current) {
      console.log('Attaching video track to element')
      track.attach(liveKitVideoRef.current)
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading stream...</p>
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

  // Check if stream has ended and has a recording
  const hasRecording = stream.status === 'ENDED' && stream.recordingUrl && stream.recordingStatus === 'READY'
  const isProcessingRecording = stream.status === 'ENDED' && (stream.recordingStatus === 'UPLOADING' || stream.recordingStatus === 'PROCESSING')
  const recordingFailed = stream.status === 'ENDED' && stream.recordingStatus === 'FAILED'
  const isWaitingForStream = stream.status === 'CREATED' && (stream.streamType === 'BROWSER' || stream.streamType === 'LIVEKIT')
  const isLiveStream = stream.status === 'LIVE'
  const canShowVideo = (stream.muxPlaybackId && (isLiveStream || hasRecording)) || hasRecording

  // For browser streams that are live but don't have muxPlaybackId yet
  const isBrowserStreamLive = stream.streamType === 'BROWSER' && stream.status === 'LIVE'
  
  // Show appropriate content for ended streams
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
                <Chat streamId={streamId} />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  if (!canShowVideo && !isWaitingForStream && !isBrowserStreamLive) {
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
                    <h2 className="text-2xl font-bold mb-2">Stream is Live</h2>
                    <p className="text-gray-300">The broadcaster is setting up. Video will appear shortly.</p>
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
                      Tap to send love
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
                    <span>{stream.viewerCount} viewers</span>
                  </div>
                </div>
                
                {stream.status === 'LIVE' && stream.startedAt && (
                  <div className="text-sm text-gray-500">
                    Started {getTimeSince(stream.startedAt)}
                  </div>
                )}
                
                {stream.status === 'ENDED' && (
                  <div className="text-sm text-gray-500">
                    {hasRecording ? (
                      <span className="text-green-600 font-medium">Recording Available</span>
                    ) : (
                      <span>Stream Ended</span>
                    )}
                    {stream.duration && <span> • {formatDuration(stream.duration)}</span>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chat */}
          <div className="lg:col-span-1">
            <div className="h-[600px] lg:h-[calc(100vh-2rem)]">
              <Chat streamId={streamId} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function getTimeSince(date: string) {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000)
  
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
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