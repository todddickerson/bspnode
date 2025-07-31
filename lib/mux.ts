import Mux from '@mux/mux-node'

const tokenId = process.env.MUX_TOKEN_ID
const tokenSecret = process.env.MUX_TOKEN_SECRET

console.log('Initializing Mux with credentials:', {
  hasTokenId: !!tokenId,
  hasTokenSecret: !!tokenSecret,
  tokenIdLength: tokenId?.length,
})

// Initialize Mux client with v8 syntax
const muxClient = new Mux({
  tokenId: tokenId!,
  tokenSecret: tokenSecret!,
})

export async function createLiveStream(userId: string) {
  try {
    console.log('Creating live stream with Mux...')
    const stream = await muxClient.video.liveStreams.create({
      playback_policy: ['public'],
      new_asset_settings: {
        playback_policy: ['public'],
      },
    })

    console.log('Stream created successfully:', stream.id)

    return {
      streamKey: stream.stream_key,
      playbackId: stream.playback_ids?.[0]?.id,
      liveStreamId: stream.id,
    }
  } catch (error: any) {
    console.error('Mux API error:', error)
    console.error('Error type:', error.type)
    console.error('Error status:', error.status)
    
    // Provide detailed error message
    if (error.type === 'unauthorized') {
      throw new Error('Mux API credentials are invalid. Please check your MUX_TOKEN_ID and MUX_TOKEN_SECRET.')
    }
    
    throw new Error(`Failed to create live stream: ${error.message || 'Unknown error'}`)
  }
}