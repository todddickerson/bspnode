# LiveKit → Mux Streaming Architecture Implementation Guide

## Overview
This document provides a comprehensive guide for implementing a scalable streaming architecture where broadcasters stream via browser/LiveKit, LiveKit RTMP egress pushes to Mux, and viewers watch via Mux HLS playback.

## Architecture Flow
```
Broadcaster (Browser) → LiveKit WebRTC → LiveKit RTMP Egress → Mux RTMP Ingest → Mux HLS → Viewers
```

## 1. LiveKit RTMP Egress Configuration

### Enhanced RTMP Egress Function
The current implementation in `/lib/livekit.ts` can be enhanced with better error handling and configuration options:

```typescript
export interface RtmpEgressOptions {
  roomName: string
  rtmpUrl: string
  layout?: 'grid' | 'speaker' | 'single-speaker'
  videoCodec?: 'h264' | 'vp8'
  videoBitrate?: number
  audioBitrate?: number
  width?: number
  height?: number
  framerate?: number
}

export async function startRtmpEgress(options: RtmpEgressOptions) {
  const {
    roomName,
    rtmpUrl,
    layout = 'speaker',
    videoCodec = 'h264',
    videoBitrate = 2500000, // 2.5 Mbps
    audioBitrate = 128000,  // 128 kbps
    width = 1920,
    height = 1080,
    framerate = 30
  } = options

  try {
    const egress = await egressClient.startRoomCompositeEgress({
      roomName,
      layout,
      stream: {
        protocol: LivekitStreamProtocol.RTMP,
        urls: [rtmpUrl],
      },
      streamOutputs: [{
        protocol: LivekitStreamProtocol.RTMP,
        urls: [rtmpUrl],
      }],
      // Advanced settings for quality
      advanced: {
        width,
        height,
        framerate,
        videoBitrate,
        audioBitrate,
        videoCodec,
      },
      // Enable audio-only fallback
      audioOnly: false,
      videoOnly: false,
    })
    
    return {
      egressId: egress.egressId,
      streamKey: egress.streamKey,
      status: egress.status,
    }
  } catch (error) {
    console.error('Failed to start RTMP egress:', error)
    throw error
  }
}
```

### Multiple RTMP Endpoints for Redundancy
```typescript
export async function startRedundantRtmpEgress(
  roomName: string,
  primaryRtmpUrl: string,
  backupRtmpUrl?: string
) {
  const urls = [primaryRtmpUrl]
  if (backupRtmpUrl) {
    urls.push(backupRtmpUrl)
  }

  return await egressClient.startRoomCompositeEgress({
    roomName,
    layout: 'speaker',
    stream: {
      protocol: LivekitStreamProtocol.RTMP,
      urls, // LiveKit will multicast to all URLs
    }
  })
}
```

## 2. Mux Live Stream Creation with Enhanced Options

