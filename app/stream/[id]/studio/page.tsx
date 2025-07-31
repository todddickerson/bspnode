'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { 
  Video, VideoOff, Mic, MicOff, Radio, Square, Loader2, 
  Users, Copy, Share2, Settings, Phone, PhoneOff 
} from 'lucide-react'
import {
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteTrack,
  LocalParticipant,
  VideoPresets,
  LocalTrackPublication,
} from 'livekit-client'

interface Stream {
  id: string
  title: string
  description: string | null
  status: string
  streamType: string
  liveKitRoomName: string | null
  maxHosts: number | null
  userId: string
  user: {
    id: string
    name: string
  }
}

interface Host {
  id: string
  role: string
  user: {
    id: string
    name: string
    email: string
  }
}

export default function StudioPage() {
  const params = useParams()
  const streamId = params.id as string
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  
  const [stream, setStream] = useState<Stream | null>(null)
  const [hosts, setHosts] = useState<Host[]>([])
  const [loading, setLoading] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [inviteLink, setInviteLink] = useState('')
  const [room, setRoom] = useState<Room | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('')
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('')
  const [hasPermission, setHasPermission] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({})
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    fetchStreamAndHosts()
    initializePreview()
    return () => {
      stopPreview()
    }
  }, [streamId])

  const initializePreview = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices not supported in this browser')
      }

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      
      streamRef.current = stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
      setHasPermission(true)
      setPermissionError(null)
      
      // Enumerate devices after getting permission
      await enumerateDevices()
    } catch (error: any) {
      console.error('Error accessing media devices:', error)
      setHasPermission(false)
      
      let errorMessage = 'Could not access camera or microphone'
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera and microphone permissions denied. Please allow access to continue.'
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera or microphone found. Please connect a device and try again.'
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera or microphone is already in use by another application.'
      }
      
      setPermissionError(errorMessage)
    }
  }

  const stopPreview = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  const fetchStreamAndHosts = async () => {
    try {
      // Fetch stream details
      const streamResponse = await fetch(`/api/streams/${streamId}`)
      if (streamResponse.ok) {
        const streamData = await streamResponse.json()
        setStream(streamData)
        
        // Check if user has permission to access studio
        const hostsResponse = await fetch(`/api/streams/${streamId}/hosts`)
        if (hostsResponse.ok) {
          const hostsData = await hostsResponse.json()
          setHosts(hostsData)
          
          const isHost = hostsData.some((h: Host) => h.user.id === session?.user?.id)
          if (!isHost && streamData.userId !== session?.user?.id) {
            toast({
              title: 'Access Denied',
              description: 'You are not a host of this stream',
              variant: 'destructive',
            })
            router.push('/dashboard')
            return
          }
        }
        
        // Generate invite link
        const baseUrl = window.location.origin
        setInviteLink(`${baseUrl}/stream/${streamId}/join`)
      }
    } catch (error) {
      console.error('Error fetching stream:', error)
    } finally {
      setLoading(false)
    }
  }

  const connectToLiveKit = async () => {
    if (!session?.user) return
    
    setIsConnecting(true)
    let newRoom: Room | null = null
    
    try {
      // Always try to start/initialize the stream first
      // This ensures the LiveKit room exists
      const initResponse = await fetch(`/api/streams/${streamId}/start`, {
        method: 'POST',
      })
      
      if (!initResponse.ok) {
        const errorData = await initResponse.json()
        // If already broadcasting, that's okay - we can still join
        if (errorData.code !== 'ALREADY_BROADCASTING') {
          throw new Error(errorData.message || 'Failed to initialize stream')
        }
      } else {
        const initData = await initResponse.json()
        // Update local stream state with LiveKit room info
        setStream(prev => prev ? {
          ...prev,
          liveKitRoomName: initData.roomName || prev.liveKitRoomName
        } : null)
      }
      
      // Get LiveKit token from API
      const tokenResponse = await fetch(`/api/streams/${streamId}/token`, {
        method: 'POST',
      })
      
      if (!tokenResponse.ok) {
        const error = await tokenResponse.text()
        throw new Error(`Failed to get token: ${error}`)
      }
      
      const { token, url } = await tokenResponse.json()
      
      if (!token || !url) {
        throw new Error('Invalid token response')
      }
      
      // Create and connect to room
      newRoom = new Room({
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      
      // Set up event handlers
      newRoom.on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
      newRoom.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
      newRoom.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakerChange)
      newRoom.on(RoomEvent.Disconnected, handleDisconnect)
      
      // Connect to room without publishing yet
      await newRoom.connect(url, token, {
        autoSubscribe: true,
      })
      
      console.log('Connected to room:', newRoom.name)
      
      // Store room reference for debugging
      if (typeof window !== 'undefined') {
        (window as any).__livekitRoom = newRoom
      }
      
      setRoom(newRoom)
      setIsConnected(true)
      
      // Set up listeners for track published events
      const videoAttached = new Promise<void>((resolve) => {
        const handleTrackPublished = (publication: LocalTrackPublication) => {
          console.log('Track published event:', publication.kind, publication.source)
          if (publication.kind === Track.Kind.Video && publication.track && localVideoRef.current) {
            console.log('Attaching video track from event')
            publication.track.attach(localVideoRef.current)
            localVideoRef.current.muted = true
            localVideoRef.current.play().then(() => {
              console.log('Video element playing')
              resolve()
            }).catch(e => console.error('Play error:', e))
          }
        }
        newRoom.localParticipant.on('localTrackPublished', handleTrackPublished)
      })
      
      // Now publish camera and microphone tracks
      console.log('Publishing camera and microphone tracks...')
      try {
        // If we have a preview stream, use its tracks
        if (streamRef.current) {
          const videoTrack = streamRef.current.getVideoTracks()[0]
          const audioTrack = streamRef.current.getAudioTracks()[0]
          
          if (videoTrack) {
            console.log('Publishing existing video track to LiveKit')
            await newRoom.localParticipant.publishTrack(videoTrack, {
              name: 'camera',
              source: Track.Source.Camera,
            })
            // Video should already be visible from preview
          }
          
          if (audioTrack) {
            console.log('Publishing existing audio track to LiveKit')
            await newRoom.localParticipant.publishTrack(audioTrack, {
              name: 'microphone',
              source: Track.Source.Microphone,
            })
          }
        } else {
          // Fallback to LiveKit's camera/mic methods
          await newRoom.localParticipant.setCameraEnabled(true)
          await newRoom.localParticipant.setMicrophoneEnabled(true)
        }
        
        // Wait for video to be attached (with timeout)
        await Promise.race([
          videoAttached,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Video attachment timeout')), 5000))
        ]).catch(async (error) => {
          console.warn('Video attachment via event failed:', error.message)
          
          // Fallback: manually attach video track
          console.log('Attempting manual video attachment...')
          
          // Wait a bit more for tracks to be available
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          const videoTracks = newRoom.localParticipant.videoTracks
          console.log(`Video tracks available for manual attachment: ${videoTracks?.size || 0}`)
          
          if (videoTracks && videoTracks.size > 0 && localVideoRef.current) {
            for (const [_, publication] of videoTracks) {
              if (publication?.track) {
                console.log('Manually attaching video track')
                publication.track.attach(localVideoRef.current)
                localVideoRef.current.muted = true
                await localVideoRef.current.play()
                break
              }
            }
          }
        })
        
        // Log final state
        const videoTracks = newRoom.localParticipant.videoTracks
        const audioTracks = newRoom.localParticipant.audioTracks
        console.log(`Final published tracks: ${videoTracks?.size || 0} video, ${audioTracks?.size || 0} audio`)
        
        // Check video element state
        if (localVideoRef.current) {
          await new Promise(resolve => setTimeout(resolve, 500)) // Wait for video to initialize
          console.log('Video element final state:', {
            srcObject: !!localVideoRef.current.srcObject,
            readyState: localVideoRef.current.readyState,
            videoWidth: localVideoRef.current.videoWidth,
            videoHeight: localVideoRef.current.videoHeight,
            paused: localVideoRef.current.paused,
            muted: localVideoRef.current.muted
          })
        }
      } catch (error) {
        console.error('Error publishing tracks:', error)
        throw error
      }
      
      // Enumerate available devices
      await enumerateDevices()
      
    } catch (error) {
      console.error('Error connecting to LiveKit:', error)
      
      // Clean up on error
      if (newRoom) {
        try {
          await newRoom.disconnect()
        } catch (e) {
          console.error('Error disconnecting:', e)
        }
      }
      
      let errorMessage = 'Could not connect to the studio'
      if (error instanceof Error) {
        errorMessage = error.message
        // Provide more specific error messages
        if (error.message.includes('videoTracks')) {
          errorMessage = 'Failed to access camera. Please check camera permissions.'
        } else if (error.message.includes('WebSocket')) {
          errorMessage = 'Failed to connect to LiveKit server. Please check your connection.'
        } else if (error.message.includes('token')) {
          errorMessage = 'Authentication failed. Please try again.'
        }
      }
      
      toast({
        title: 'Connection Failed',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsConnecting(false)
    }
  }

  const handleTrackSubscribed = (
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) => {
    if (track.kind === Track.Kind.Video) {
      // Try to find element by participant identity
      const element = remoteVideoRefs.current[participant.identity]
      if (element) {
        track.attach(element)
      } else {
        // Force re-render to create video element for new participant
        setHosts(prev => [...prev])
      }
    }
  }

  const handleTrackUnsubscribed = (
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) => {
    if (track.kind === Track.Kind.Video) {
      track.detach()
    }
  }

  const handleActiveSpeakerChange = (speakers: RemoteParticipant[]) => {
    // Handle active speaker UI updates
  }

  const handleDisconnect = () => {
    setIsConnected(false)
    toast({
      title: 'Disconnected',
      description: 'You have been disconnected from the studio',
    })
  }

  const toggleVideo = async () => {
    if (!streamRef.current) return
    
    const videoTrack = streamRef.current.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      setIsVideoEnabled(videoTrack.enabled)
    }
  }

  const toggleAudio = async () => {
    if (!streamRef.current) return
    
    const audioTrack = streamRef.current.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      setIsAudioEnabled(audioTrack.enabled)
    }
  }

  const startBroadcast = async () => {
    try {
      // Start RTMP egress for viewers using the streaming service
      const egressResponse = await fetch(`/api/streams/${streamId}/egress/start`, {
        method: 'POST',
      })
      
      if (!egressResponse.ok) {
        const error = await egressResponse.text()
        throw new Error(`Failed to start egress: ${error}`)
      }
      
      setIsLive(true)
      
      // Update stream status is handled by the egress API
      
      toast({
        title: 'Live!',
        description: 'Your collaborative stream is now live',
      })
    } catch (error) {
      console.error('Error starting broadcast:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start broadcast',
        variant: 'destructive',
      })
    }
  }

  const stopBroadcast = async () => {
    try {
      await fetch(`/api/streams/${streamId}/end`, {
        method: 'POST',
      })
      
      setIsLive(false)
      
      toast({
        title: 'Broadcast Ended',
        description: 'Your stream has ended',
      })
      
      // Disconnect from room
      room?.disconnect()
      router.push(`/stream/${streamId}`)
    } catch (error) {
      console.error('Error stopping broadcast:', error)
    }
  }

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink)
    toast({
      title: 'Copied!',
      description: 'Invite link copied to clipboard',
    })
  }

  const leaveStudio = () => {
    room?.disconnect()
    router.push('/dashboard')
  }

  const enumerateDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoInputs = devices.filter(device => device.kind === 'videoinput')
      const audioInputs = devices.filter(device => device.kind === 'audioinput')
      
      setVideoDevices(videoInputs)
      setAudioDevices(audioInputs)
      
      // Set default selected devices
      if (videoInputs.length > 0 && !selectedVideoDevice) {
        setSelectedVideoDevice(videoInputs[0].deviceId)
      }
      if (audioInputs.length > 0 && !selectedAudioDevice) {
        setSelectedAudioDevice(audioInputs[0].deviceId)
      }
    } catch (error) {
      console.error('Error enumerating devices:', error)
    }
  }

  const changeVideoDevice = async (deviceId: string) => {
    if (!deviceId) return
    
    try {
      // Stop current video track
      if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach(track => track.stop())
      }
      
      // Get new media stream with selected device
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: streamRef.current ? true : false
      }
      
      const newStream = await navigator.mediaDevices.getUserMedia(constraints)
      
      // Replace video track in current stream
      if (streamRef.current) {
        const oldVideoTrack = streamRef.current.getVideoTracks()[0]
        const newVideoTrack = newStream.getVideoTracks()[0]
        
        if (oldVideoTrack) {
          streamRef.current.removeTrack(oldVideoTrack)
        }
        streamRef.current.addTrack(newVideoTrack)
        
        // Keep audio tracks from new stream
        newStream.getAudioTracks().forEach(track => {
          if (!streamRef.current!.getAudioTracks().includes(track)) {
            track.stop()
          }
        })
      } else {
        streamRef.current = newStream
      }
      
      // Update video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = streamRef.current
      }
      
      // If connected to LiveKit, republish with new track
      if (room && isConnected) {
        const newVideoTrack = streamRef.current.getVideoTracks()[0]
        if (newVideoTrack) {
          await room.localParticipant.publishTrack(newVideoTrack, {
            name: 'camera',
            source: Track.Source.Camera,
          })
        }
      }
      
      setSelectedVideoDevice(deviceId)
      
      toast({
        title: 'Camera Changed',
        description: 'Successfully switched camera device',
      })
    } catch (error) {
      console.error('Error changing video device:', error)
      toast({
        title: 'Error',
        description: 'Failed to change camera device',
        variant: 'destructive',
      })
    }
  }

  const changeAudioDevice = async (deviceId: string) => {
    if (!deviceId) return
    
    try {
      // Get new media stream with selected audio device
      const constraints: MediaStreamConstraints = {
        video: false,
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      }
      
      const newStream = await navigator.mediaDevices.getUserMedia(constraints)
      
      // Replace audio track in current stream
      if (streamRef.current) {
        // Stop old audio tracks
        streamRef.current.getAudioTracks().forEach(track => track.stop())
        
        // Add new audio track
        const newAudioTrack = newStream.getAudioTracks()[0]
        streamRef.current.addTrack(newAudioTrack)
        
        // If connected to LiveKit, republish with new track
        if (room && isConnected && newAudioTrack) {
          await room.localParticipant.publishTrack(newAudioTrack, {
            name: 'microphone',
            source: Track.Source.Microphone,
          })
        }
      }
      
      setSelectedAudioDevice(deviceId)
      
      toast({
        title: 'Microphone Changed',
        description: 'Successfully switched microphone device',
      })
    } catch (error) {
      console.error('Error changing audio device:', error)
      toast({
        title: 'Error',
        description: 'Failed to change microphone device',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
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

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{stream.title}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {hosts.length}/{stream.maxHosts} hosts
              </span>
              {isLive && (
                <span className="flex items-center gap-1 text-red-500">
                  <Radio className="h-4 w-4 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {!isConnected && !isLive && (
              <Button
                onClick={connectToLiveKit}
                disabled={isConnecting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isConnecting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connecting...</>
                ) : (
                  <><Phone className="h-4 w-4 mr-2" /> Join Studio</>
                )}
              </Button>
            )}
            
            {isConnected && !isLive && (
              <Button
                onClick={startBroadcast}
                className="bg-red-600 hover:bg-red-700"
              >
                <Radio className="h-4 w-4 mr-2" />
                Go Live
              </Button>
            )}
            
            {isLive && (
              <Button
                onClick={stopBroadcast}
                variant="destructive"
              >
                <Square className="h-4 w-4 mr-2" />
                End Stream
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={leaveStudio}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              <PhoneOff className="h-4 w-4 mr-2" />
              Leave Studio
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex">
          {/* Video Grid */}
          <div className="flex-1 p-4">
            <div className="grid grid-cols-2 gap-4 h-full">
              {/* Local Video */}
              <div className="bg-gray-800 rounded-lg overflow-hidden relative aspect-video" data-testid="video-container">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }} // Mirror the video for better UX
                  onLoadedMetadata={() => {
                    console.log('Video metadata loaded')
                    if (localVideoRef.current) {
                      console.log('Video dimensions:', localVideoRef.current.videoWidth, 'x', localVideoRef.current.videoHeight)
                    }
                  }}
                  onPlay={() => console.log('Video playing')}
                  onError={(e) => console.error('Video error:', e)}
                  onLoadStart={() => console.log('Video load started')}
                  onCanPlay={() => console.log('Video can play')}
                />
                <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-1 rounded">
                  You {session?.user?.name && `(${session.user.name})`}
                </div>
                {!isVideoEnabled && isConnected && (
                  <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                    <VideoOff className="h-12 w-12 text-gray-600" />
                  </div>
                )}
                {permissionError && (
                  <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                    <div className="text-center p-4">
                      <VideoOff className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-300 mb-4">{permissionError}</p>
                      <Button
                        onClick={initializePreview}
                        variant="secondary"
                      >
                        Try Again
                      </Button>
                    </div>
                  </div>
                )}
                {!hasPermission && !permissionError && (
                  <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
              
              {/* Remote Videos */}
              {room?.participants && Array.from(room.participants.values()).map((participant) => (
                <div key={participant.identity} className="bg-gray-800 rounded-lg overflow-hidden relative aspect-video">
                  <video
                    ref={(el) => { remoteVideoRefs.current[participant.identity] = el }}
                    autoPlay
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-1 rounded">
                    {participant.name || participant.identity}
                  </div>
                </div>
              ))}
              
              {/* Empty slots */}
              {Array.from({ length: Math.max(0, (stream.maxHosts || 4) - hosts.length - 1) }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-gray-800 rounded-lg flex items-center justify-center aspect-video">
                  <div className="text-center text-gray-600">
                    <Users className="h-12 w-12 mx-auto mb-2" />
                    <p>Waiting for host...</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-80 bg-gray-800 p-4 flex flex-col gap-4">
            {/* Controls */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="font-medium mb-3">Controls</h3>
              <div className="flex gap-2">
                <Button
                  variant={isVideoEnabled ? "default" : "secondary"}
                  size="icon"
                  onClick={toggleVideo}
                  disabled={!isConnected}
                >
                  {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                </Button>
                <Button
                  variant={isAudioEnabled ? "default" : "secondary"}
                  size="icon"
                  onClick={toggleAudio}
                  disabled={!isConnected}
                >
                  {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  disabled={!isConnected}
                  onClick={() => setShowSettings(!showSettings)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Device Selection */}
              {showSettings && isConnected && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Camera</label>
                    <select
                      value={selectedVideoDevice}
                      onChange={(e) => changeVideoDevice(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm"
                    >
                      {videoDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">Microphone</label>
                    <select
                      value={selectedAudioDevice}
                      onChange={(e) => changeAudioDevice(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm"
                    >
                      {audioDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Invite */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="font-medium mb-3">Invite Co-hosts</h3>
              <div className="flex gap-2">
                <Input
                  value={inviteLink}
                  readOnly
                  className="bg-gray-800 border-gray-600"
                />
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={copyInviteLink}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-gray-400 mt-2">
                Share this link with people you want to join as co-hosts
              </p>
            </div>

            {/* Host List */}
            <div className="bg-gray-700 rounded-lg p-4 flex-1">
              <h3 className="font-medium mb-3">Current Hosts</h3>
              <div className="space-y-2">
                {hosts.map((host) => (
                  <div key={host.id} className="flex items-center justify-between p-2 bg-gray-800 rounded">
                    <div>
                      <p className="font-medium">{host.user.name}</p>
                      <p className="text-xs text-gray-400">{host.role}</p>
                    </div>
                    {host.user.id === session?.user?.id && (
                      <span className="text-xs bg-blue-600 px-2 py-1 rounded">You</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}