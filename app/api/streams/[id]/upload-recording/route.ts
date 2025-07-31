import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Mux from '@mux/mux-node'

// Initialize Mux client with v8 syntax
const muxClient = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
})

/**
 * Poll Mux asset status and update stream recording status when ready
 */
async function startMuxAssetPolling(streamId: string, uploadId: string) {
  const MAX_ATTEMPTS = 60 // Poll for up to 10 minutes (every 10 seconds)
  let attempts = 0

  const pollAssetStatus = async () => {
    try {
      attempts++
      console.log(`Polling Mux asset status for stream ${streamId}, attempt ${attempts}`)

      // Get the upload status from Mux
      const upload = await muxClient.video.uploads.retrieve(uploadId)
      
      if (upload.asset_id && upload.status === 'asset_created') {
        // Asset was created successfully, now check if it's ready
        const asset = await muxClient.video.assets.retrieve(upload.asset_id)
        
        if (asset.status === 'ready' && asset.playback_ids && asset.playback_ids.length > 0) {
          // Asset is ready! Update the stream
          const playbackId = asset.playback_ids[0].id
          
          await prisma.stream.update({
            where: { id: streamId },
            data: {
              recordingStatus: 'READY',
              recordingUrl: playbackId, // Store playback ID for viewing
            },
          })
          
          console.log(`Recording ready for stream ${streamId}: ${playbackId}`)
          return // Stop polling
        }
      }
      
      if (upload.status === 'errored' || attempts >= MAX_ATTEMPTS) {
        // Upload failed or we've exceeded max attempts
        await prisma.stream.update({
          where: { id: streamId },
          data: {
            recordingStatus: 'FAILED',
          },
        })
        
        console.log(`Recording failed for stream ${streamId} after ${attempts} attempts`)
        return // Stop polling
      }
      
      // Continue polling after 10 seconds
      setTimeout(pollAssetStatus, 10000)
      
    } catch (error) {
      console.error(`Error polling Mux asset status for stream ${streamId}:`, error)
      
      if (attempts >= MAX_ATTEMPTS) {
        // Give up and mark as failed
        await prisma.stream.update({
          where: { id: streamId },
          data: {
            recordingStatus: 'FAILED',
          },
        }).catch(console.error)
      } else {
        // Try again after 10 seconds
        setTimeout(pollAssetStatus, 10000)
      }
    }
  }

  // Start polling after a 30-second delay (give Mux time to start processing)
  setTimeout(pollAssetStatus, 30000)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user owns the stream
    const stream = await prisma.stream.findUnique({
      where: { id: params.id },
    })

    if (!stream || stream.userId !== session.user.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the uploaded file
    const formData = await req.formData()
    const file = formData.get('recording') as File
    
    if (!file) {
      return NextResponse.json(
        { message: 'No file uploaded' },
        { status: 400 }
      )
    }

    // Update recording status
    await prisma.stream.update({
      where: { id: params.id },
      data: {
        recordingStatus: 'UPLOADING',
      },
    })

    // Create a Mux direct upload URL
    const upload = await muxClient.video.uploads.create({
      cors_origin: '*',
      new_asset_settings: {
        playback_policy: ['public'],
      },
    })

    // Convert file to array buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Mux
    const uploadResponse = await fetch(upload.url, {
      method: 'PUT',
      body: buffer,
      headers: {
        'Content-Type': 'video/webm',
      },
    })

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload to Mux')
    }

    // Update stream with upload ID
    await prisma.stream.update({
      where: { id: params.id },
      data: {
        recordingStatus: 'PROCESSING',
        recordingId: upload.id,
      },
    })

    // Start polling for asset status (since webhooks might not be set up)
    startMuxAssetPolling(params.id, upload.id)

    return NextResponse.json({
      message: 'Recording uploaded successfully',
      uploadId: upload.id,
    })
  } catch (error) {
    console.error('Error uploading recording:', error)
    
    // Update status to failed
    await prisma.stream.update({
      where: { id: params.id },
      data: {
        recordingStatus: 'FAILED',
      },
    }).catch(() => {}) // Ignore errors in error handler
    
    return NextResponse.json(
      { message: 'Failed to upload recording' },
      { status: 500 }
    )
  }
}