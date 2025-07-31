import { prisma } from './prisma'
import { 
  createRoom, 
  generateToken, 
  deleteRoom,
  listParticipants,
} from './livekit'
import { 
  startEnhancedRtmpEgress,
  stopEgressGracefully,
  getStreamQualityMetrics,
  hasActiveEgress,
  startAdaptiveRtmpEgress,
} from './livekit-enhanced'
import {
  createEnhancedLiveStream,
  getLiveStreamHealth,
  getMuxPlaybackUrl,
  isStreamActive,
} from './mux-enhanced'

// Types
export interface StreamingSession {
  streamId: string
  roomName: string
  rtmpUrl: string
  playbackUrl: string
  token: string
  egressId?: string
}

export interface StreamingError {
  code: string
  message: string
  recoverable: boolean
}

// Error codes
export const ErrorCodes = {
  ROOM_CREATION_FAILED: 'ROOM_CREATION_FAILED',
  MUX_CREATION_FAILED: 'MUX_CREATION_FAILED',
  EGRESS_START_FAILED: 'EGRESS_START_FAILED',
  EGRESS_STOP_FAILED: 'EGRESS_STOP_FAILED',
  STREAM_NOT_FOUND: 'STREAM_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  ALREADY_BROADCASTING: 'ALREADY_BROADCASTING',
  NO_ACTIVE_BROADCAST: 'NO_ACTIVE_BROADCAST',
} as const

/**
 * Initialize a complete streaming session
 */
export async function initializeStreamingSession(
  streamId: string,
  userId: string,
  userName: string
): Promise<StreamingSession> {
  // 1. Validate stream ownership
  const stream = await prisma.stream.findUnique({
    where: { id: streamId },
  })

  if (!stream) {
    throw createStreamingError(
      ErrorCodes.STREAM_NOT_FOUND,
      'Stream not found'
    )
  }

  if (stream.userId !== userId) {
    throw createStreamingError(
      ErrorCodes.UNAUTHORIZED,
      'Unauthorized access to stream'
    )
  }

  if (stream.status === 'LIVE') {
    throw createStreamingError(
      ErrorCodes.ALREADY_BROADCASTING,
      'Stream is already broadcasting'
    )
  }

  try {
    // 2. Create LiveKit room
    console.log('Creating LiveKit room...')
    const room = await createRoom(streamId, 100)

    // 3. Create Mux live stream
    console.log('Creating Mux live stream...')
    const muxStream = await createEnhancedLiveStream({
      userId,
      reducedLatency: true,
      reconnectWindow: 60,
      maxContinuousDuration: 8 * 60 * 60, // 8 hours
    })

    // 4. Update stream record
    await prisma.stream.update({
      where: { id: streamId },
      data: {
        status: 'CREATED',
        liveKitRoomName: room.name,
        liveKitRoomId: room.sid,
        muxStreamKey: muxStream.streamKey,
        muxPlaybackId: muxStream.playbackId,
        muxAssetId: muxStream.liveStreamId,
      },
    })

    // 5. Generate broadcaster token
    const token = await generateToken({
      roomName: room.name,
      participantName: userName,
      participantId: userId,
      canPublish: true,
      canSubscribe: true,
    })

    // 6. Prepare response
    const playbackUrl = getMuxPlaybackUrl(muxStream.playbackId, {
      reducedLatency: true,
    })

    return {
      streamId,
      roomName: room.name,
      rtmpUrl: muxStream.rtmpsUrl, // Use secure RTMPS
      playbackUrl,
      token,
    }
  } catch (error) {
    // Cleanup on failure
    await cleanupFailedSession(streamId)
    
    if (error.message.includes('LiveKit')) {
      throw createStreamingError(
        ErrorCodes.ROOM_CREATION_FAILED,
        'Failed to create broadcasting room'
      )
    }
    
    if (error.message.includes('Mux')) {
      throw createStreamingError(
        ErrorCodes.MUX_CREATION_FAILED,
        'Failed to create streaming endpoint'
      )
    }
    
    throw error
  }
}

/**
 * Start RTMP egress when broadcaster goes live
 */
