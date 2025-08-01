'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { 
  Video, VideoOff, Mic, MicOff, Radio, Square, Loader2, 
  Users, Copy, Share2, Settings, Phone, PhoneOff, Plus, X, Heart, MessageCircle,
  Eye, Clock, Trash2, Send, HeartHandshake 
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
  Participant,
  ConnectionState,
} from 'livekit-client'
import { StudioChatSupabase } from '@/components/studio-chat-supabase'
import { StreamingStatus } from '@/components/streaming-status'
import { FloatingHearts } from '@/components/floating-hearts'
import { useSupabasePresence, useSupabaseStreamStats } from '@/lib/supabase-hooks'
import { useStreamingMonitor } from '@/lib/use-streaming-monitor'
import { useDevicePreferences } from '@/lib/use-device-preferences'

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

interface HostInvite {
  id: string
  token: string
  role: string
  maxUses: number
  usedCount: number
  expiresAt: string | null
  isActive: boolean
  inviteUrl?: string
  creator: {
    id: string
    name: string
    email: string
  }
  createdAt: string
}

interface ChatMessage {
  id: string
  message: string
  userId: string
  userName: string
  timestamp: Date
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
  const [isCameraOn, setIsCameraOn] = useState(true)
  const [isMicOn, setIsMicOn] = useState(true)
  const [inviteLink, setInviteLink] = useState('')
  const [room, setRoom] = useState<Room | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('')
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('')
  const [hasPermission, setHasPermission] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  
  // New state for enhanced features
  const [hostInvites, setHostInvites] = useState<HostInvite[]>([])
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [heartCount, setHeartCount] = useState(0)
  const [showHearts, setShowHearts] = useState(true)
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map())
  const [reconnecting, setReconnecting] = useState(false)
  
  // Use Supabase hooks for real-time features
  const { viewerCount: supabaseViewerCount } = useSupabasePresence(streamId, true)
  const { stats } = useSupabaseStreamStats(streamId)
  
  // Streaming monitoring with automatic egress restart
  const {
    egressStatus,
    isEgressConnected,
    isEgressReconnecting,
    egressError,
    restartEgress,
    getStreamingHealth,
  } = useStreamingMonitor({
    streamId,
    room,
    isLive,
    onTrackChanged: (trackType, action) => {
      console.log(`📹 ${trackType} track ${action}`)
      toast({
        title: "Video source changed",
        description: `${trackType} track ${action} - restarting video output...`,
        duration: 3000,
      })
    },
    onEgressRestarted: (reason) => {
      console.log(`🔄 Video output restarted: ${reason}`)
      toast({
        title: "Video output restored",
        description: "Video feed should be working for viewers",
        duration: 3000,
      })
    },
    onStreamingError: (error) => {
      console.error(`❌ Streaming error: ${error}`)
      toast({
        title: "Streaming issue detected",
        description: error,
        variant: "destructive",
        duration: 5000,
      })
    },
  })
  
  // Device preferences management
  const {
    preferences,
    isLoaded: preferencesLoaded,
    saveVideoDevice,
    saveAudioDevice,
    saveVideoEnabled,
    saveAudioEnabled,
    getPreferredDevice,
    preferredVideoDeviceId,
    preferredAudioDeviceId,
    videoEnabled: preferredVideoEnabled,
    audioEnabled: preferredAudioEnabled,
  } = useDevicePreferences()
  
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({})
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    fetchStreamAndHosts()
    fetchHostInvites()
    
    // Only initialize preview after preferences are loaded
    if (preferencesLoaded) {
      initializePreview()
    }
    
    // Supabase real-time subscriptions are handled by hooks
    
    return () => {
      stopPreview()
      // Cleanup handled by Supabase hooks
    }
  }, [streamId, preferencesLoaded])

  const initializePreview = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices not supported in this browser')
      }

      // Wait for preferences to load before initializing
      if (!preferencesLoaded) {
        console.log('Waiting for device preferences to load...')
        return
      }

      // Enumerate devices first to get preferred devices
      const devices = await navigator.mediaDevices.enumerateDevices()
      const preferredVideoDevice = getPreferredDevice(devices, 'videoinput')
      const preferredAudioDevice = getPreferredDevice(devices, 'audioinput')

      console.log('Initializing with preferred devices:', {
        video: preferredVideoDevice?.label || 'default',
        audio: preferredAudioDevice?.label || 'default'
      })

      const constraints: MediaStreamConstraints = {
        video: preferredVideoEnabled ? {
          deviceId: preferredVideoDevice?.deviceId ? { exact: preferredVideoDevice.deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: preferredVideoDevice?.deviceId ? undefined : 'user'
        } : false,
        audio: preferredAudioEnabled ? {
          deviceId: preferredAudioDevice?.deviceId ? { exact: preferredAudioDevice.deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      
      streamRef.current = stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
      setHasPermission(true)
      setPermissionError(null)
      
      // Set initial camera/mic states based on stream tracks
      const videoTrack = stream.getVideoTracks()[0]
      const audioTrack = stream.getAudioTracks()[0]
      if (videoTrack) {
        setIsVideoEnabled(videoTrack.enabled)
        setIsCameraOn(videoTrack.enabled)
      }
      if (audioTrack) {
        setIsAudioEnabled(audioTrack.enabled)
        setIsMicOn(audioTrack.enabled)
      }
      
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
        
        // Update viewer count periodically
        setViewerCount(streamData.viewerCount || 0)
      }
    } catch (error) {
      console.error('Error fetching stream:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchHostInvites = async () => {
    try {
      const response = await fetch(`/api/streams/${streamId}/invites`)
      if (response.ok) {
        const invites = await response.json()
        setHostInvites(invites)
        
        // Set the most recent active invite as the default invite link
        const activeInvite = invites.find((invite: HostInvite) => 
          invite.isActive && 
          !isInviteExpired(invite) && 
          !isInviteExhausted(invite)
        )
        if (activeInvite?.inviteUrl) {
          setInviteLink(activeInvite.inviteUrl)
        }
      }
    } catch (error) {
      console.error('Error fetching invites:', error)
    }
  }

  const createHostInvite = async (options: { role?: string; maxUses?: number; expiresInHours?: number } = {}) => {
    try {
      const response = await fetch(`/api/streams/${streamId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      })

      if (response.ok) {
        const newInvite = await response.json()
        setHostInvites(prev => [newInvite, ...prev])
        setInviteLink(newInvite.inviteUrl)
        toast({
          title: 'Invite Created',
          description: 'New host invite link generated successfully',
        })
        return newInvite
      } else {
        const error = await response.json()
        toast({
          title: 'Error',
          description: error.message || 'Failed to create invite',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create invite',
        variant: 'destructive',
      })
    }
  }

  const revokeHostInvite = async (inviteId: string) => {
    try {
      const response = await fetch(`/api/streams/${streamId}/invites/${inviteId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setHostInvites(prev => prev.filter(invite => invite.id !== inviteId))
        toast({
          title: 'Invite Revoked',
          description: 'Host invite has been revoked',
        })
      } else {
        const error = await response.json()
        toast({
          title: 'Error',
          description: error.message || 'Failed to revoke invite',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to revoke invite',
        variant: 'destructive',
      })
    }
  }

  const connectToLiveKit = async () => {
    if (!session?.user) return
    
    setIsConnecting(true)
    let newRoom: Room | null = null
    
    try {
      // Check if stream is already live
      const streamStatus = await fetch(`/api/streams/${streamId}`)
      const streamData = await streamStatus.json()
      
      // Only initialize if not already live, otherwise just get token
      const endpoint = streamData.status === 'LIVE' 
        ? `/api/streams/${streamId}/token` 
        : `/api/streams/${streamId}/start`
      
      const initResponse = await fetch(endpoint, {
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
      newRoom.on(RoomEvent.ParticipantConnected, handleParticipantConnected)
      newRoom.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected)
      newRoom.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged)
      
      // Initialize participants from existing room participants
      if (newRoom.participants.size > 0) {
        const participantMap = new Map<string, Participant>()
        newRoom.participants.forEach((participant, identity) => {
          participantMap.set(identity, participant)
        })
        setParticipants(participantMap)
      }
      
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
  
  const handleParticipantConnected = (participant: RemoteParticipant) => {
    console.log('Participant connected:', participant.identity)
    setParticipants(prev => {
      const updated = new Map(prev)
      updated.set(participant.identity, participant)
      return updated
    })
    
    toast({
      title: 'Host Joined',
      description: `${participant.identity} has joined the studio`,
    })
  }
  
  const handleParticipantDisconnected = (participant: RemoteParticipant) => {
    console.log('Participant disconnected:', participant.identity)
    setParticipants(prev => {
      const updated = new Map(prev)
      updated.delete(participant.identity)
      return updated
    })
    
    toast({
      title: 'Host Left',
      description: `${participant.identity} has left the studio`,
    })
  }
  
  const handleConnectionStateChanged = (state: ConnectionState) => {
    console.log('Connection state changed:', state)
    
    if (state === ConnectionState.Reconnecting) {
      setReconnecting(true)
      toast({
        title: 'Reconnecting...',
        description: 'Connection lost, attempting to reconnect',
      })
    } else if (state === ConnectionState.Connected) {
      if (reconnecting) {
        setReconnecting(false)
        toast({
          title: 'Reconnected',
          description: 'Connection restored',
        })
      }
    } else if (state === ConnectionState.Disconnected) {
      setReconnecting(false)
      handleDisconnect()
    }
  }

  const handleDisconnect = async () => {
    setIsConnected(false)
    
    // Notify API that we're leaving
    try {
      await fetch(`/api/streams/${streamId}/leave`, {
        method: 'POST',
      })
    } catch (error) {
      console.error('Error notifying leave:', error)
    }
    
    toast({
      title: 'Disconnected',
      description: 'You have been disconnected from the studio',
    })
  }

  const toggleVideo = async () => {
    // If connected to LiveKit, use LiveKit controls
    if (room && isConnected) {
      try {
        const enabled = !isCameraOn
        await room.localParticipant.setCameraEnabled(enabled)
        setIsCameraOn(enabled)
        setIsVideoEnabled(enabled)
        // Save preference
        devicePreferences.saveVideoEnabled(enabled)
      } catch (error) {
        console.error('Error toggling camera:', error)
        toast({
          title: 'Error',
          description: 'Failed to toggle camera',
          variant: 'destructive',
        })
      }
    } else if (streamRef.current) {
      // Use local stream for preview
      const videoTrack = streamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoEnabled(videoTrack.enabled)
        setIsCameraOn(videoTrack.enabled)
        // Save preference
        devicePreferences.saveVideoEnabled(videoTrack.enabled)
      }
    }
  }

  const toggleAudio = async () => {
    // If connected to LiveKit, use LiveKit controls
    if (room && isConnected) {
      try {
        const enabled = !isMicOn
        await room.localParticipant.setMicrophoneEnabled(enabled)
        setIsMicOn(enabled)
        setIsAudioEnabled(enabled)
        // Save preference
        devicePreferences.saveAudioEnabled(enabled)
      } catch (error) {
        console.error('Error toggling microphone:', error)
        toast({
          title: 'Error',
          description: 'Failed to toggle microphone',
          variant: 'destructive',
        })
      }
    } else if (streamRef.current) {
      // Use local stream for preview
      const audioTrack = streamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsAudioEnabled(audioTrack.enabled)
        setIsMicOn(audioTrack.enabled)
        // Save preference
        devicePreferences.saveAudioEnabled(audioTrack.enabled)
      }
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

  // Update viewer count from Supabase
  useEffect(() => {
    setViewerCount(supabaseViewerCount)
  }, [supabaseViewerCount])
  
  // Update heart count from Supabase
  useEffect(() => {
    setHeartCount(stats.heart_count)
  }, [stats.heart_count])
  
  // Sync UI controls with actual track states
  useEffect(() => {
    if (room && room.localParticipant && isConnected) {
      const participant = room.localParticipant
      
      // Check video track state
      if (participant.videoTracks && participant.videoTracks.size > 0) {
        const videoTrack = Array.from(participant.videoTracks.values())[0]
        if (videoTrack && videoTrack.track) {
          setIsCameraOn(!videoTrack.isMuted)
        }
      }
      
      // Check audio track state  
      if (participant.audioTracks && participant.audioTracks.size > 0) {
        const audioTrack = Array.from(participant.audioTracks.values())[0]
        if (audioTrack && audioTrack.track) {
          setIsMicOn(!audioTrack.isMuted)
        }
      }
    }
  }, [room, isConnected])

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

  const copyInviteLink = (url?: string) => {
    const linkToCopy = url || inviteLink
    if (linkToCopy) {
      navigator.clipboard.writeText(linkToCopy)
      toast({
        title: 'Copied!',
        description: 'Host invite link copied to clipboard',
      })
    }
  }

  const copyViewerLink = () => {
    const viewerUrl = `${window.location.origin}/stream/${streamId}`
    navigator.clipboard.writeText(viewerUrl)
    toast({
      title: 'Copied!',
      description: 'Viewer link copied to clipboard',
    })
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const isInviteExpired = (invite: HostInvite) => {
    return invite.expiresAt && new Date(invite.expiresAt) < new Date()
  }

  const isInviteExhausted = (invite: HostInvite) => {
    return invite.usedCount >= invite.maxUses
  }

  const kickHost = async (hostId: string, hostName: string) => {
    try {
      const response = await fetch(`/api/streams/${streamId}/hosts/${hostId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setHosts(prev => prev.filter(host => host.id !== hostId))
        toast({
          title: 'Host Removed',
          description: `${hostName} has been removed from the stream`,
        })
      } else {
        const error = await response.json()
        toast({
          title: 'Error',
          description: error.message || 'Failed to remove host',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove host',
        variant: 'destructive',
      })
    }
  }

  const leaveStudio = async () => {
    try {
      // Notify API that we're leaving
      await fetch(`/api/streams/${streamId}/leave`, {
        method: 'POST',
      })
    } catch (error) {
      console.error('Error leaving stream:', error)
    }
    
    // Disconnect from room
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
      
      // Use device preferences system
      const preferredVideoDevice = getPreferredDevice(devices, 'videoinput')
      const preferredAudioDevice = getPreferredDevice(devices, 'audioinput')
      
      if (preferredVideoDevice) {
        setSelectedVideoDevice(preferredVideoDevice.deviceId)
      } else if (videoInputs.length > 0 && !selectedVideoDevice) {
        setSelectedVideoDevice(videoInputs[0].deviceId)
        // Save first device as preference
        saveVideoDevice(videoInputs[0].deviceId)
      }
      
      if (preferredAudioDevice) {
        setSelectedAudioDevice(preferredAudioDevice.deviceId)
      } else if (audioInputs.length > 0 && !selectedAudioDevice) {
        setSelectedAudioDevice(audioInputs[0].deviceId)
        // Save first device as preference
        saveAudioDevice(audioInputs[0].deviceId)
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
      if (room && isConnected && room.localParticipant) {
        const newVideoTrack = streamRef.current.getVideoTracks()[0]
        if (newVideoTrack) {
          try {
            // Find and unpublish the old video track
            const videoPublication = Array.from(room.localParticipant.videoTracks.values())[0]
            if (videoPublication && videoPublication.track) {
              await room.localParticipant.unpublishTrack(videoPublication.track)
            }
            
            // Publish the new video track
            await room.localParticipant.publishTrack(newVideoTrack, {
              name: 'camera',
              source: Track.Source.Camera,
            })
          } catch (error) {
            console.error('Error updating LiveKit video track:', error)
          }
        }
      }
      
      // Save preference using device preferences system
      saveVideoDevice(deviceId)
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
        if (room && isConnected && room.localParticipant && newAudioTrack) {
          try {
            // Find and unpublish the old audio track
            const audioPublication = Array.from(room.localParticipant.audioTracks.values())[0]
            if (audioPublication && audioPublication.track) {
              await room.localParticipant.unpublishTrack(audioPublication.track)
            }
            
            // Publish the new audio track
            await room.localParticipant.publishTrack(newAudioTrack, {
              name: 'microphone',
              source: Track.Source.Microphone,
            })
          } catch (error) {
            console.error('Error updating LiveKit audio track:', error)
          }
        }
      }
      
      // Save preference using device preferences system
      saveAudioDevice(deviceId)
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
      {/* Floating Hearts Animation */}
      <FloatingHearts heartCount={heartCount} enabled={showHearts} />
      
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

        {/* Streaming Status */}
        {isConnected && room && room.localParticipant && (
          <div className="px-6 py-2 bg-gray-800 border-b border-gray-700">
            <StreamingStatus
              streamingHealth={getStreamingHealth()}
              egressStatus={egressStatus}
              onRestartEgress={() => restartEgress('Manual restart')}
              isLive={isLive}
              compact={true}
            />
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex">
          {/* Video Grid */}
          <div className={`flex-1 p-4 transition-all duration-300 ${showChat ? 'pr-0' : ''}`}>
            {/* Dynamic grid based on number of participants */}
            <div className={`grid gap-4 h-full ${
              participants.size === 0 ? 'grid-cols-1' :
              participants.size === 1 ? 'grid-cols-2' :
              participants.size <= 3 ? 'grid-cols-2' :
              participants.size <= 5 ? 'grid-cols-3' :
              'grid-cols-3'
            }`}>
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
                  <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-1 rounded flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <span className="text-sm">{participant.name || participant.identity}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-80 bg-gray-800 p-4 flex flex-col gap-4 overflow-y-auto">
            {/* Stream Stats */}
            {isLive && (
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="font-medium mb-3">Live Stats</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Viewers
                    </span>
                    <span className="font-medium">{viewerCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Heart className="h-4 w-4" />
                      Hearts
                    </span>
                    <span className="font-medium">{heartCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Hosts
                    </span>
                    <span className="font-medium">{hosts.length}/{stream?.maxHosts}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="font-medium mb-3">Controls</h3>
              <div className="flex gap-2 mb-3">
                <Button
                  variant={isCameraOn ? "default" : "secondary"}
                  size="icon"
                  onClick={toggleVideo}
                  disabled={!hasPermission}
                >
                  {isCameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                </Button>
                <Button
                  variant={isMicOn ? "default" : "secondary"}
                  size="icon"
                  onClick={toggleAudio}
                  disabled={!hasPermission}
                >
                  {isMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  disabled={!isConnected}
                  onClick={() => setShowSettings(!showSettings)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Button
                  variant={showChat ? "default" : "secondary"}
                  size="icon"
                  onClick={() => setShowChat(!showChat)}
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
                <Button
                  variant={showHearts ? "default" : "secondary"}
                  size="icon"
                  onClick={() => setShowHearts(!showHearts)}
                  title={showHearts ? "Hide heart animations" : "Show heart animations"}
                >
                  <HeartHandshake className="h-4 w-4" />
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

            {/* Stream Links */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="font-medium mb-3">Share Stream</h3>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Viewer Link</label>
                  <div className="flex gap-2">
                    <Input
                      value={`${window.location.origin}/stream/${streamId}`}
                      readOnly
                      className="bg-gray-800 border-gray-600 text-xs"
                    />
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={copyViewerLink}
                      className="shrink-0"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Anyone can watch the stream with this link</p>
                </div>
                
                {stream?.userId === session?.user?.id && (
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Host Invite Link</label>
                    <div className="flex gap-2">
                      <Input
                        value={inviteLink || 'Generate an invite first'}
                        readOnly
                        className="bg-gray-800 border-gray-600 text-xs"
                      />
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={() => copyInviteLink()}
                        disabled={!inviteLink}
                        className="shrink-0"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Secure link for co-hosts to join</p>
                  </div>
                )}
              </div>
            </div>

            {/* Invite Management */}
            {stream?.userId === session?.user?.id && (
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">Host Invites</h3>
                  <Button
                    size="sm"
                    onClick={() => createHostInvite()}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create
                  </Button>
                </div>
                
                {hostInvites.length > 0 ? (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {hostInvites.slice(0, 3).map((invite) => (
                      <div key={invite.id} className="bg-gray-800 rounded p-2 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className={`px-2 py-1 rounded text-xs ${
                              !invite.isActive || isInviteExpired(invite) || isInviteExhausted(invite)
                                ? 'bg-red-600 text-white'
                                : 'bg-green-600 text-white'
                            }`}>
                              {!invite.isActive ? 'Revoked' :
                               isInviteExpired(invite) ? 'Expired' :
                               isInviteExhausted(invite) ? 'Used Up' : 'Active'}
                            </span>
                            <span className="text-gray-400">
                              {invite.usedCount}/{invite.maxUses}
                            </span>
                          </div>
                          {invite.expiresAt && (
                            <div className="text-xs text-gray-400 mt-1">
                              Expires: {formatTime(invite.expiresAt)}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => copyInviteLink(invite.inviteUrl)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-red-400 hover:text-red-300"
                            onClick={() => revokeHostInvite(invite.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    No active invites. Create one to invite co-hosts.
                  </p>
                )}
              </div>
            )}

            {/* Host List */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="font-medium mb-3 flex items-center justify-between">
                <span>Current Hosts</span>
                <span className="text-xs text-gray-400">{hosts.length} / ∞</span>
              </h3>
                <div className="space-y-2">
                  {hosts.map((host) => {
                    // Check if this host is connected to LiveKit
                    const isHostConnected = host.user.id === session?.user?.id 
                      ? isConnected 
                      : participants.has(host.user.name || host.user.email || '')
                    
                    return (
                      <div key={host.id} className="flex items-center justify-between p-2 bg-gray-800 rounded">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className={`w-2 h-2 rounded-full ${isHostConnected ? 'bg-green-500' : 'bg-gray-500'}`} 
                               title={isHostConnected ? 'Connected' : 'Not connected'} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{host.user.name}</p>
                            <p className="text-xs text-gray-400">{host.role}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {host.user.id === session?.user?.id ? (
                            <span className="text-xs bg-blue-600 px-2 py-1 rounded">You</span>
                          ) : stream?.userId === session?.user?.id ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-red-400 hover:text-red-300"
                              onClick={() => kickHost(host.id, host.user.name)}
                              title="Remove host"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                    </div>
                  ))}
                  {hosts.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">
                      No hosts yet. Create an invite to add co-hosts.
                    </p>
                  )}
                </div>
              </div>
          </div>
          
          {/* Chat Panel - Right Column */}
          {showChat && (
            <div className="w-80 h-full">
              <StudioChatSupabase 
                streamId={streamId} 
                onClose={() => setShowChat(false)} 
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}