### Improved Mux Stream Creation
```typescript
export interface MuxStreamOptions {
  userId: string
  reducedLatency?: boolean
  reconnectWindow?: number
  maxContinuousDuration?: number
  simulcastTargets?: Array<{
    url: string
    streamKey: string
  }>
}

export async function createLiveStream(options: MuxStreamOptions) {
  const {
    userId,
    reducedLatency = true,
    reconnectWindow = 60, // seconds
    maxContinuousDuration = 24 * 60 * 60, // 24 hours
    simulcastTargets = []
  } = options

  try {
    const stream = await Video.LiveStreams.create({
      playback_policy: ['public'],
      new_asset_settings: {
        playback_policy: ['public'],
      },
      // Enable reduced latency for ~10s delay
      reduced_latency: reducedLatency,
      // Reconnect window for temporary disconnections
      reconnect_window: reconnectWindow,
      // Maximum stream duration
      max_continuous_duration: maxContinuousDuration,
      // Simulcast to other platforms
      simulcast_targets: simulcastTargets,
      // Test mode for development
      test: process.env.NODE_ENV === 'development',
    })

    return {
      streamKey: stream.stream_key,
      playbackId: stream.playback_ids?.[0]?.id,
      liveStreamId: stream.id,
      rtmpUrl: `rtmps://global-live.mux.com:443/app/${stream.stream_key}`,
      status: stream.status,
    }
  } catch (error) {
    console.error('Mux API error:', error)
    throw error
  }
}
```

## 3. Complete Broadcast Flow Implementation

### Start Broadcast Endpoint Enhancement
```typescript
// app/api/streams/[id]/start/route.ts
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const stream = await prisma.stream.findUnique({
      where: { id: params.id },
    })

    if (!stream || stream.userId !== session.user.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Different flow based on stream type
    if (stream.streamType === 'LIVEKIT') {
      // 1. Create LiveKit room
      const room = await createRoom(stream.id, 100)
      
      // 2. Create Mux live stream
      const muxStream = await createLiveStream({
        userId: session.user.id,
        reducedLatency: true,
      })
      
      // 3. Update stream with details
      await prisma.stream.update({
        where: { id: params.id },
        data: {
          status: 'CREATED',
          liveKitRoomName: room.name,
          liveKitRoomId: room.sid,
          muxStreamKey: muxStream.streamKey,
          muxPlaybackId: muxStream.playbackId,
          muxAssetId: muxStream.liveStreamId,
        },
      })

      // 4. Generate token for broadcaster
      const token = await generateToken({
        roomName: room.name,
        participantName: session.user.name || 'Host',
        participantId: session.user.id,
        canPublish: true,
        canSubscribe: true,
      })

      return NextResponse.json({
        token,
        roomName: room.name,
        playbackId: muxStream.playbackId,
        rtmpUrl: muxStream.rtmpUrl,
      })
    }

    // Handle other stream types...
  } catch (error) {
    console.error('Error starting stream:', error)
    return NextResponse.json({ message: 'Failed to start stream' }, { status: 500 })
  }
}
```

### Start Egress When First Viewer Joins
```typescript
// app/api/streams/[id]/viewer-token/route.ts
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const stream = await prisma.stream.findUnique({
    where: { id: params.id },
  })

  // Check if egress is already running
  if (!stream.egressId && stream.status === 'LIVE') {
    // Start egress when first viewer joins
    const rtmpUrl = `rtmps://global-live.mux.com:443/app/${stream.muxStreamKey}`
    const egress = await startRtmpEgress({
      roomName: stream.liveKitRoomName,
      rtmpUrl,
      layout: 'speaker',
    })

    await prisma.stream.update({
      where: { id: params.id },
      data: {
        egressId: egress.egressId,
      },
    })
  }

  // Generate viewer token...
}
```

## 4. Viewer Playback Implementation

### HLS Playback URL Generation
```typescript
export function getMuxPlaybackUrl(playbackId: string, options?: {
  reducedLatency?: boolean
  token?: string
}) {
  const base = `https://stream.mux.com/${playbackId}.m3u8`
  const params = new URLSearchParams()
  
  if (options?.reducedLatency) {
    params.append('latency', 'reduced')
  }
  
  if (options?.token) {
    params.append('token', options.token)
  }
  
  return params.toString() ? `${base}?${params}` : base
}
```

### Video Player Component with Mux Player
```typescript
// components/mux-player.tsx
import MuxPlayer from '@mux/mux-player-react'

