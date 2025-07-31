'use client'

import { useEffect, useState, useRef } from 'react'
import { VideoPlayer } from '@/components/video-player'
import { Room, RoomEvent, RemoteParticipant, RemoteTrackPublication, RemoteTrack, Track } from 'livekit-client'

interface StreamViewerProps {
  streamId: string
  stream: {
    id: string
    status: string
    streamType: string
    muxPlaybackId: string | null
    liveKitRoomName: string | null
    recordingUrl: string | null
    recordingStatus: string | null
  }
  isInvitedParticipant?: boolean
}

export function StreamViewer({ streamId, stream, isInvitedParticipant = false }: StreamViewerProps) {
  const [room, setRoom] = useState<Room | null>(null)
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(new Map())
  const liveKitVideoRef = useRef<HTMLVideoElement>(null)
  const [hlsUrl, setHlsUrl] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    // For regular viewers, check if HLS/RTMP playback is available
    if (!isInvitedParticipant && stream.muxPlaybackId && stream.status === 'LIVE') {
      // Use Mux HLS playback for scalable viewing
      setHlsUrl(`https://stream.mux.com/${stream.muxPlaybackId}.m3u8`)
      return
    }

    // Only connect to LiveKit if invited as a participant
    if (isInvitedParticipant && stream.status === 'LIVE' && stream.liveKitRoomName && !room) {
      connectToLiveKitAsParticipant()
    }

    return () => {
      if (room) {
        room.disconnect()
      }
    }
  }, [stream, isInvitedParticipant, room])

  const connectToLiveKitAsParticipant = async () => {
    if (!stream.liveKitRoomName || room || isConnecting) return
    
    setIsConnecting(true)
    try {
      // Get participant token (with limited permissions)
      const tokenResponse = await fetch(`/api/streams/${streamId}/participant-token`, {
        method: 'POST',
      })
      
      if (!tokenResponse.ok) {
        console.error('Failed to get participant token')
        return
      }

      const { token, url } = await tokenResponse.json()
      
      const newRoom = new Room({
        logLevel: 'warn',
        autoSubscribe: true,
      })
      
      // Set up event handlers
      newRoom.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        setRemoteParticipants(prev => new Map(prev.set(participant.sid, participant)))
      })

      newRoom.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Video && liveKitVideoRef.current) {
          track.attach(liveKitVideoRef.current)
        }
      })
      
      newRoom.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        setRemoteParticipants(prev => {
          const newMap = new Map(prev)
          newMap.delete(participant.sid)
          return newMap
        })
      })

      await newRoom.connect(url, token)
      setRoom(newRoom)
      
    } catch (error) {
      console.error('Error connecting to LiveKit as participant:', error)
    } finally {
      setIsConnecting(false)
    }
  }

  // For browser streams without Mux playback
  if (stream.streamType === 'BROWSER' && stream.status === 'LIVE' && !stream.muxPlaybackId && !isInvitedParticipant) {
    return (
      <div className="w-full h-full bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-2">Stream is Live</h2>
          <p className="text-gray-300">Viewer mode is being set up. Please wait...</p>
          <p className="text-gray-400 text-sm mt-2">The broadcaster is currently streaming.</p>
        </div>
      </div>
    )
  }

  // For invited participants - show LiveKit video
  if (isInvitedParticipant && stream.status === 'LIVE') {
    return (
      <>
        <video
          ref={liveKitVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        {isConnecting && (
          <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent mx-auto mb-2"></div>
              <p className="text-gray-300">Joining as participant...</p>
            </div>
          </div>
        )}
      </>
    )
  }

  // For regular viewers - show HLS/video player
  if (hlsUrl || stream.recordingUrl || stream.muxPlaybackId) {
    return (
      <VideoPlayer
        playbackId={stream.recordingUrl || stream.muxPlaybackId || ''}
        streamType={stream.streamType}
        hlsUrl={hlsUrl}
      />
    )
  }

  return (
    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
      <div className="text-center text-white">
        <p className="text-gray-300">Waiting for stream...</p>
      </div>
    </div>
  )
}