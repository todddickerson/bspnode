import { NextRequest, NextResponse } from 'next/server'
import Mux from '@mux/mux-node'
import { prisma } from '@/lib/prisma'

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const streamId = params.id

    // Get stream from database
    const stream = await prisma.stream.findUnique({
      where: { id: streamId }
    })

    if (!stream) {
      return NextResponse.json({
        valid: false,
        reason: 'Stream not found'
      })
    }

    // Check if stream has Mux asset ID
    if (!stream.muxAssetId) {
      return NextResponse.json({
        valid: false,
        reason: 'No Mux stream configured'
      })
    }

    try {
      // Get live stream details from Mux
      const liveStream = await mux.video.liveStreams.retrieve(stream.muxAssetId)
      
      // Check stream status
      if (liveStream.status !== 'active') {
        return NextResponse.json({
          valid: false,
          reason: 'Stream not active',
          status: liveStream.status
        })
      }

      // Check if stream is connected (has active ingest)
      if (!liveStream.active_ingest_protocol) {
        return NextResponse.json({
          valid: false,
          reason: 'No active video input',
          status: liveStream.status
        })
      }

      // Check if asset is being created (video is actually being received)
      if (liveStream.active_asset_id) {
        // Get asset details to check if it's ready
        const asset = await mux.video.assets.retrieve(liveStream.active_asset_id)
        
        if (asset.status === 'ready' || asset.status === 'preparing') {
          return NextResponse.json({
            valid: true,
            reason: 'Video feed active and ready',
            playbackId: stream.muxPlaybackId,
            assetStatus: asset.status,
            duration: asset.duration || 0
          })
        } else {
          return NextResponse.json({
            valid: false,
            reason: 'Video still processing',
            assetStatus: asset.status
          })
        }
      }

      // Stream is active but no asset yet - likely just started
      return NextResponse.json({
        valid: false,
        reason: 'Waiting for video data',
        status: liveStream.status,
        activeProtocol: liveStream.active_ingest_protocol
      })

    } catch (muxError: any) {
      console.error('Mux API error:', muxError)
      
      // If Mux returns 404, stream doesn't exist
      if (muxError.status === 404) {
        return NextResponse.json({
          valid: false,
          reason: 'Stream not found in Mux'
        })
      }

      throw muxError
    }

  } catch (error) {
    console.error('Error validating video:', error)
    return NextResponse.json(
      { 
        valid: false,
        reason: 'Failed to validate video feed',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}