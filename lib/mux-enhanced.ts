import Mux from '@mux/mux-node'

// Initialize Mux client with v8 syntax
const muxClient = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
})

// Interfaces
export interface MuxStreamConfig {
  userId: string
  reducedLatency?: boolean
  reconnectWindow?: number
  maxContinuousDuration?: number
  simulcastTargets?: Array<{
    url: string
    streamKey?: string
  }>
  test?: boolean
}

export interface MuxStreamResponse {
  streamKey: string
  playbackId: string
  liveStreamId: string
  rtmpUrl: string
  rtmpsUrl: string
  status: string
  createdAt: string
}

export interface MuxStreamHealth {
  id: string
  status: 'idle' | 'active' | 'disabled'
  reconnectWindow: number
  maxContinuousDuration: number
  recentAssetIds: string[]
  activeSince?: string
  idleSince?: string
}

/**
 * Create a Mux live stream with enhanced configuration
 */
export async function createEnhancedLiveStream(
  config: MuxStreamConfig
): Promise<MuxStreamResponse> {
  const {
    userId,
    reducedLatency = true,
    reconnectWindow = 60,
    maxContinuousDuration = 24 * 60 * 60,
    simulcastTargets = [],
    test = process.env.NODE_ENV === 'development',
  } = config

  try {
    console.log('Creating enhanced Mux live stream...')
    
    const stream = await muxClient.video.liveStreams.create({
      playback_policy: ['public'],
      new_asset_settings: {
        playback_policy: ['public'],
        master_access: 'none',
        mp4_support: 'standard',
      },
      reduced_latency: reducedLatency,
      reconnect_window: reconnectWindow,
      max_continuous_duration: maxContinuousDuration,
      simulcast_targets: simulcastTargets,
      test,
      // Enable automatic recording
      recording_times: [{
        type: 'live',
      }],
      // Add metadata
      passthrough: JSON.stringify({
        userId,
        createdAt: new Date().toISOString(),
      }),
    })

    console.log('Live stream created:', stream.id)

    return {
      streamKey: stream.stream_key,
      playbackId: stream.playback_ids?.[0]?.id || '',
      liveStreamId: stream.id,
      rtmpUrl: `rtmp://global-live.mux.com:5222/app/${stream.stream_key}`,
      rtmpsUrl: `rtmps://global-live.mux.com:443/app/${stream.stream_key}`,
      status: stream.status,
      createdAt: stream.created_at,
    }
  } catch (error: any) {
    console.error('Mux API error:', error)
    
    if (error.type === 'unauthorized') {
      throw new Error('Invalid Mux credentials. Check MUX_TOKEN_ID and MUX_TOKEN_SECRET.')
    }
    
    if (error.type === 'invalid_parameters') {
      throw new Error(`Invalid stream configuration: ${error.message}`)
    }
    
    throw new Error(`Failed to create live stream: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Get live stream status and health information
 */
export async function getLiveStreamHealth(
  liveStreamId: string
): Promise<MuxStreamHealth> {
  try {
    const stream = await muxClient.video.liveStreams.retrieve(liveStreamId)
    
    return {
      id: stream.id,
      status: stream.status as 'idle' | 'active' | 'disabled',
      reconnectWindow: stream.reconnect_window || 0,
      maxContinuousDuration: stream.max_continuous_duration || 0,
      recentAssetIds: stream.recent_asset_ids || [],
      activeSince: stream.active_ingest_protocol ? new Date().toISOString() : undefined,
      idleSince: !stream.active_ingest_protocol ? new Date().toISOString() : undefined,
    }
  } catch (error) {
    console.error('Failed to get stream health:', error)
    throw error
  }
}

/**
 * Enable or disable a live stream
 */
export async function toggleLiveStream(
  liveStreamId: string,
  enabled: boolean
): Promise<void> {
  try {
    if (enabled) {
      await muxClient.video.liveStreams.enable(liveStreamId)
      console.log('Live stream enabled:', liveStreamId)
    } else {
      await muxClient.video.liveStreams.disable(liveStreamId)
      console.log('Live stream disabled:', liveStreamId)
    }
  } catch (error) {
    console.error('Failed to toggle live stream:', error)
    throw error
  }
}

/**
 * Get playback URL with various options
 */
export function getMuxPlaybackUrl(
  playbackId: string,
  options?: {
    reducedLatency?: boolean
    token?: string
    redundantStreams?: boolean
  }
): string {
  const base = `https://stream.mux.com/${playbackId}.m3u8`
  const params = new URLSearchParams()
  
  if (options?.reducedLatency) {
    params.append('latency', 'reduced')
  }
  
  if (options?.redundantStreams) {
    params.append('redundant_streams', 'true')
  }
  
  if (options?.token) {
    params.append('token', options.token)
  }
  
  return params.toString() ? `${base}?${params}` : base
}

/**
 * Get thumbnail URL for a live stream or asset
 */
export function getMuxThumbnailUrl(
  playbackId: string,
  options?: {
    time?: number
    width?: number
    height?: number
    fitMode?: 'preserve' | 'stretch' | 'crop' | 'smartcrop' | 'pad'
  }
): string {
  const { time = 0, width = 640, height = 360, fitMode = 'smartcrop' } = options || {}
  
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}&width=${width}&height=${height}&fit_mode=${fitMode}`
}

/**
 * Create a signed playback URL for private content
 */
export async function createSignedPlaybackUrl(
  playbackId: string,
  options?: {
    expiresIn?: number // seconds
    viewerId?: string
  }
): Promise<string> {
  const { expiresIn = 3600, viewerId } = options || {}
  
  try {
    const token = await Video.SigningKeys.create({
      playback_ids: [playbackId],
      expires_in: expiresIn,
      viewer_id: viewerId,
    })
    
    return getMuxPlaybackUrl(playbackId, { token: token.id })
  } catch (error) {
    console.error('Failed to create signed URL:', error)
    throw error
  }
}

/**
 * Get live stream analytics
 */
export async function getLiveStreamAnalytics(
  liveStreamId: string,
  timeframe: { start: Date; end: Date }
): Promise<any> {
  try {
    // This would use Mux Data API
    // Placeholder for analytics implementation
    return {
      views: 0,
      uniqueViewers: 0,
      avgViewDuration: 0,
      peakConcurrentViewers: 0,
    }
  } catch (error) {
    console.error('Failed to get analytics:', error)
    throw error
  }
}

/**
 * Reset stream key for security
 */
export async function resetStreamKey(
  liveStreamId: string
): Promise<string> {
  try {
    const response = await muxClient.video.liveStreams.resetStreamKey(liveStreamId)
    console.log('Stream key reset for:', liveStreamId)
    return response.stream_key
  } catch (error) {
    console.error('Failed to reset stream key:', error)
    throw error
  }
}

/**
 * Delete a live stream
 */
export async function deleteLiveStream(
  liveStreamId: string
): Promise<void> {
  try {
    await muxClient.video.liveStreams.delete(liveStreamId)
    console.log('Live stream deleted:', liveStreamId)
  } catch (error) {
    console.error('Failed to delete live stream:', error)
    throw error
  }
}

/**
 * List all assets created from a live stream
 */
export async function getLiveStreamAssets(
  liveStreamId: string
): Promise<any[]> {
  try {
    const stream = await muxClient.video.liveStreams.retrieve(liveStreamId)
    const assetIds = stream.recent_asset_ids || []
    
    const assets = await Promise.all(
      assetIds.map(id => muxClient.video.assets.retrieve(id))
    )
    
    return assets.map(asset => ({
      id: asset.id,
      status: asset.status,
      duration: asset.duration,
      createdAt: asset.created_at,
      playbackIds: asset.playback_ids,
      resolution: asset.resolution_tier,
      aspectRatio: asset.aspect_ratio,
    }))
  } catch (error) {
    console.error('Failed to get stream assets:', error)
    return []
  }
}

/**
 * Check if stream is currently active
 */
export async function isStreamActive(
  liveStreamId: string
): Promise<boolean> {
  try {
    const health = await getLiveStreamHealth(liveStreamId)
    return health.status === 'active'
  } catch (error) {
    console.error('Failed to check stream status:', error)
    return false
  }
}

// Export all enhanced Mux functions
export const enhancedMux = {
  createEnhancedLiveStream,
  getLiveStreamHealth,
  toggleLiveStream,
  getMuxPlaybackUrl,
  getMuxThumbnailUrl,
  createSignedPlaybackUrl,
  getLiveStreamAnalytics,
  resetStreamKey,
  deleteLiveStream,
  getLiveStreamAssets,
  isStreamActive,
}