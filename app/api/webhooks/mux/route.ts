import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Mux from '@mux/mux-node'
import { prisma } from '@/lib/prisma'

const webhookSecret = process.env.MUX_WEBHOOK_SECRET

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = headers().get('mux-signature')
    
    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      const mux = new Mux({
        tokenId: process.env.MUX_TOKEN_ID!,
        tokenSecret: process.env.MUX_TOKEN_SECRET!,
      })
      const isValid = await mux.webhooks.verifySignature(
        body,
        { 'mux-signature': signature },
        webhookSecret
      )
      
      if (!isValid) {
        return NextResponse.json(
          { message: 'Invalid signature' },
          { status: 401 }
        )
      }
    }
    
    const event = JSON.parse(body)
    console.log('Mux webhook received:', event.type)
    
    switch (event.type) {
      case 'video.asset.ready':
        await handleAssetReady(event.data)
        break
        
      case 'video.asset.errored':
        await handleAssetError(event.data)
        break
        
      case 'video.live_stream.recording':
        await handleLiveStreamRecording(event.data)
        break
        
      default:
        console.log('Unhandled event type:', event.type)
    }
    
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { message: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handleAssetReady(data: any) {
  const { id: assetId, playback_ids, duration } = data
  
  if (!playback_ids?.[0]?.id) {
    console.error('No playback ID in asset ready event')
    return
  }
  
  const playbackId = playback_ids[0].id
  
  // Find stream by recording ID
  const stream = await prisma.stream.findFirst({
    where: { recordingId: assetId },
  })
  
  if (!stream) {
    console.error('Stream not found for asset:', assetId)
    return
  }
  
  // Update stream with recording details
  await prisma.stream.update({
    where: { id: stream.id },
    data: {
      recordingUrl: playbackId,
      recordingStatus: 'READY',
      duration: Math.floor(duration || 0),
    },
  })
  
  console.log('Recording ready for stream:', stream.id)
}

async function handleAssetError(data: any) {
  const { id: assetId } = data
  
  // Find stream by recording ID
  const stream = await prisma.stream.findFirst({
    where: { recordingId: assetId },
  })
  
  if (!stream) {
    console.error('Stream not found for errored asset:', assetId)
    return
  }
  
  // Update stream recording status
  await prisma.stream.update({
    where: { id: stream.id },
    data: {
      recordingStatus: 'FAILED',
    },
  })
  
  console.log('Recording failed for stream:', stream.id)
}

async function handleLiveStreamRecording(data: any) {
  const { id: liveStreamId, new_asset_id } = data
  
  // Find stream by Mux asset ID
  const stream = await prisma.stream.findFirst({
    where: { muxAssetId: liveStreamId },
  })
  
  if (!stream) {
    console.error('Stream not found for live stream:', liveStreamId)
    return
  }
  
  // Update stream with recording asset ID
  await prisma.stream.update({
    where: { id: stream.id },
    data: {
      recordingId: new_asset_id,
      recordingStatus: 'PROCESSING',
    },
  })
  
  console.log('Live stream recording started for stream:', stream.id)
}