export function StreamPlayer({ playbackId, isLive }: { 
  playbackId: string
  isLive: boolean 
}) {
  const playbackUrl = getMuxPlaybackUrl(playbackId, {
    reducedLatency: isLive,
  })

  return (
    <MuxPlayer
      playbackId={playbackId}
      streamType={isLive ? 'live' : 'on-demand'}
      autoPlay
      muted // Required for autoplay
      controls
      style={{ width: '100%', height: '100%' }}
      onError={(error) => {
        console.error('Playback error:', error)
      }}
    />
  )
}
```

## 5. Best Practices for Latency and Quality

### Adaptive Bitrate Configuration
```typescript
const adaptiveBitrateSettings = {
  // For 1080p source
  high: {
    width: 1920,
    height: 1080,
    framerate: 30,
    videoBitrate: 4500000, // 4.5 Mbps
    audioBitrate: 192000,  // 192 kbps
  },
  // For 720p
  medium: {
    width: 1280,
    height: 720,
    framerate: 30,
    videoBitrate: 2500000, // 2.5 Mbps
    audioBitrate: 128000,  // 128 kbps
  },
  // For 480p
  low: {
    width: 854,
    height: 480,
    framerate: 30,
    videoBitrate: 1000000, // 1 Mbps
    audioBitrate: 96000,   // 96 kbps
  },
}
```

### Network Quality Monitoring
```typescript
// Monitor participant connection quality
export async function monitorStreamQuality(roomName: string) {
  const participants = await listParticipants(roomName)
  
  const qualityReport = participants.map(p => ({
    participantId: p.sid,
    connectionQuality: p.connectionQuality,
    isPublisher: p.permission?.canPublish,
    tracks: p.tracks?.map(t => ({
      type: t.type,
      muted: t.muted,
      simulcasted: t.simulcasted,
    })),
  }))
  
  return qualityReport
}
```

## 6. Stopping Egress and Cleanup

### Enhanced Stop Egress Implementation
```typescript
export async function stopStreamAndCleanup(streamId: string) {
  const stream = await prisma.stream.findUnique({
    where: { id: streamId },
  })

  if (!stream) {
    throw new Error('Stream not found')
  }

  const errors = []

  // 1. Stop RTMP egress
  if (stream.egressId) {
    try {
      await stopEgress(stream.egressId)
    } catch (error) {
      errors.push({ type: 'egress', error })
    }
  }

  // 2. Stop recording egress if separate
  if (stream.recordingEgressId && stream.recordingEgressId !== stream.egressId) {
    try {
      await stopEgress(stream.recordingEgressId)
    } catch (error) {
      errors.push({ type: 'recording', error })
    }
  }

  // 3. Update stream status
  await prisma.stream.update({
    where: { id: streamId },
    data: {
      status: 'ENDED',
      endedAt: new Date(),
      recordingStatus: 'PROCESSING',
    },
  })

  // 4. Delete LiveKit room (with delay for final segments)
  setTimeout(async () => {
    try {
      if (stream.liveKitRoomName) {
        await deleteRoom(stream.liveKitRoomName)
      }
    } catch (error) {
      console.error('Failed to delete room:', error)
    }
  }, 5000) // 5 second delay

  if (errors.length > 0) {
    console.error('Cleanup errors:', errors)
  }

  return { success: true, errors }
}
```

## 7. Error Handling and Fallbacks

### Comprehensive Error Handler
```typescript
export class StreamingError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true
  ) {
    super(message)
    this.name = 'StreamingError'
  }
}

export async function handleStreamingError(
  error: any,
  streamId: string
): Promise<{ fallback: string; action: () => Promise<void> }> {
  if (error.code === 'EGRESS_FAILED') {
    return {
      fallback: 'direct_livekit',
      action: async () => {
        // Enable direct LiveKit viewing
        await prisma.stream.update({
          where: { id: streamId },
          data: { fallbackMode: 'DIRECT_WEBRTC' },
        })
      },
    }
  }

  if (error.code === 'MUX_UNREACHABLE') {
    return {
      fallback: 'local_recording',
      action: async () => {
        // Start local recording
        const recordingEgress = await startRecording(roomName)
        await prisma.stream.update({
          where: { id: streamId },
          data: { 
            fallbackMode: 'LOCAL_RECORDING',
            recordingEgressId: recordingEgress.egressId,
          },
        })
      },
    }
  }

  // Default fallback
  return {
    fallback: 'notify_users',
    action: async () => {
      await prisma.stream.update({
        where: { id: streamId },
        data: { 
          status: 'ENDED',
          errorMessage: error.message,
        },
      })
    },
  }
}
```

### Webhook Event Handlers
```typescript
// Enhanced webhook handlers for monitoring
export async function handleLiveKitWebhook(event: any) {
  switch (event.event) {
    case 'egress_started':
      await prisma.stream.update({
        where: { egressId: event.egressInfo.egressId },
        data: { 
          egressStatus: 'ACTIVE',
          egressStartedAt: new Date(),
        },
      })
      break

    case 'egress_ended':
      const { egressId, error } = event.egressInfo
      if (error) {
        await handleEgressError(egressId, error)
      }
      break

    case 'participant_connected':
      // Track host connections
      if (event.participant.permission?.canPublish) {
        await trackHostConnection(event)
      }
      break
  }
}

