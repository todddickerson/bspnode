'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Video, VideoOff, Mic, MicOff, Radio, Square, Loader2, Settings, Copy, Share2, Users, MessageCircle } from 'lucide-react'
import { Room, RoomEvent, Track, VideoPresets, LocalTrack } from 'livekit-client'
import { Chat } from '@/components/chat'
import { getSocket } from '@/lib/socket'

interface Stream {
  id: string
  title: string
  description: string | null
  status: string
  streamType: string
  userId: string
  user: {
    id: string
    name: string
  }
}

export default function BroadcastPage() {
  const params = useParams()
  const streamId = params.id as string
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  
  const [stream, setStream] = useState<Stream | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([])
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [hasPermission, setHasPermission] = useState(false)
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('')
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('')
  const [showSettings, setShowSettings] = useState(false)
  const [streamStats, setStreamStats] = useState<{
    bitrate: number
    fps: number
    resolution: string
  }>({ bitrate: 0, fps: 0, resolution: '0x0' })
  const [networkQuality, setNetworkQuality] = useState<'excellent' | 'good' | 'poor'>('good')
  const [duration, setDuration] = useState(0)
  const [viewerCount, setViewerCount] = useState(0)
  const [showChat, setShowChat] = useState(true)
  
  // LiveKit state
  const [room, setRoom] = useState<Room | null>(null)
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalTrack | null>(null)
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalTrack | null>(null)
  const [isConnectedToLiveKit, setIsConnectedToLiveKit] = useState(false)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const socket = getSocket()

  useEffect(() => {
    fetchStream()
    // Refresh stream data every 5 seconds for viewer count updates
    const interval = setInterval(fetchStream, 5000)
    return () => clearInterval(interval)
  }, [streamId])

  useEffect(() => {
    // Connect to socket for real-time updates
    if (!socket.connected) {
      socket.connect()
    }

    socket.emit('join-stream', streamId)

    socket.on('viewer-count-update', (count: number) => {
      setViewerCount(count)
    })

    return () => {
      socket.off('viewer-count-update')
      socket.emit('leave-stream', streamId)
    }
  }, [streamId, socket])

  useEffect(() => {
    initializeMedia()
    return () => {
      stopMedia()
    }
  }, [])

  useEffect(() => {
    if (hasPermission) {
      getDevices()
    }
  }, [hasPermission])

  useEffect(() => {
    if (selectedVideoDevice || selectedAudioDevice) {
      updateMediaStream()
    }
  }, [selectedVideoDevice, selectedAudioDevice])

  useEffect(() => {
    // Update stream duration every second if live
    if (isLive) {
      const timer = setInterval(() => {
        setDuration(prev => prev + 1)
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [isLive])

  useEffect(() => {
    // Monitor stream stats if live
    if (isLive && streamRef.current) {
      const interval = setInterval(() => {
        updateStreamStats()
      }, 2000)
      return () => clearInterval(interval)
    }
  }, [isLive])

  const fetchStream = async () => {
    try {
      const response = await fetch(`/api/streams/${streamId}`)
      if (response.ok) {
        const data = await response.json()
        setStream(data)
        setViewerCount(data.viewerCount || 0)
        
        // Check if user owns the stream
        if (data.userId !== session?.user?.id) {
          toast({
            title: 'Unauthorized',
            description: 'You can only broadcast to your own streams',
            variant: 'destructive',
          })
          router.push('/dashboard')
        }
        
        // Check if stream type is browser
        if (data.streamType !== 'BROWSER') {
          toast({
            title: 'Invalid Stream Type',
            description: 'This stream is configured for RTMP/OBS streaming',
            variant: 'destructive',
          })
          router.push('/dashboard')
          return
        }

        // If stream has ended, redirect to ended page
        if (data.status === 'ENDED') {
          router.push(`/stream/${streamId}/ended`)
          return
        }

        // If stream is currently live, redirect to view the live stream
        if (data.status === 'LIVE') {
          toast({
            title: 'Stream Already Live',
            description: 'This stream is already broadcasting.',
          })
          router.push(`/stream/${streamId}`)
          return
        }
      }
    } catch (error) {
      console.error('Error fetching stream:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoInputs = devices.filter(device => device.kind === 'videoinput')
      const audioInputs = devices.filter(device => device.kind === 'audioinput')
      
      setVideoDevices(videoInputs)
      setAudioDevices(audioInputs)
      
      // Set default devices if not already selected
      if (!selectedVideoDevice && videoInputs.length > 0) {
        setSelectedVideoDevice(videoInputs[0].deviceId)
      }
      if (!selectedAudioDevice && audioInputs.length > 0) {
        setSelectedAudioDevice(audioInputs[0].deviceId)
      }
    } catch (error) {
      console.error('Error enumerating devices:', error)
    }
  }

  const initializeMedia = async () => {
    try {
      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices not supported in this browser')
      }

      const constraints: MediaStreamConstraints = {
        video: selectedVideoDevice ? {
          deviceId: { exact: selectedVideoDevice },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } : {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: selectedAudioDevice ? {
          deviceId: { exact: selectedAudioDevice },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setHasPermission(true)
      setPermissionError(null)
    } catch (error: any) {
      console.error('Error accessing media devices:', error)
      setHasPermission(false)
      
      let errorMessage = 'Could not access camera or microphone'
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera and microphone permissions denied. Click "Try Again" below or check your browser\'s camera/microphone settings.'
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera or microphone found. Please connect a device and try again.'
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera or microphone is already in use by another application.'
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Camera or microphone not supported by this browser.'
      } else {
        errorMessage = `Media access error: ${error.message}`
      }
      
      setPermissionError(errorMessage)
      toast({
        title: 'Media Access Error',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  const requestPermissionsAgain = async () => {
    // Clear previous error
    setPermissionError(null)
    
    // Stop any existing streams first
    stopMedia()
    
    // Small delay to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Try to initialize media again
    await initializeMedia()
  }

  const updateMediaStream = async () => {
    if (!hasPermission) return
    
    stopMedia()
    await initializeMedia()
  }

  const updateStreamStats = () => {
    if (!streamRef.current) return
    
    const videoTrack = streamRef.current.getVideoTracks()[0]
    if (videoTrack) {
      const settings = videoTrack.getSettings()
      setStreamStats(prev => ({
        ...prev,
        resolution: `${settings.width}x${settings.height}`,
        fps: settings.frameRate || 30,
      }))
    }
    
    // Simulate bitrate and network quality (in production, use WebRTC stats)
    const mockBitrate = 2500 + Math.random() * 1000
    setStreamStats(prev => ({ ...prev, bitrate: Math.round(mockBitrate) }))
    
    // Network quality based on bitrate
    if (mockBitrate > 3000) {
      setNetworkQuality('excellent')
    } else if (mockBitrate > 2000) {
      setNetworkQuality('good')
    } else {
      setNetworkQuality('poor')
    }
  }

  const connectToLiveKit = async (retryCount = 0) => {
    if (!streamRef.current || !stream) return
    
    const MAX_RETRIES = 1 // Limited retries
    const RETRY_DELAY = 2000 // 2 second delay

    try {
      // Silently check LiveKit health first
      const healthResponse = await fetch('/api/livekit/health')
      if (!healthResponse.ok) {
        // LiveKit not configured properly, silently skip
        return
      }
      
      // Get LiveKit token for this stream
      const tokenResponse = await fetch(`/api/streams/${streamId}/token`, {
        method: 'POST',
      })
      
      if (!tokenResponse.ok) {
        // Token generation failed, silently skip
        return
      }
      
      const { token, url } = await tokenResponse.json()
      
      if (!token || !url) {
        // Missing credentials, silently skip
        return
      }
      
      // Create and connect to LiveKit room
      const newRoom = new Room({
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
        // Disable automatic reconnection
        reconnectPolicy: {
          disabled: true,
        },
        // Set to silent to prevent console errors
        logLevel: 'silent',
      })
      
      // Set up room event listeners
      newRoom.on(RoomEvent.Connected, () => {
        setIsConnectedToLiveKit(true)
        console.log('LiveKit connected successfully')
      })
      
      newRoom.on(RoomEvent.Disconnected, () => {
        setIsConnectedToLiveKit(false)
      })
      
      // Connect to the room with timeout
      const connectionTimeout = setTimeout(() => {
        newRoom.disconnect()
      }, 5000) // 5 second timeout
      
      await newRoom.connect(url, token)
      clearTimeout(connectionTimeout)
      
      // Get video and audio tracks from the current media stream
      const videoTrack = streamRef.current.getVideoTracks()[0]
      const audioTrack = streamRef.current.getAudioTracks()[0]
      
      if (videoTrack) {
        console.log('Publishing video track to LiveKit')
        const lkVideoTrack = await newRoom.localParticipant.publishTrack(videoTrack, {
          name: 'camera',
          source: Track.Source.Camera,
        })
        setLocalVideoTrack(lkVideoTrack)
        console.log('Video track published successfully')
      }
      
      if (audioTrack) {
        console.log('Publishing audio track to LiveKit')
        const lkAudioTrack = await newRoom.localParticipant.publishTrack(audioTrack, {
          name: 'microphone', 
          source: Track.Source.Microphone,
        })
        setLocalAudioTrack(lkAudioTrack)
        console.log('Audio track published successfully')
      }
      
      setRoom(newRoom)
      
    } catch (error) {
      // Silently handle errors
      if (retryCount < MAX_RETRIES) {
        setTimeout(() => connectToLiveKit(retryCount + 1), RETRY_DELAY)
        return
      }
      
      // Final failure - just silently give up
      // The stream will continue working without LiveKit
    }
  }

  const connectToLiveKitWithToken = async (token: string, roomName: string) => {
    if (!streamRef.current) return
    
    try {
      const liveKitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL
      if (!liveKitUrl) {
        console.error('LiveKit URL not configured')
        return
      }
      
      // Create and connect to LiveKit room
      const newRoom = new Room({
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
        // Disable automatic reconnection
        reconnectPolicy: {
          disabled: true,
        },
        // Set to silent to prevent console errors
        logLevel: 'silent',
      })
      
      // Set up room event listeners
      newRoom.on(RoomEvent.Connected, () => {
        setIsConnectedToLiveKit(true)
        console.log('LiveKit connected successfully')
        
        // Start egress once connected
        fetch(`/api/streams/${streamId}/egress/start`, {
          method: 'POST',
        }).catch(error => {
          console.error('Failed to start egress:', error)
        })
      })
      
      newRoom.on(RoomEvent.Disconnected, () => {
        setIsConnectedToLiveKit(false)
      })
      
      // Connect to the room with timeout
      const connectionTimeout = setTimeout(() => {
        newRoom.disconnect()
      }, 5000) // 5 second timeout
      
      await newRoom.connect(liveKitUrl, token)
      clearTimeout(connectionTimeout)
      
      // Get video and audio tracks from the current media stream
      const videoTrack = streamRef.current.getVideoTracks()[0]
      const audioTrack = streamRef.current.getAudioTracks()[0]
      
      if (videoTrack) {
        console.log('Publishing video track to LiveKit')
        const lkVideoTrack = await newRoom.localParticipant.publishTrack(videoTrack, {
          name: 'camera',
          source: Track.Source.Camera,
        })
        setLocalVideoTrack(lkVideoTrack)
        console.log('Video track published successfully')
      }
      
      if (audioTrack) {
        console.log('Publishing audio track to LiveKit')
        const lkAudioTrack = await newRoom.localParticipant.publishTrack(audioTrack, {
          name: 'microphone', 
          source: Track.Source.Microphone,
        })
        setLocalAudioTrack(lkAudioTrack)
        console.log('Audio track published successfully')
      }
      
      setRoom(newRoom)
      
    } catch (error) {
      console.error('Failed to connect to LiveKit:', error)
      // The stream will continue working without LiveKit
    }
  }

  const disconnectFromLiveKit = async () => {
    if (room) {
      await room.disconnect()
      setRoom(null)
      setLocalVideoTrack(null)
      setLocalAudioTrack(null)
      setIsConnectedToLiveKit(false)
    }
  }

  const stopMedia = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
  }

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoEnabled(videoTrack.enabled)
      }
    }
  }

  const toggleAudio = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsAudioEnabled(audioTrack.enabled)
      }
    }
  }

  const startBroadcast = async () => {
    if (!streamRef.current || !stream) return

    try {
      // Initialize streaming session
      const response = await fetch(`/api/streams/${streamId}/start`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to start stream')
      }

      const streamingSession = await response.json()
      
      setIsLive(true)
      
      // Start recording for later upload (this is the core functionality)
      const recorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm'
      })
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setRecordedChunks(chunks => [...chunks, event.data])
        }
      }
      
      recorder.start(1000) // Record in 1-second chunks
      setMediaRecorder(recorder)
      
      toast({
        title: 'Live!',
        description: 'You are now broadcasting',
      })

      // Connect to LiveKit using the token from streaming session
      if (streamingSession.token && streamingSession.roomName) {
        setTimeout(async () => {
          await connectToLiveKitWithToken(streamingSession.token, streamingSession.roomName)
        }, 2000) // Delay to ensure stream is fully started first
      }

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
    if (!mediaRecorder || !stream) return

    setIsLive(false)
    
    // Disconnect from LiveKit
    await disconnectFromLiveKit()
    
    mediaRecorder.stop()
    
    // Wait for final data
    await new Promise(resolve => {
      mediaRecorder.onstop = resolve
    })

    // Create blob from recorded chunks
    const blob = new Blob(recordedChunks, { type: 'video/webm' })
    
    // Upload recording
    const formData = new FormData()
    formData.append('recording', blob, 'stream-recording.webm')
    
    try {
      // End the stream
      await fetch(`/api/streams/${streamId}/end`, {
        method: 'POST',
      })
      
      // Upload recording
      const uploadResponse = await fetch(`/api/streams/${streamId}/upload-recording`, {
        method: 'POST',
        body: formData,
      })
      
      if (uploadResponse.ok) {
        toast({
          title: 'Broadcast Ended',
          description: 'Your recording is being processed',
        })
        router.push(`/stream/${streamId}/ended`)
      } else {
        const errorText = await uploadResponse.text()
        console.error('Upload failed:', uploadResponse.status, errorText)
        throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`)
      }
    } catch (error) {
      console.error('Error stopping broadcast:', error)
      toast({
        title: 'Error',
        description: 'Failed to save recording',
        variant: 'destructive',
      })
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
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{stream.title}</h1>
          {stream.description && (
            <p className="text-gray-600 mt-2">{stream.description}</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Video Preview */}
          <div className="lg:col-span-2">
            <div className="bg-black rounded-lg overflow-hidden aspect-video relative">
              {permissionError ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-900">
                  <div className="text-center text-white p-8">
                    <VideoOff className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-xl font-semibold mb-2">Camera Access Required</h3>
                    <p className="text-gray-300 mb-4">{permissionError}</p>
                    <Button
                      onClick={requestPermissionsAgain}
                      variant="secondary"
                      className="mb-2"
                    >
                      Try Again
                    </Button>
                    <p className="text-xs text-gray-400 mt-2">
                      If the browser doesn't show a permission prompt, check your browser's camera/microphone settings in the address bar or browser preferences.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {!hasPermission && !permissionError && (
                    <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-white" />
                    </div>
                  )}
                </>
              )}
              {isLive && (
                <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full flex items-center gap-2">
                  <Radio className="h-4 w-4 animate-pulse" />
                  LIVE
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="mt-4 flex items-center justify-center gap-4">
              <Button
                variant={isVideoEnabled ? "default" : "secondary"}
                size="icon"
                onClick={toggleVideo}
                disabled={isLive}
              >
                {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </Button>

              <Button
                variant={isAudioEnabled ? "default" : "secondary"}
                size="icon"
                onClick={toggleAudio}
                disabled={isLive}
              >
                {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>

              {!isLive ? (
                <Button
                  onClick={startBroadcast}
                  className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!hasPermission}
                  title={!hasPermission ? "Please allow camera access first" : "Start broadcasting"}
                >
                  <Radio className="h-4 w-4 mr-2" />
                  Go Live
                </Button>
              ) : (
                <Button
                  onClick={stopBroadcast}
                  variant="destructive"
                >
                  <Square className="h-4 w-4 mr-2" />
                  End Broadcast
                </Button>
              )}

              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowSettings(!showSettings)}
                disabled={isLive}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>

            {/* Permission Notice */}
            {!hasPermission && !permissionError && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 mb-2">
                  Please allow camera and microphone access to start broadcasting.
                </p>
                <Button
                  onClick={requestPermissionsAgain}
                  variant="outline"
                  size="sm"
                  className="text-yellow-800 border-yellow-300 hover:bg-yellow-100"
                >
                  Request Camera Access
                </Button>
              </div>
            )}

            {/* Device Settings */}
            {showSettings && !isLive && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
                <div>
                  <Label htmlFor="video-device">Camera</Label>
                  <Select
                    value={selectedVideoDevice}
                    onValueChange={setSelectedVideoDevice}
                    disabled={videoDevices.length === 0}
                  >
                    <SelectTrigger id="video-device">
                      <SelectValue placeholder="Select camera" />
                    </SelectTrigger>
                    <SelectContent>
                      {videoDevices.map((device) => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="audio-device">Microphone</Label>
                  <Select
                    value={selectedAudioDevice}
                    onValueChange={setSelectedAudioDevice}
                    disabled={audioDevices.length === 0}
                  >
                    <SelectTrigger id="audio-device">
                      <SelectValue placeholder="Select microphone" />
                    </SelectTrigger>
                    <SelectContent>
                      {audioDevices.map((device) => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Stream Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Broadcast Settings</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowChat(!showChat)}
                title={showChat ? "Hide chat" : "Show chat"}
              >
                <MessageCircle className={`h-4 w-4 ${showChat ? 'fill-current' : ''}`} />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Stream Status</p>
                <p className="font-medium">{isLive ? 'Live' : 'Not Broadcasting'}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">Viewers</p>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="font-medium text-lg">{viewerCount}</span>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">Video Quality</p>
                <p className="font-medium">{streamStats.resolution} @ {streamStats.fps}fps</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">Recording</p>
                <p className="font-medium">Enabled</p>
              </div>
              
              {isLive && (
                <>
                  <div>
                    <p className="text-sm text-gray-600">Duration</p>
                    <p className="font-medium">{formatDuration(duration)}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600">Bitrate</p>
                    <p className="font-medium">{(streamStats.bitrate / 1000).toFixed(1)} Mbps</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600">Network Quality</p>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        networkQuality === 'excellent' ? 'bg-green-500' :
                        networkQuality === 'good' ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                      <span className="font-medium capitalize">{networkQuality}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Share URL Section */}
            <div className="mt-6 space-y-4">
              <div>
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <Share2 className="h-4 w-4" />
                  Share Your Stream
                </h3>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={typeof window !== 'undefined' ? `${window.location.origin}/stream/${streamId}` : ''}
                    className="text-sm"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/stream/${streamId}`)
                      toast({
                        title: 'Copied!',
                        description: 'Stream URL copied to clipboard',
                      })
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Share this link with your viewers
                </p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Your stream will be recorded and available for playback after you end the broadcast.
              </p>
            </div>
          </div>
          
          {/* Live Chat */}
          {showChat && (
            <div className="lg:col-span-1">
              <div className="h-[600px] lg:h-[calc(100vh-12rem)]">
                <Chat streamId={streamId} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}