export async function startBroadcastEgress(
  streamId: string,
  options?: {
    waitForViewers?: boolean
    layout?: 'grid' | 'speaker'
  }
): Promise<{ egressId: string; status: string }> {
  const { waitForViewers = false, layout = 'speaker' } = options || {}

  const stream = await prisma.stream.findUnique({
    where: { id: streamId },
  })

  if (!stream || !stream.liveKitRoomName || !stream.muxStreamKey) {
    throw createStreamingError(
      ErrorCodes.STREAM_NOT_FOUND,
      'Stream configuration incomplete'
    )
  }

  // Check if egress already exists
  if (stream.egressId) {
    const hasEgress = await hasActiveEgress(stream.liveKitRoomName)
    if (hasEgress) {
      return { egressId: stream.egressId, status: 'already_active' }
    }
  }

  // Wait for viewers if configured
  if (waitForViewers) {
    const participants = await listParticipants(stream.liveKitRoomName)
    const viewerCount = participants.filter(p => !p.permission?.canPublish).length
    
    if (viewerCount === 0) {
      // Don't start egress yet
      return { egressId: '', status: 'waiting_for_viewers' }
    }
  }

  try {
    // Start adaptive RTMP egress
    const rtmpUrl = `rtmps://global-live.mux.com:443/app/${stream.muxStreamKey}`
    const egress = await startAdaptiveRtmpEgress(
      stream.liveKitRoomName,
      rtmpUrl
    )

    // Update stream with egress ID
    await prisma.stream.update({
      where: { id: streamId },
      data: {
        egressId: egress.egressId,
        status: 'LIVE',
        startedAt: new Date(),
      },
    })

    return {
      egressId: egress.egressId,
      status: 'started',
    }
  } catch (error) {
    console.error('Failed to start egress:', error)
    throw createStreamingError(
      ErrorCodes.EGRESS_START_FAILED,
      'Failed to start broadcast output',
      true // Recoverable
    )
  }
}

/**
 * Stop broadcast and cleanup resources
 */
export async function stopBroadcast(
  streamId: string
): Promise<{ success: boolean; duration?: number }> {
  const stream = await prisma.stream.findUnique({
    where: { id: streamId },
  })

  if (!stream) {
    throw createStreamingError(
      ErrorCodes.STREAM_NOT_FOUND,
      'Stream not found'
    )
  }

  if (stream.status !== 'LIVE') {
    throw createStreamingError(
      ErrorCodes.NO_ACTIVE_BROADCAST,
      'No active broadcast to stop'
    )
  }

  const errors: StreamingError[] = []

  // 1. Calculate duration
  const duration = stream.startedAt
    ? Math.floor((Date.now() - stream.startedAt.getTime()) / 1000)
    : 0

  // 2. Stop RTMP egress
  if (stream.egressId) {
    try {
      const stopped = await stopEgressGracefully(stream.egressId, 3)
      if (!stopped) {
        errors.push(createStreamingError(
          ErrorCodes.EGRESS_STOP_FAILED,
          'Failed to stop egress gracefully',
          false
        ))
      }
    } catch (error) {
      errors.push(createStreamingError(
        ErrorCodes.EGRESS_STOP_FAILED,
        error.message,
        false
      ))
    }
  }

  // 3. Update stream status
  await prisma.stream.update({
    where: { id: streamId },
    data: {
      status: 'ENDED',
      endedAt: new Date(),
      duration,
      recordingStatus: 'PROCESSING',
    },
  })

  // 4. Schedule room cleanup (delay for final segments)
  setTimeout(async () => {
    try {
      if (stream.liveKitRoomName) {
        await deleteRoom(stream.liveKitRoomName)
      }
    } catch (error) {
      console.error('Room cleanup failed:', error)
    }
  }, 10000) // 10 second delay

  if (errors.length > 0) {
    console.error('Broadcast stop errors:', errors)
  }

  return {
    success: errors.length === 0,
    duration,
  }
}

/**
 * Get comprehensive stream health status
 */
export async function getStreamHealth(streamId: string) {
  const stream = await prisma.stream.findUnique({
    where: { id: streamId },
    include: {
      _count: {
        select: {
          messages: true,
          hosts: true,
        },
      },
    },
  })

  if (!stream) {
    throw createStreamingError(
      ErrorCodes.STREAM_NOT_FOUND,
      'Stream not found'
    )
  }

  // Get various health metrics
  const [liveKitMetrics, muxHealth, participants] = await Promise.all([
    stream.liveKitRoomName
      ? getStreamQualityMetrics(stream.liveKitRoomName).catch(() => [])
      : [],
    stream.muxAssetId
      ? getLiveStreamHealth(stream.muxAssetId).catch(() => null)
      : null,
    stream.liveKitRoomName
      ? listParticipants(stream.liveKitRoomName).catch(() => [])
      : [],
  ])

  const publishers = participants.filter(p => p.permission?.canPublish)
  const viewers = participants.filter(p => !p.permission?.canPublish)

  return {
    stream: {
      id: stream.id,
      title: stream.title,
      status: stream.status,
      type: stream.streamType,
      duration: stream.duration,
      startedAt: stream.startedAt,
      endedAt: stream.endedAt,
    },
    livekit: {
      roomName: stream.liveKitRoomName,
      hasRoom: !!stream.liveKitRoomName,
      publishers: publishers.length,
      viewers: viewers.length,
      totalParticipants: participants.length,
      egressActive: !!stream.egressId,
      quality: liveKitMetrics,
    },
    mux: {
      hasStream: !!stream.muxAssetId,
      streamId: stream.muxAssetId,
      playbackId: stream.muxPlaybackId,
      status: muxHealth?.status || 'unknown',
      recentAssets: muxHealth?.recentAssetIds || [],
    },
    stats: {
      messages: stream._count.messages,
      hosts: stream._count.hosts,
      viewerCount: stream.viewerCount,
    },
    health: {
      isHealthy: stream.status === 'LIVE' 
        ? !!(publishers.length > 0 && muxHealth?.status === 'active')
        : true,
      issues: [],
    },
  }
}

