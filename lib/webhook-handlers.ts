import { prisma } from './prisma'
import { streamingService } from './streaming-service'
import { stopEgressGracefully } from './livekit-enhanced'

// LiveKit webhook event types
export enum LiveKitEventType {
  ROOM_STARTED = 'room_started',
  ROOM_FINISHED = 'room_finished',
  PARTICIPANT_JOINED = 'participant_joined',
  PARTICIPANT_LEFT = 'participant_left',
  TRACK_PUBLISHED = 'track_published',
  TRACK_UNPUBLISHED = 'track_unpublished',
  EGRESS_STARTED = 'egress_started',
  EGRESS_UPDATED = 'egress_updated',
  EGRESS_ENDED = 'egress_ended',
}

// Mux webhook event types
export enum MuxEventType {
  LIVE_STREAM_CREATED = 'video.live_stream.created',
  LIVE_STREAM_CONNECTED = 'video.live_stream.connected',
  LIVE_STREAM_RECORDING = 'video.live_stream.recording',
  LIVE_STREAM_ACTIVE = 'video.live_stream.active',
  LIVE_STREAM_DISCONNECTED = 'video.live_stream.disconnected',
  LIVE_STREAM_IDLE = 'video.live_stream.idle',
  LIVE_STREAM_DELETED = 'video.live_stream.deleted',
  ASSET_CREATED = 'video.asset.created',
  ASSET_READY = 'video.asset.ready',
  ASSET_ERRORED = 'video.asset.errored',
}

// Interfaces
export interface LiveKitWebhookEvent {
  event: LiveKitEventType
  room?: {
    name: string
    sid: string
    creationTime: number
  }
  participant?: {
    sid: string
    identity: string
    permission?: {
      canPublish: boolean
      canSubscribe: boolean
    }
  }
  egressInfo?: {
    egressId: string
    roomName: string
    status: string
    error?: string
    startedAt: number
    endedAt?: number
  }
  track?: {
    sid: string
    type: 'AUDIO' | 'VIDEO'
    source: string
  }
  timestamp: number
}

export interface MuxWebhookEvent {
  type: MuxEventType
  data: {
    id: string
    status?: string
    new_asset_id?: string
    playback_ids?: Array<{ id: string; policy: string }>
    duration?: number
    reconnect_window?: number
    active_ingest_protocol?: string
    recent_asset_ids?: string[]
    passthrough?: string
  }
  created_at: string
}

/**
 * Handle LiveKit webhook events
 */
export async function handleLiveKitWebhook(event: LiveKitWebhookEvent): Promise<void> {
  console.log(`LiveKit webhook: ${event.event}`, {
    room: event.room?.name,
    participant: event.participant?.identity,
    egress: event.egressInfo?.egressId,
  })

  switch (event.event) {
    case LiveKitEventType.ROOM_STARTED:
      await handleRoomStarted(event)
      break

    case LiveKitEventType.ROOM_FINISHED:
      await handleRoomFinished(event)
      break

    case LiveKitEventType.PARTICIPANT_JOINED:
      await handleParticipantJoined(event)
      break

    case LiveKitEventType.PARTICIPANT_LEFT:
      await handleParticipantLeft(event)
      break

    case LiveKitEventType.EGRESS_STARTED:
      await handleEgressStarted(event)
      break

    case LiveKitEventType.EGRESS_ENDED:
      await handleEgressEnded(event)
      break

    case LiveKitEventType.TRACK_PUBLISHED:
      await handleTrackPublished(event)
      break

    default:
      console.log('Unhandled LiveKit event:', event.event)
  }
}

/**
 * Handle Mux webhook events
 */
export async function handleMuxWebhook(event: MuxWebhookEvent): Promise<void> {
  console.log(`Mux webhook: ${event.type}`, {
    id: event.data.id,
    status: event.data.status,
  })

  switch (event.type) {
    case MuxEventType.LIVE_STREAM_ACTIVE:
      await handleLiveStreamActive(event)
      break

    case MuxEventType.LIVE_STREAM_DISCONNECTED:
      await handleLiveStreamDisconnected(event)
      break

    case MuxEventType.LIVE_STREAM_IDLE:
      await handleLiveStreamIdle(event)
      break

    case MuxEventType.LIVE_STREAM_RECORDING:
      await handleLiveStreamRecording(event)
      break

    case MuxEventType.ASSET_READY:
      await handleAssetReady(event)
      break

    case MuxEventType.ASSET_ERRORED:
      await handleAssetErrored(event)
      break

    default:
      console.log('Unhandled Mux event:', event.type)
  }
}

// LiveKit event handlers

