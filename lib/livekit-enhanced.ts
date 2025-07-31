import { 
  AccessToken, 
  RoomServiceClient, 
  EgressClient,
  StreamOutput,
  EncodedFileOutput,
  S3Upload,
  StreamProtocol,
  EncodingOptionsPreset,
  RoomCompositeEgressRequest,
} from 'livekit-server-sdk'

// LiveKit configuration
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || ''
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || ''
const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || ''

// Initialize LiveKit clients
const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
const egressClient = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)

// Export for health checks
export { roomService, egressClient }

// Enhanced interfaces
export interface RtmpEgressOptions {
  roomName: string
  rtmpUrl: string
  backupUrl?: string
  layout?: 'grid' | 'speaker' | 'single-speaker'
  videoCodec?: 'h264' | 'vp8'
  videoBitrate?: number
  audioBitrate?: number
  width?: number
  height?: number
  framerate?: number
  preset?: EncodingOptionsPreset
}

export interface EgressStatus {
  egressId: string
  roomName: string
  status: string
  startedAt: number
  error?: string
}

export interface StreamQualityMetrics {
  participantId: string
  connectionQuality: string
  isPublisher: boolean
  videoTrack?: {
    muted: boolean
    bitrate: number
    framerate: number
    width: number
    height: number
  }
  audioTrack?: {
    muted: boolean
    bitrate: number
  }
}

/**
 * Start RTMP egress with enhanced options and error handling
 */