/**
 * Handle viewer joining - start egress if needed
 */
export async function handleViewerJoin(
  streamId: string,
  viewerId: string
): Promise<{ token: string; playbackUrl: string }> {
  const stream = await prisma.stream.findUnique({
    where: { id: streamId },
  })

  if (!stream || !stream.liveKitRoomName) {
    throw createStreamingError(
      ErrorCodes.STREAM_NOT_FOUND,
      'Stream not found or not configured'
    )
  }

  // Generate viewer token
  const token = await generateToken({
    roomName: stream.liveKitRoomName,
    participantName: `Viewer ${viewerId.slice(0, 8)}`,
    participantId: viewerId,
    canPublish: false,
    canSubscribe: true,
  })

  // Start egress if not already running and stream is live
  if (stream.status === 'LIVE' && !stream.egressId) {
    try {
      await startBroadcastEgress(streamId, { waitForViewers: false })
    } catch (error) {
      console.error('Failed to start egress for viewer:', error)
      // Continue - viewer can still watch via WebRTC
    }
  }

  const playbackUrl = stream.muxPlaybackId
    ? getMuxPlaybackUrl(stream.muxPlaybackId, { reducedLatency: true })
    : ''

  // Increment viewer count
  await prisma.stream.update({
    where: { id: streamId },
    data: {
      viewerCount: {
        increment: 1,
      },
    },
  })

  return {
    token,
    playbackUrl,
  }
}

/**
 * Monitor and optimize egress based on viewer count
 */
export async function optimizeEgress(streamId: string): Promise<void> {
  const stream = await prisma.stream.findUnique({
    where: { id: streamId },
  })

  if (!stream || stream.status !== 'LIVE' || !stream.liveKitRoomName) {
    return
  }

  const participants = await listParticipants(stream.liveKitRoomName)
  const viewerCount = participants.filter(p => !p.permission?.canPublish).length

  // Stop egress if no viewers for 2 minutes
  if (viewerCount === 0 && stream.egressId) {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
    
    if (stream.startedAt && stream.startedAt < twoMinutesAgo) {
      console.log('Stopping egress - no viewers for 2 minutes')
      await stopEgressGracefully(stream.egressId, 1)
      
      await prisma.stream.update({
        where: { id: streamId },
        data: { egressId: null },
      })
    }
  }

  // Start egress if viewers joined
  if (viewerCount > 0 && !stream.egressId) {
    console.log('Starting egress - viewers joined')
    await startBroadcastEgress(streamId)
  }
}

// Helper functions

function createStreamingError(
  code: string,
  message: string,
  recoverable: boolean = false
): StreamingError {
  return {
    code,
    message,
    recoverable,
  }
}

async function cleanupFailedSession(streamId: string): Promise<void> {
  try {
    const stream = await prisma.stream.findUnique({
      where: { id: streamId },
    })

    if (stream?.liveKitRoomName) {
      await deleteRoom(stream.liveKitRoomName).catch(() => {})
    }

    await prisma.stream.update({
      where: { id: streamId },
      data: {
        status: 'CREATED',
        liveKitRoomName: null,
        liveKitRoomId: null,
        muxStreamKey: null,
        muxPlaybackId: null,
        muxAssetId: null,
      },
    })
  } catch (error) {
    console.error('Cleanup failed:', error)
  }
}

// Export service
export const streamingService = {
  initializeStreamingSession,
  startBroadcastEgress,
  stopBroadcast,
  getStreamHealth,
  handleViewerJoin,
  optimizeEgress,
  ErrorCodes,
}