export async function handleMuxWebhook(event: any) {
  switch (event.type) {
    case 'video.live_stream.active':
      // Stream is receiving data
      await prisma.stream.update({
        where: { muxAssetId: event.data.id },
        data: { 
          muxStatus: 'ACTIVE',
          rtmpConnectedAt: new Date(),
        },
      })
      break

    case 'video.live_stream.disconnected':
      // RTMP disconnected - may reconnect
      await handleRtmpDisconnection(event.data)
      break

    case 'video.live_stream.idle':
      // Stream ended
      await handleStreamIdle(event.data)
      break
  }
}
```

## 8. Performance Monitoring and Analytics

### Stream Analytics Collection
```typescript
export interface StreamMetrics {
  streamId: string
  timestamp: Date
  viewers: number
  bandwidth: {
    ingress: number // bps
    egress: number  // bps
  }
  quality: {
    bitrate: number
    framerate: number
    resolution: string
  }
  errors: number
  reconnections: number
}

export async function collectStreamMetrics(streamId: string): Promise<StreamMetrics> {
  const stream = await prisma.stream.findUnique({
    where: { id: streamId },
    include: { _count: { select: { messages: true } } },
  })

  const participants = await listParticipants(stream.liveKitRoomName)
  const viewers = participants.filter(p => !p.permission?.canPublish).length

  // Get quality metrics from LiveKit
  const publisher = participants.find(p => p.permission?.canPublish)
  const videoTrack = publisher?.tracks?.find(t => t.type === 'VIDEO')

  return {
    streamId,
    timestamp: new Date(),
    viewers,
    bandwidth: {
      ingress: videoTrack?.videoBitrate || 0,
      egress: viewers * (videoTrack?.videoBitrate || 0),
    },
    quality: {
      bitrate: videoTrack?.videoBitrate || 0,
      framerate: videoTrack?.framerate || 0,
      resolution: `${videoTrack?.width}x${videoTrack?.height}`,
    },
    errors: 0, // From error tracking
    reconnections: 0, // From connection tracking
  }
}
```

## 9. Cost Optimization Strategies

### Viewer-Based Egress Management
```typescript
export async function optimizeEgressForViewers(streamId: string) {
  const stream = await prisma.stream.findUnique({
    where: { id: streamId },
  })

  const participants = await listParticipants(stream.liveKitRoomName)
  const viewerCount = participants.filter(p => !p.permission?.canPublish).length

  // No viewers - stop egress to save costs
  if (viewerCount === 0 && stream.egressId) {
    await stopEgress(stream.egressId)
    await prisma.stream.update({
      where: { id: streamId },
      data: { egressId: null },
    })
  }

  // First viewer joined - start egress
  if (viewerCount === 1 && !stream.egressId) {
    const egress = await startRtmpEgress({
      roomName: stream.liveKitRoomName,
      rtmpUrl: `rtmps://global-live.mux.com:443/app/${stream.muxStreamKey}`,
    })
    await prisma.stream.update({
      where: { id: streamId },
      data: { egressId: egress.egressId },
    })
  }
}
```

## 10. Testing and Debugging

### Stream Health Check Endpoint
```typescript
// app/api/streams/[id]/health/route.ts
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const stream = await prisma.stream.findUnique({
    where: { id: params.id },
  })

  const health = {
    stream: {
      id: stream.id,
      status: stream.status,
      type: stream.streamType,
    },
    livekit: {
      roomName: stream.liveKitRoomName,
      participants: await listParticipants(stream.liveKitRoomName),
      egressActive: !!stream.egressId,
    },
    mux: {
      hasPlaybackId: !!stream.muxPlaybackId,
      streamKey: stream.muxStreamKey ? 'configured' : 'missing',
      status: stream.muxStatus,
    },
    metrics: await collectStreamMetrics(stream.id),
  }

  return NextResponse.json(health)
}
```

## Conclusion

This architecture provides a robust, scalable solution for browser-based broadcasting with professional-grade streaming quality. Key benefits include:

1. **Low Latency**: ~10-15 seconds with Mux reduced latency mode
2. **High Quality**: Adaptive bitrate streaming with multiple quality levels  
3. **Reliability**: Automatic reconnection and fallback strategies
4. **Scalability**: Can handle thousands of concurrent viewers
5. **Cost Efficiency**: Optimized egress management based on viewer count

Regular monitoring of LiveKit and Mux webhooks ensures system health and enables proactive error handling.