async function handleRoomStarted(event: LiveKitWebhookEvent): Promise<void> {
  if (!event.room) return

  const stream = await prisma.stream.findFirst({
    where: { liveKitRoomName: event.room.name },
  })

  if (stream) {
    await prisma.stream.update({
      where: { id: stream.id },
      data: {
        liveKitRoomId: event.room.sid,
      },
    })
    
    console.log(`Room started for stream ${stream.id}`)
  }
}

async function handleRoomFinished(event: LiveKitWebhookEvent): Promise<void> {
  if (!event.room) return

  const stream = await prisma.stream.findFirst({
    where: { liveKitRoomName: event.room.name },
  })

  if (stream && stream.status === 'LIVE') {
    // Room finished unexpectedly while stream is live
    await streamingService.stopBroadcast(stream.id).catch(err => {
      console.error('Failed to stop broadcast on room finish:', err)
    })
  }
}

async function handleParticipantJoined(event: LiveKitWebhookEvent): Promise<void> {
  if (!event.room || !event.participant) return

  const stream = await prisma.stream.findFirst({
    where: { liveKitRoomName: event.room.name },
  })

  if (!stream) return

  const isHost = event.participant.permission?.canPublish || false

  if (isHost && stream.status === 'CREATED') {
    // Host joined - mark stream as live
    await prisma.stream.update({
      where: { id: stream.id },
      data: {
        status: 'LIVE',
        startedAt: new Date(),
      },
    })

    // Start egress if configured
    if (!stream.egressId) {
      await streamingService.startBroadcastEgress(stream.id, {
        waitForViewers: true,
      }).catch(err => {
        console.error('Failed to start egress on host join:', err)
      })
    }
  } else if (!isHost) {
    // Viewer joined - optimize egress
    await streamingService.optimizeEgress(stream.id).catch(err => {
      console.error('Failed to optimize egress:', err)
    })
  }
}

async function handleParticipantLeft(event: LiveKitWebhookEvent): Promise<void> {
  if (!event.room || !event.participant) return

  const stream = await prisma.stream.findFirst({
    where: { liveKitRoomName: event.room.name },
  })

  if (!stream) return

  const isHost = event.participant.permission?.canPublish || false

  if (isHost && stream.status === 'LIVE') {
    // Check if any hosts remain
    const health = await streamingService.getStreamHealth(stream.id)
    
    if (health.livekit.publishers === 0) {
      // Last host left - end stream
      console.log('Last host left, ending stream')
      await streamingService.stopBroadcast(stream.id).catch(err => {
        console.error('Failed to stop broadcast on host leave:', err)
      })
    }
  } else if (!isHost) {
    // Viewer left - update count and optimize
    await prisma.stream.update({
      where: { id: stream.id },
      data: {
        viewerCount: {
          decrement: 1,
        },
      },
    })

    await streamingService.optimizeEgress(stream.id).catch(err => {
      console.error('Failed to optimize egress:', err)
    })
  }
}

async function handleEgressStarted(event: LiveKitWebhookEvent): Promise<void> {
  if (!event.egressInfo) return

  const stream = await prisma.stream.findFirst({
    where: { 
      OR: [
        { egressId: event.egressInfo.egressId },
        { liveKitRoomName: event.egressInfo.roomName },
      ],
    },
  })

  if (stream) {
    await prisma.stream.update({
      where: { id: stream.id },
      data: {
        egressId: event.egressInfo.egressId,
        egressStatus: 'ACTIVE',
      },
    })

    console.log(`Egress started for stream ${stream.id}`)
  }
}

async function handleEgressEnded(event: LiveKitWebhookEvent): Promise<void> {
  if (!event.egressInfo) return

  const stream = await prisma.stream.findFirst({
    where: { egressId: event.egressInfo.egressId },
  })

  if (stream) {
    const updates: any = {
      egressStatus: 'ENDED',
    }

    if (event.egressInfo.error) {
      console.error(`Egress error for stream ${stream.id}:`, event.egressInfo.error)
      updates.egressError = event.egressInfo.error
    }

    await prisma.stream.update({
      where: { id: stream.id },
      data: updates,
    })

    // If egress ended unexpectedly, try to restart
    if (stream.status === 'LIVE' && event.egressInfo.error) {
      console.log('Attempting to restart failed egress')
      await streamingService.startBroadcastEgress(stream.id).catch(err => {
        console.error('Failed to restart egress:', err)
      })
    }
  }
}

async function handleTrackPublished(event: LiveKitWebhookEvent): Promise<void> {
  if (!event.room || !event.participant || !event.track) return

  const stream = await prisma.stream.findFirst({
    where: { liveKitRoomName: event.room.name },
  })

  if (stream && event.participant.permission?.canPublish) {
    // Host published a track - ensure egress is running
    if (stream.status === 'LIVE' && !stream.egressId) {
      await streamingService.startBroadcastEgress(stream.id).catch(err => {
        console.error('Failed to start egress on track publish:', err)
      })
    }
  }
}