export async function startEnhancedRtmpEgress(options: RtmpEgressOptions) {
  const {
    roomName,
    rtmpUrl,
    backupUrl,
    layout = 'speaker',
    videoCodec = 'h264',
    videoBitrate = 2500000, // 2.5 Mbps
    audioBitrate = 128000,  // 128 kbps
    width = 1920,
    height = 1080,
    framerate = 30,
    preset = EncodingOptionsPreset.HD_30_FPS,
  } = options

  try {
    // Validate room exists and has participants
    const participants = await roomService.listParticipants(roomName)
    if (participants.length === 0) {
      throw new Error('Cannot start egress: No participants in room')
    }

    // Prepare stream URLs
    const urls = [rtmpUrl]
    if (backupUrl) {
      urls.push(backupUrl)
    }

    // Create stream output with v2 class-based API
    const streamOutput = new StreamOutput({
      protocol: StreamProtocol.RTMP,
      urls,
    })

    // Start egress with v2 API
    const egress = await egressClient.startRoomCompositeEgress(
      roomName,
      {
        layout,
        audioOnly: false,
        videoOnly: false,
        stream: streamOutput,
        preset,
        advanced: {
          width,
          height,
          framerate,
          videoBitrate,
          audioBitrate,
        },
      } as any
    )

    console.log('RTMP egress started:', {
      egressId: egress.egressId,
      roomName,
      layout,
      urls: urls.map(u => u.replace(/\/[^\/]+$/, '/***')), // Hide stream key in logs
    })

    return {
      egressId: egress.egressId,
      roomName: egress.roomName || roomName,
      status: egress.status || 'starting',
      startedAt: egress.startedAt || Date.now(),
      stream: egress.streamResults || egress.stream || undefined,
    }
  } catch (error) {
    console.error('Failed to start RTMP egress:', error)
    throw new Error(`RTMP egress failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Start recording with cloud storage integration
 */
export async function startCloudRecording(
  roomName: string,
  s3Config?: {
    accessKey: string
    secret: string
    bucket: string
    region: string
  }
) {
  try {
    // Create file output with v2 class-based API
    let fileOutput: EncodedFileOutput
    
    if (s3Config) {
      fileOutput = new EncodedFileOutput({
        filepath: `recordings/${roomName}-${Date.now()}.mp4`,
        output: {
          case: 's3',
          value: new S3Upload({
            accessKey: s3Config.accessKey,
            secret: s3Config.secret,
            bucket: s3Config.bucket,
            region: s3Config.region,
          }),
        },
      })
    } else {
      fileOutput = new EncodedFileOutput({
        filepath: `recordings/${roomName}-${Date.now()}.mp4`,
      })
    }

    const egress = await egressClient.startRoomCompositeEgress(
      roomName,
      {
        layout: 'speaker',
        audioOnly: false,
        videoOnly: false,
        file: fileOutput,
        preset: EncodingOptionsPreset.HD_30_FPS,
      }
    )

    return {
      egressId: egress.egressId,
      filepath: fileOutput.filepath,
      status: egress.status,
    }
  } catch (error) {
    console.error('Failed to start recording:', error)
    throw error
  }
}

/**
 * Get egress status and health
 */
export async function getEgressStatus(egressId: string): Promise<EgressStatus> {
  try {
    const egressList = await egressClient.listEgress({
      egressId,
    })

    if (egressList.length === 0) {
      throw new Error('Egress not found')
    }

    const egress = egressList[0]
    return {
      egressId: egress.egressId,
      roomName: egress.roomName || '',
      status: egress.status || 'unknown',
      startedAt: egress.startedAt || 0,
      error: egress.error,
    }
  } catch (error) {
    console.error('Failed to get egress status:', error)
    throw error
  }
}

/**
 * Update stream URLs dynamically (add/remove/change RTMP endpoints)
 */
export async function updateStreamUrls(
  egressId: string,
  urls: string[]
) {
  try {
    await egressClient.updateStream(egressId, {
      addOutputUrls: urls,
    })
    
    console.log('Stream URLs updated:', {
      egressId,
      urlCount: urls.length,
    })
  } catch (error) {
    console.error('Failed to update stream URLs:', error)
    throw error
  }
}

/**
 * Monitor stream quality and participant metrics
 */
export async function getStreamQualityMetrics(
  roomName: string
): Promise<StreamQualityMetrics[]> {
  try {
    const participants = await roomService.listParticipants(roomName)
    
    return participants.map(participant => {
      const videoTrack = participant.tracks?.find(t => t.type === 'VIDEO')
      const audioTrack = participant.tracks?.find(t => t.type === 'AUDIO')

      return {
        participantId: participant.sid,
        connectionQuality: participant.connectionQuality || 'unknown',
        isPublisher: participant.permission?.canPublish || false,
        videoTrack: videoTrack ? {
          muted: videoTrack.muted || false,
          bitrate: 0, // Would need separate API call for real-time stats
          framerate: videoTrack.framerate || 0,
          width: videoTrack.width || 0,
          height: videoTrack.height || 0,
        } : undefined,
        audioTrack: audioTrack ? {
          muted: audioTrack.muted || false,
          bitrate: 0, // Would need separate API call for real-time stats
        } : undefined,
      }
    })
  } catch (error) {
    console.error('Failed to get quality metrics:', error)
    return []
  }
}

/**
 * Gracefully stop egress with retry logic
 */
export async function stopEgressGracefully(
  egressId: string,
  maxRetries: number = 3
): Promise<boolean> {
  let retries = 0
  
  while (retries < maxRetries) {
    try {
      await egressClient.stopEgress(egressId)
      console.log('Egress stopped successfully:', egressId)
      return true
    } catch (error) {
      retries++
      console.error(`Failed to stop egress (attempt ${retries}):`, error)
      
      if (retries < maxRetries) {
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)))
      }
    }
  }
  
  return false
}

/**
 * Check if room has active egress
 */
export async function hasActiveEgress(roomName: string): Promise<boolean> {
  try {
    const egressList = await egressClient.listEgress({
      roomName,
      active: true,
    })
    
    return egressList.length > 0
  } catch (error) {
    console.error('Failed to check active egress:', error)
    return false
  }
}

/**
 * Start egress with automatic quality adjustment based on publisher's connection
 */
export async function startAdaptiveRtmpEgress(
  roomName: string,
  rtmpUrl: string
): Promise<any> {
  // Get current participants to check publisher quality
  const participants = await roomService.listParticipants(roomName)
  const publisher = participants.find(p => p.permission?.canPublish)
  
  if (!publisher) {
    throw new Error('No publisher found in room')
  }

  // Determine quality based on connection
  let preset = EncodingOptionsPreset.HD_30_FPS
  let videoBitrate = 2500000
  
  switch (publisher.connectionQuality) {
    case 'poor':
      preset = EncodingOptionsPreset.SD_30_FPS
      videoBitrate = 1000000
      break
    case 'good':
      preset = EncodingOptionsPreset.HD_30_FPS
      videoBitrate = 2500000
      break
    case 'excellent':
      preset = EncodingOptionsPreset.FULL_HD_30_FPS
      videoBitrate = 4500000
      break
  }

  return startEnhancedRtmpEgress({
    roomName,
    rtmpUrl,
    preset,
    videoBitrate,
  })
}

// Export all enhanced functions
export const enhancedLiveKit = {
  startEnhancedRtmpEgress,
  startCloudRecording,
  getEgressStatus,
  updateStreamUrls,
  getStreamQualityMetrics,
  stopEgressGracefully,
  hasActiveEgress,
  startAdaptiveRtmpEgress,
}