// Mux event handlers

async function handleLiveStreamActive(event: MuxWebhookEvent): Promise<void> {
  const stream = await prisma.stream.findFirst({
    where: { muxAssetId: event.data.id },
  })

  if (stream) {
    await prisma.stream.update({
      where: { id: stream.id },
      data: {
        muxStatus: 'ACTIVE',
        rtmpConnectedAt: new Date(),
      },
    })

    console.log(`Mux stream active for stream ${stream.id}`)
  }
}

async function handleLiveStreamDisconnected(event: MuxWebhookEvent): Promise<void> {
  const stream = await prisma.stream.findFirst({
    where: { muxAssetId: event.data.id },
  })

  if (stream) {
    await prisma.stream.update({
      where: { id: stream.id },
      data: {
        muxStatus: 'DISCONNECTED',
        rtmpDisconnectedAt: new Date(),
      },
    })

    console.log(`Mux stream disconnected for stream ${stream.id}`)
    
    // Stream might reconnect within the reconnect window
    // Set a timer to check status after reconnect window expires
    const reconnectWindow = event.data.reconnect_window || 60
    
    setTimeout(async () => {
      const currentStream = await prisma.stream.findUnique({
        where: { id: stream.id },
      })
      
      if (currentStream?.muxStatus === 'DISCONNECTED') {
        console.log('Mux stream did not reconnect, ending broadcast')
        await streamingService.stopBroadcast(stream.id).catch(err => {
          console.error('Failed to stop broadcast after disconnect:', err)
        })
      }
    }, (reconnectWindow + 10) * 1000)
  }
}

async function handleLiveStreamIdle(event: MuxWebhookEvent): Promise<void> {
  const stream = await prisma.stream.findFirst({
    where: { muxAssetId: event.data.id },
  })

  if (stream) {
    await prisma.stream.update({
      where: { id: stream.id },
      data: {
        muxStatus: 'IDLE',
      },
    })

    console.log(`Mux stream idle for stream ${stream.id}`)
  }
}

async function handleLiveStreamRecording(event: MuxWebhookEvent): Promise<void> {
  if (!event.data.new_asset_id) return

  const stream = await prisma.stream.findFirst({
    where: { muxAssetId: event.data.id },
  })

  if (stream) {
    await prisma.stream.update({
      where: { id: stream.id },
      data: {
        recordingId: event.data.new_asset_id,
        recordingStatus: 'RECORDING',
      },
    })

    console.log(`Recording started for stream ${stream.id}`)
  }
}

async function handleAssetReady(event: MuxWebhookEvent): Promise<void> {
  const { id: assetId, playback_ids, duration } = event.data

  if (!playback_ids?.[0]?.id) {
    console.error('No playback ID in asset ready event')
    return
  }

  const stream = await prisma.stream.findFirst({
    where: { recordingId: assetId },
  })

  if (stream) {
    await prisma.stream.update({
      where: { id: stream.id },
      data: {
        recordingUrl: playback_ids[0].id,
        recordingStatus: 'READY',
        duration: Math.floor(duration || 0),
      },
    })

    console.log(`Recording ready for stream ${stream.id}`)
  }
}

async function handleAssetErrored(event: MuxWebhookEvent): Promise<void> {
  const { id: assetId } = event.data

  const stream = await prisma.stream.findFirst({
    where: { recordingId: assetId },
  })

  if (stream) {
    await prisma.stream.update({
      where: { id: stream.id },
      data: {
        recordingStatus: 'FAILED',
      },
    })

    console.error(`Recording failed for stream ${stream.id}`)
  }
}

// Monitoring functions

/**
 * Process webhook queue with error handling
 */
export async function processWebhookQueue(
  events: Array<LiveKitWebhookEvent | MuxWebhookEvent>
): Promise<{ processed: number; errors: number }> {
  let processed = 0
  let errors = 0

  for (const event of events) {
    try {
      if ('event' in event) {
        await handleLiveKitWebhook(event as LiveKitWebhookEvent)
      } else {
        await handleMuxWebhook(event as MuxWebhookEvent)
      }
      processed++
    } catch (error) {
      console.error('Webhook processing error:', error)
      errors++
    }
  }

  return { processed, errors }
}

/**
 * Verify webhook signatures
 */
export function verifyLiveKitWebhook(
  body: string,
  signature: string,
  secret: string
): boolean {
  // LiveKit webhook verification
  // Implementation depends on LiveKit's signature method
  return true // Placeholder
}

export function verifyMuxWebhook(
  body: string,
  signature: string,
  secret: string
): boolean {
  // Mux provides a verification method through their SDK
  const mux = new (require('@mux/mux-node'))()
  return mux.webhooks.verifyHeader(body, signature, secret)
}